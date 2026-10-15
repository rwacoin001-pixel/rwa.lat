import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PredictionService } from './prediction.service'
import { PredictionResolutionService } from './prediction-resolution.service'

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/**
 * 先核对待结算市场的最终结果，再逐个原子结算（幂等）。
 * worker 默认关闭；新结果同步另以 PREDICTION_RESOLUTION_SYNC_MODE=apply 明确启用。
 */
@Injectable()
export class PredictionSettlementWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(PredictionSettlementWorker.name)
  private readonly enabled: boolean
  private readonly pollMs: number
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly prediction: PredictionService,
    config: ConfigService,
    private readonly resolution: PredictionResolutionService,
  ) {
    this.enabled = config.get<string>('PREDICTION_SETTLEMENT_WORKER_ENABLED') === 'true'
    this.pollMs = boundedInteger(
      config.get<string>('PREDICTION_SETTLEMENT_WORKER_POLL_MS'),
      300_000,
      10_000,
      3_600_000,
    )
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
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
      this.log.warn(`prediction settlement tick failed: ${String(error).slice(0, 200)}`)
    } finally {
      this.running = false
    }
  }

  async runOnce(): Promise<number> {
    await this.resolution.syncPendingMarkets()
    const marketIds = await this.prediction.findSettleableMarkets(5)
    let settled = 0
    for (const marketId of marketIds) {
      try {
        const result = await this.prediction.settleMarket(marketId)
        if (result.settled) settled += 1
      } catch (error) {
        this.log.warn(`prediction settle failed market=${marketId}: ${String(error).slice(0, 200)}`)
      }
    }
    if (settled > 0) this.log.log(`prediction settlement run settled ${settled} market(s)`)
    return settled
  }
}
