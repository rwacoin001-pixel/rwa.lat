import { Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { PolymarketService } from '../polymarket/polymarket.service'
import { predictionFeeConfig } from './prediction-fees'
import {
  formatDecimal18,
  hedgeCostAtomic,
  parseDecimal18,
  planExposure,
  type HedgeLegPlan,
} from './prediction-hedge-math'

/**
 * 内部盘敞口核算 + 对冲量计算（路线 A 庄家盘第 2 期）。
 *
 * 数学部分在 prediction-hedge-math.ts（纯函数，可独立测试）；
 * 本服务只做 I/O：读投注/映射表、取 CLOB 订单簿、组装结果。
 *
 * 口径速览（详见 math 模块）：
 *   池子净本金 C   = Σ(stake − 下注费)
 *   净负债   NL_i  = Σ(该结果 shares) × (1 − 派彩费率)
 *   最坏情况 worst = C − max_i NL_i          ← 负数即平台亏损
 *   对冲量   S_i   = NL_i − min_j NL_j       ← 只买净负债最高的那条腿
 *   对冲后最坏    = worst + (max NL − min NL) − 总对冲成本
 */

export type OutcomeExposure = {
  tokenId: string
  tokenMappingId: string | null
  outcome: string
  /** 该结果赢时需赔付的毛负债（USDT atomic） */
  grossLiabilityAtomic: string
  /** 扣除派彩费后的净负债（USDT atomic） */
  netLiabilityAtomic: string
  shares18: string
  /** 最优卖价（买入限价）；盘口没有卖盘时为 null */
  bestAskPrice: number | null
  /** 建议买入份额（18 位小数）；"0" 表示该腿不需要买 */
  hedgeShares18: string
  /** 建议买入的预估花费（USDT atomic） */
  hedgeCostAtomic: string
  /** 上游最小下单量（18 位小数），用于判断能否执行 */
  minOrderSize18: string | null
  /** 建议买入量低于上游最小下单量 —— 无法执行 */
  belowMinOrder: boolean
  /** 盘口总卖量是否够吃下这笔买入 */
  bookDepthSufficient: boolean
}

export type MarketExposure = {
  marketMappingId: string
  question: string
  slug: string
  openBets: number
  /** 池子收到的净本金 */
  collectedAtomic: string
  placeFeeAtomic: string
  outcomes: OutcomeExposure[]
  /** 最坏情况平台盈亏（USDT atomic，负数=亏损） */
  worstCaseAtomic: string
  /** 最好情况平台盈亏 */
  bestCaseAtomic: string
  /** 完全对冲所需成本 */
  fullHedgeCostAtomic: string
  /** 完全对冲后的最坏盈亏 */
  hedgedWorstCaseAtomic: string
  /** 是否达到需要对冲的阈值 */
  hedgeRequired: boolean
  /** 不能/不需要对冲的原因 */
  skipReason: string | null
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

export function predictionHedgeConfig() {
  const minLossAtomic = BigInt(
    boundedInteger(process.env.PREDICTION_HEDGE_MIN_LOSS_ATOMIC, 50_000_000, 0, 1_000_000_000),
  )
  return {
    /** 单轮最多核算多少个市场 */
    maxMarkets: boundedInteger(process.env.PREDICTION_HEDGE_MAX_MARKETS, 20, 1, 200),
    /** 最坏亏损低于此值就不对冲（USDT atomic，默认 50 USDT）—— 小敞口不值得付价差 */
    minLossAtomic,
    /** 对冲比例，基点（10000 = 完全拉平；5000 = 只对冲一半风险） */
    ratioBps: boundedInteger(process.env.PREDICTION_HEDGE_RATIO_BPS, 10_000, 0, 10_000),
  }
}

@Injectable()
export class PredictionExposureService {
  private readonly log = new Logger(PredictionExposureService.name)

  constructor(
    private readonly dataSource: DataSource,
    private readonly polymarket: PolymarketService,
  ) {}

  /** 核算所有存在未结算投注的市场敞口（按净本金降序，最多 maxMarkets 个） */
  async marketExposures(limit?: number): Promise<MarketExposure[]> {
    const cap = limit ?? predictionHedgeConfig().maxMarkets
    const markets = await this.dataSource.query(
      `SELECT m.id::text AS "marketMappingId"
       FROM app.prediction_bets b
       JOIN app.polymarket_market_mappings m ON m.id = b.market_mapping_id
       WHERE b.status = 'placed'
       GROUP BY m.id
       ORDER BY SUM(b.stake_atomic - b.fee_atomic) DESC
       LIMIT $1`,
      [cap],
    )
    const exposures: MarketExposure[] = []
    for (const market of markets as Array<{ marketMappingId: string }>) {
      try {
        exposures.push(await this.marketExposure(market.marketMappingId))
      } catch (error) {
        this.log.error(`exposure calc failed market=${market.marketMappingId}: ${String(error).slice(0, 200)}`)
      }
    }
    // 有未结算投注却一条都算不出来 —— 那不是"没有敞口"，是算错了。
    // 必须炸出来：否则会被上层吞成一条 warn，表现为对冲决策静默零产出（已踩过）。
    if (markets.length > 0 && exposures.length === 0) {
      throw new Error(`exposure calculation failed for all ${markets.length} market(s) with open bets`)
    }
    return exposures
  }

  /** 单个市场的敞口与对冲建议 */
  async marketExposure(marketMappingId: string): Promise<MarketExposure> {
    const config = predictionHedgeConfig()
    const feeConfig = predictionFeeConfig()

    const [market] = await this.dataSource.query(
      `SELECT m.id::text AS "marketMappingId", m.question, m.slug
       FROM app.polymarket_market_mappings m WHERE m.id = $1`,
      [marketMappingId],
    )
    if (!market) throw new Error(`Prediction market ${marketMappingId} not found`)

    const [totals] = await this.dataSource.query(
      `SELECT COALESCE(SUM(b.stake_atomic - b.fee_atomic), 0)::text AS "collectedAtomic",
              COALESCE(SUM(b.fee_atomic), 0)::text AS "placeFeeAtomic",
              COUNT(*)::int AS "openBets"
       FROM app.prediction_bets b
       WHERE b.market_mapping_id = $1 AND b.status = 'placed'`,
      [marketMappingId],
    )
    // ⚠️ 必须从**市场的全部未结算 outcome** 建腿，而不是只从"有投注的 token"建腿。
    //    否则单边盘（只有一个结果有投注）会退化成 min NL = max NL ⇒ 对冲量恒为 0，
    //    庄家在真实的两结果市场里完全裸露。没被投注的那一侧 shares = 0，正好成为 min NL 的基准。
    const legs = await this.dataSource.query(
      `SELECT t.token_id AS "tokenId",
              t.id::text AS "tokenMappingId",
              t.outcome AS outcome,
              t.min_order_size::text AS "minOrderSize18",
              COALESCE(SUM(b.shares), 0)::text AS "shares18"
       FROM app.polymarket_token_mappings t
       LEFT JOIN app.prediction_bets b
              ON b.token_id = t.token_id
             AND b.market_mapping_id = t.market_mapping_id
             AND b.status = 'placed'
       WHERE t.market_mapping_id = $1
         AND t.state <> 'resolved'
       GROUP BY t.token_id, t.id, t.outcome, t.min_order_size`,
      [marketMappingId],
    )

    // ── 纯计算：净负债、最坏情况、对冲量 ─────────────────────────────────
    // ⚠️ shares / min_order_size 在 DB 里是 numeric(38,18)，::text 出来是**十进制串**
    //    （如 "256.410256410256410256"）。绝不能用 BigInt() 直接解析 —— 会抛
    //    SyntaxError 并被上层 try/catch 吞成一条 warn，导致对冲决策静默零产出。
    //    必须走 parseDecimal18。
    const plan = planExposure({
      collectedAtomic: BigInt(totals?.collectedAtomic ?? '0'),
      legs: (legs as Array<Record<string, string | null>>).map((leg) => ({
        tokenId: String(leg.tokenId),
        tokenMappingId: leg.tokenMappingId ?? null,
        outcome: String(leg.outcome ?? '?'),
        shares18: parseDecimal18(String(leg.shares18 ?? '0')),
        minOrderSize18: leg.minOrderSize18 ?? null,
      })),
      payoutFeeBps: feeConfig.payoutFeeBps,
      ratioBps: config.ratioBps,
    })

    // ── I/O：取每条需买入腿的盘口，算成本 ────────────────────────────────
    const outcomes: OutcomeExposure[] = []
    let hedgeCost = 0n
    let priceUnavailable = false

    for (const leg of plan.legs) {
      let bestAsk: number | null = null
      let depthSufficient = false
      if (leg.targetShares18 > 0n) {
        try {
          const book = await this.polymarket.getOrderBook(leg.tokenId)
          const asks = (book.asks ?? [])
            .map((level: { price: string; size: string }) => ({ price: Number(level.price), size: Number(level.size) }))
            .filter((level) => Number.isFinite(level.price) && level.price > 0 && level.price <= 1)
          if (asks.length) {
            asks.sort((a, b) => a.price - b.price)
            bestAsk = asks[0].price
            depthSufficient = asks.reduce((sum, level) => sum + level.size, 0) >= Number(leg.targetShares18) / 1e18
          } else if (book.lastTradePrice) {
            bestAsk = Number(book.lastTradePrice)
          }
        } catch {
          priceUnavailable = true
        }
      }

      let legCost = 0n
      if (leg.targetShares18 > 0n && bestAsk !== null) {
        legCost = hedgeCostAtomic(leg.targetShares18, parseDecimal18(bestAsk.toFixed(18)))
        hedgeCost += legCost
      }

      outcomes.push({
        tokenId: leg.tokenId,
        tokenMappingId: leg.tokenMappingId,
        outcome: leg.outcome,
        grossLiabilityAtomic: leg.grossLiabilityAtomic.toString(),
        netLiabilityAtomic: leg.netLiabilityAtomic.toString(),
        shares18: formatDecimal18(leg.shares18),
        bestAskPrice: bestAsk,
        hedgeShares18: formatDecimal18(leg.targetShares18),
        hedgeCostAtomic: legCost.toString(),
        minOrderSize18: leg.minOrderSize18,
        belowMinOrder: leg.belowMinOrder,
        bookDepthSufficient: depthSufficient,
      })
    }

    const hedgedWorst = plan.worstCaseAtomic
      + (plan.maxNetLiabilityAtomic - plan.minNetLiabilityAtomic)
      - hedgeCost
    const hasHedgeableLeg = plan.legs.some((leg: HedgeLegPlan) => leg.targetShares18 > 0n && !leg.belowMinOrder)

    let skipReason: string | null = null
    let hedgeRequired = false
    if (plan.legs.length === 0) {
      skipReason = 'no_open_bets'
    } else if (plan.worstCaseAtomic >= 0n) {
      skipReason = 'no_downside' // 任何结果下平台都盈利，无需对冲
    } else if (-plan.worstCaseAtomic < config.minLossAtomic) {
      skipReason = 'below_hedge_threshold'
    } else if (priceUnavailable) {
      skipReason = 'price_unavailable'
    } else if (!hasHedgeableLeg) {
      skipReason = 'below_min_order_size'
    } else {
      hedgeRequired = true
    }

    return {
      marketMappingId: String(market.marketMappingId),
      question: String(market.question),
      slug: String(market.slug),
      openBets: Number(totals?.openBets ?? 0),
      collectedAtomic: plan.collectedAtomic.toString(),
      placeFeeAtomic: String(totals?.placeFeeAtomic ?? '0'),
      outcomes,
      worstCaseAtomic: plan.worstCaseAtomic.toString(),
      bestCaseAtomic: plan.bestCaseAtomic.toString(),
      fullHedgeCostAtomic: hedgeCost.toString(),
      hedgedWorstCaseAtomic: hedgedWorst.toString(),
      hedgeRequired,
      skipReason,
    }
  }

  /** 全平台敞口汇总（管理台用） */
  async summary() {
    const exposures = await this.marketExposures()
    const config = predictionHedgeConfig()
    const totalWorst = exposures.reduce((sum, e) => sum + BigInt(e.worstCaseAtomic), 0n)
    const totalHedgedWorst = exposures.reduce((sum, e) => sum + BigInt(e.hedgedWorstCaseAtomic), 0n)
    const totalHedgeCost = exposures.reduce((sum, e) => sum + BigInt(e.fullHedgeCostAtomic), 0n)
    return {
      config: { ...config, minLossAtomic: config.minLossAtomic.toString() },
      markets: exposures.length,
      marketsAtRisk: exposures.filter((e) => BigInt(e.worstCaseAtomic) < 0n).length,
      marketsNeedingHedge: exposures.filter((e) => e.hedgeRequired).length,
      totalWorstCaseAtomic: totalWorst.toString(),
      totalHedgedWorstCaseAtomic: totalHedgedWorst.toString(),
      totalHedgeCostAtomic: totalHedgeCost.toString(),
      items: exposures,
    }
  }
}
