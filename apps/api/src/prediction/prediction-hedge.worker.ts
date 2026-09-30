import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { PredictionExposureService, predictionHedgeConfig, type MarketExposure } from './prediction-exposure.service'

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/**
 * 对冲 worker（第 2 期：干跑）。
 *
 * 每轮核算所有未结算市场的方向性敞口，把"应下多少对冲单"写进
 * app.prediction_hedge_decisions（mode = 'dry_run'），**不连接 CLOB、不下任何真实订单**。
 *
 * 落库规则：
 * - 需要买入的腿 → state='planned'，target_shares = 建议买入份额
 * - 评估后决定不对冲的市场 → 每个市场留一条 state='skipped' 的汇总记录（target=0 + 原因），
 *   便于运营看到"为什么没下"。
 *
 * 默认关闭；开启需 PREDICTION_HEDGE_WORKER_ENABLED=true。
 * 若误设 PREDICTION_HEDGE_MODE=live，本 worker 仍只跑干跑并告警 —— 真实下单执行器
 * 属于后续阶段，尚未实现（见 polymarket.service.ts 的 assertTradingEnabled 硬闸）。
 */
@Injectable()
export class PredictionHedgeWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(PredictionHedgeWorker.name)
  private readonly enabled: boolean
  private readonly configuredMode: string
  private readonly pollMs: number
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly exposure: PredictionExposureService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('PREDICTION_HEDGE_WORKER_ENABLED') === 'true'
    this.configuredMode = config.get<string>('PREDICTION_HEDGE_MODE') ?? 'dry_run'
    this.pollMs = boundedInteger(config.get<string>('PREDICTION_HEDGE_WORKER_POLL_MS'), 300_000, 15_000, 3_600_000)
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
    if (this.configuredMode !== 'dry_run') {
      this.log.warn(
        `PREDICTION_HEDGE_MODE=${this.configuredMode} ignored: live hedge execution is not implemented yet. Running dry-run only.`,
      )
    }
    this.timer = setInterval(() => void this.tick(), this.pollMs)
    this.timer.unref()
    void this.tick()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.warn(`prediction hedge tick failed: ${String(error).slice(0, 200)}`)
    } finally {
      this.running = false
    }
  }

  /** 跑一轮核算并落干跑决策，返回写入的决策条数 */
  async runOnce(): Promise<number> {
    const exposures = await this.exposure.marketExposures()
    if (exposures.length === 0) {
      this.log.log('prediction hedge dry-run: no open bets')
      return 0
    }

    const ratioBps = predictionHedgeConfig().ratioBps
    let written = 0
    let needing = 0
    let worstTotal = 0n

    for (const market of exposures) {
      worstTotal += BigInt(market.worstCaseAtomic)
      if (market.hedgeRequired) {
        needing += 1
        written += await this.recordPlan(market, ratioBps)
      } else {
        written += await this.recordSkip(market, ratioBps)
      }
    }

    this.log.log(
      `prediction hedge dry-run: ${exposures.length} market(s), ${needing} needing hedge, `
      + `worst=${worstTotal.toString()} atomic, ${written} decision(s) recorded`,
    )
    return written
  }

  /** 需要买入的腿逐条落 planned 决策 */
  private async recordPlan(market: MarketExposure, ratioBps: number): Promise<number> {
    let n = 0
    for (const outcome of market.outcomes) {
      if (outcome.hedgeShares18 === '0') continue
      if (outcome.bestAskPrice === null) continue
      await this.insert({
        market,
        tokenId: outcome.tokenId,
        tokenMappingId: outcome.tokenMappingId,
        outcome: outcome.outcome,
        targetShares: outcome.hedgeShares18,
        limitPrice: outcome.bestAskPrice.toFixed(18),
        estCostAtomic: outcome.hedgeCostAtomic,
        minOrderSize18: outcome.minOrderSize18,
        ratioBps,
        state: 'planned',
        skipReason: null,
        depthSufficient: outcome.bookDepthSufficient,
      })
      n += 1
    }
    return n
  }

  /** 不需要对冲的市场留一条可解释的 skipped 记录 */
  private async recordSkip(market: MarketExposure, ratioBps: number): Promise<number> {
    const heaviest = market.outcomes.reduce<typeof market.outcomes[number] | null>(
      (max, leg) => (max === null || BigInt(leg.netLiabilityAtomic) > BigInt(max.netLiabilityAtomic) ? leg : max),
      null,
    )
    if (!heaviest) return 0

    await this.insert({
      market,
      tokenId: heaviest.tokenId,
      tokenMappingId: heaviest.tokenMappingId,
      outcome: heaviest.outcome,
      targetShares: '0',
      limitPrice: (heaviest.bestAskPrice ?? 0.000001).toFixed(18),
      estCostAtomic: '0',
      minOrderSize18: heaviest.minOrderSize18,
      ratioBps,
      state: 'skipped',
      skipReason: market.skipReason ?? 'not_required',
      depthSufficient: heaviest.bookDepthSufficient,
    })
    return 1
  }

  private async insert(input: {
    market: MarketExposure
    tokenId: string
    tokenMappingId: string | null
    outcome: string
    targetShares: string
    limitPrice: string
    estCostAtomic: string
    minOrderSize18: string | null
    ratioBps: number
    state: 'planned' | 'skipped'
    skipReason: string | null
    depthSufficient: boolean
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO app.prediction_hedge_decisions
        (market_mapping_id, token_mapping_id, token_id, outcome, side, target_shares, limit_price,
         est_cost_atomic, min_order_size, hedge_ratio_bps, mode, state, skip_reason,
         exposure_before, exposure_after)
       VALUES ($1, $2, $3, $4, 'BUY', $5, $6, $7, $8, $9, 'dry_run', $10, $11, $12, $13)`,
      [
        input.market.marketMappingId,
        input.tokenMappingId,
        input.tokenId,
        input.outcome,
        input.targetShares,
        input.limitPrice,
        input.estCostAtomic,
        input.minOrderSize18,
        input.ratioBps,
        input.state,
        input.skipReason,
        JSON.stringify({
          collectedAtomic: input.market.collectedAtomic,
          worstCaseAtomic: input.market.worstCaseAtomic,
          bestCaseAtomic: input.market.bestCaseAtomic,
          openBets: input.market.openBets,
        }),
        JSON.stringify({
          hedgedWorstCaseAtomic: input.market.hedgedWorstCaseAtomic,
          fullHedgeCostAtomic: input.market.fullHedgeCostAtomic,
          bookDepthSufficient: input.depthSufficient,
        }),
      ],
    )
  }

  /** 管理台：最近一批干跑决策 */
  async recentDecisions(limit = 50) {
    return this.dataSource.query(
      `SELECT d.id::text, d.market_mapping_id::text AS "marketId", m.question,
              d.outcome, d.side, d.target_shares::text AS "targetShares",
              d.limit_price::text AS "limitPrice", d.est_cost_atomic::text AS "estCostAtomic",
              d.min_order_size::text AS "minOrderSize", d.mode, d.state,
              d.skip_reason AS "skipReason", d.created_at AS "createdAt"
       FROM app.prediction_hedge_decisions d
       JOIN app.polymarket_market_mappings m ON m.id = d.market_mapping_id
       ORDER BY d.created_at DESC
       LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    )
  }
}
