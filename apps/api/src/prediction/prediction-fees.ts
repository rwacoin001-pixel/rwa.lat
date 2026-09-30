/**
 * 预测市场内部盘（路线 A）费率 —— A+C 混合收费。
 *
 * - place  ：下注费。下注时从本金中扣除，只把净额投入风险池，费用即时计入平台收入。
 * - payout ：派彩费。赢家派彩时从毛派彩中扣除，计入平台收入。
 *
 * 默认 3% + 3%，可用环境变量覆盖，钳制在 0~2000 bps（0%~20%）。
 * 本模块是费率的唯一权威数据源：`/v1/predictions/status` 对外暴露这里的值，
 * 前端（含费率页与投注确认页）必须读取接口返回值，不得自行硬编码。
 */

const BPS_DENOMINATOR = 10_000n
const MIN_BPS = 0
const MAX_BPS = 2_000

export type PredictionFeeConfig = {
  /** 下注费，基点（300 = 3%） */
  placeFeeBps: number
  /** 派彩费，基点（300 = 3%） */
  payoutFeeBps: number
}

function boundedBps(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, MIN_BPS), MAX_BPS)
}

/** 读取当前费率配置（每次调用读取，便于运维改环境变量后即时生效） */
export function predictionFeeConfig(): PredictionFeeConfig {
  return {
    placeFeeBps: boundedBps(process.env.PREDICTION_FEE_BPS_PLACE, 300),
    payoutFeeBps: boundedBps(process.env.PREDICTION_FEE_BPS_PAYOUT, 300),
  }
}

/**
 * 按基点抽费，向下取整（永不超额收取，永不为负）。
 * `feeOn(1000000n, 300)` → `30000n`（1 USDT 的 3% = 0.03 USDT）
 */
export function feeOn(amountAtomic: bigint, bps: number): bigint {
  if (amountAtomic <= 0n || bps <= 0) return 0n
  return (amountAtomic * BigInt(bps)) / BPS_DENOMINATOR
}

/** 基点转小数，用于接口下发给前端展示（300 → 0.03） */
export function bpsToRate(bps: number): number {
  return bps / Number(BPS_DENOMINATOR)
}
