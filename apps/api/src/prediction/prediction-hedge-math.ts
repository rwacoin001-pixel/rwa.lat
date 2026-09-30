import { feeOn } from './prediction-fees'

/**
 * 内部盘敞口与对冲的**纯计算**模块 —— 不引用 Nest、不访问数据库、不发网络请求。
 *
 * 之所以单独拆出来：这部分是庄家盘的风险核心，必须能被独立测试，
 * 而不是淹没在 service 的 I/O 里。服务层只负责取数（订单簿、投注单）和落库。
 *
 * 定标约定：
 * - 金额（USDT）：atomic，1e6（6 位小数）
 * - 份额 / 价格：18 位小数定标（与 Polymarket CLOB 的 base 单位一致）
 */

export const SHARES_SCALE = 10n ** 18n
export const ATOMIC_PER_UNIT = 10n ** 6n
const PRICE_SHARES_SCALE = 10n ** 30n // shares18 × price18 → atomic

/**
 * 份额(18 位定标) ↔ 金额(6 位原子) 的换算系数 = 1e18 / 1e6 = 1e12。
 * 1 股结算时支付 1 USDT，所以 970000000000000000000n（970 股）÷ 1e12 = 970000000n（970 USDT atomic）。
 */
export const SHARE_ATOMIC_SCALE = 10n ** 12n

/** "0.62" → 620000000000000000n；"1" → 1000000000000000000n */
export function parseDecimal18(value: string): bigint {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid decimal: ${value}`)
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18)
  return BigInt(whole) * SHARES_SCALE + BigInt(fracPadded || '0')
}

/** 620000000000000000n → "0.62"（用于 numeric(38,18) 插入） */
export function formatDecimal18(value: bigint): string {
  const whole = value / SHARES_SCALE
  const frac = (value % SHARES_SCALE).toString().padStart(18, '0').replace(/0+$/, '')
  return frac.length ? `${whole}.${frac}` : whole.toString()
}

/** 买入份额花费（USDT atomic）= shares18 × price18 / 1e30 */
export function hedgeCostAtomic(shares18: bigint, price18: bigint): bigint {
  if (shares18 <= 0n || price18 <= 0n) return 0n
  return (shares18 * price18) / PRICE_SHARES_SCALE
}

export type HedgeLegInput = {
  tokenId: string
  tokenMappingId: string | null
  outcome: string
  /** 该结果累计份额（18 位定标，base 单位） */
  shares18: bigint
  /** 上游最小下单量（18 位定标字符串） */
  minOrderSize18: string | null
}

export type HedgeLegPlan = HedgeLegInput & {
  /** 该结果赢时需赔付的毛负债（USDT atomic） */
  grossLiabilityAtomic: bigint
  /** 扣除派彩费后的净负债（USDT atomic） */
  netLiabilityAtomic: bigint
  /** 建议买入份额（18 位定标）；0 表示这条腿不需要买 */
  targetShares18: bigint
  /** 建议买入量是否低于上游最小下单量（低于则无法执行） */
  belowMinOrder: boolean
}

export type ExposurePlan = {
  /** 池子收到的净本金 = Σ(stake − 下注费) */
  collectedAtomic: bigint
  legs: HedgeLegPlan[]
  maxNetLiabilityAtomic: bigint
  minNetLiabilityAtomic: bigint
  /** 最坏情况平台盈亏（负数 = 亏损） */
  worstCaseAtomic: bigint
  /** 最好情况平台盈亏 */
  bestCaseAtomic: bigint
  /** 需要买入的份额合计（18 位定标） */
  totalTargetShares18: bigint
  /** 是否存在可执行的买入腿（价格未提供时仅看份额与最小单限制） */
  anyExecutable: boolean
}

/**
 * 敞口核算 + 对冲量计算。
 *
 * 推导：
 *   若结果 i 赢，平台盈亏 PnL_i = C − NL_i（C = 池子净本金，NL_i = 净负债）
 *   最坏情况 worst = min_i PnL_i = C − max_i NL_i
 *
 *   买入 S_i 份结果 i，花费 Σ p_j·S_j；买入后在结果 i 获胜时多收 S_i：
 *     PnL_i' = C − NL_i − Σ p_j·S_j + S_i
 *   令所有 i 的 PnL_i' 相等 → S_i = NL_i − min_j NL_j
 *   （即：只买净负债最高的那条腿；把方向性盈亏换成确定的价差成本）
 *
 *   对冲后最坏盈亏 = worst + (max NL − min NL) − 总对冲成本
 */
export function planExposure(input: {
  collectedAtomic: bigint
  legs: HedgeLegInput[]
  payoutFeeBps: number
  /** 对冲比例基点，10000 = 完全拉平 */
  ratioBps: number
}): ExposurePlan {
  const { collectedAtomic, legs, payoutFeeBps, ratioBps } = input

  const withLiability = legs.map((leg) => {
    const grossLiabilityAtomic = leg.shares18 / SHARE_ATOMIC_SCALE
    const netLiabilityAtomic = grossLiabilityAtomic - feeOn(grossLiabilityAtomic, payoutFeeBps)
    return { ...leg, grossLiabilityAtomic, netLiabilityAtomic }
  })

  const minNetLiabilityAtomic = withLiability.reduce(
    (min, leg) => (leg.netLiabilityAtomic < min ? leg.netLiabilityAtomic : min),
    withLiability.length ? withLiability[0].netLiabilityAtomic : 0n,
  )
  const maxNetLiabilityAtomic = withLiability.reduce(
    (max, leg) => (leg.netLiabilityAtomic > max ? leg.netLiabilityAtomic : max),
    0n,
  )

  let totalTargetShares18 = 0n
  let anyExecutable = false

  const planned: HedgeLegPlan[] = withLiability.map((leg) => {
    let targetShares18 = leg.netLiabilityAtomic - minNetLiabilityAtomic
    if (ratioBps < 10_000) targetShares18 = (targetShares18 * BigInt(ratioBps)) / 10_000n
    targetShares18 *= SHARE_ATOMIC_SCALE

    // min_order_size 同样是 numeric(38,18) 的十进制串（"1.000000000000000000"），
    // 必须经 parseDecimal18 转 bigint —— 直接 BigInt() 会抛异常。
    const minOrder = leg.minOrderSize18 ? parseDecimal18(leg.minOrderSize18) : null
    const belowMinOrder = targetShares18 > 0n && minOrder !== null && minOrder > 0n && targetShares18 < minOrder
    if (targetShares18 > 0n && !belowMinOrder) anyExecutable = true
    totalTargetShares18 += targetShares18

    return { ...leg, targetShares18, belowMinOrder }
  })

  return {
    collectedAtomic,
    legs: planned,
    maxNetLiabilityAtomic,
    minNetLiabilityAtomic,
    worstCaseAtomic: collectedAtomic - maxNetLiabilityAtomic,
    bestCaseAtomic: collectedAtomic - minNetLiabilityAtomic,
    totalTargetShares18,
    anyExecutable,
  }
}
