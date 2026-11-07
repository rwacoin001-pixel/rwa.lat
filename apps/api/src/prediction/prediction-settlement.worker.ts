import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PredictionService } from './prediction.service'
import { PredictionResolutionService } from './prediction-resolution.service'
import { randomUUID } from 'node:crypto'
import { PredictionSettlementMonitorService, type SettlementJob } from './prediction-settlement-monitor.service'

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
  private readonly workerId = `prediction:${randomUUID()}`

  constructor(
    private readonly prediction: PredictionService,
    config: ConfigService,
    private readonly resolution: PredictionResolutionService,
    private readonly monitor: PredictionSettlementMonitorService,
  ) {
    this.enabled = config.get<string>('PREDICTION_SETTLEMENT_WORKER_ENABLED') === 'true'
    this.pollMs = boundedInteger(
      config.get<string>('PREDICTION_SETTLEMENT_WORKER_POLL_MS'),
      60_000,
      10_000,
      3_600_000,
    )
  }

  onApplicationBootstrap() {
    if (!this.enabled) { void this.monitor.beat(false, { running: false }).catch(() => this.log.warn('Prediction heartbeat write failed')); return }
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
      await this.monitor.beat(true, { running: true, startedAt: new Date().toISOString() })
      await this.runOnce()
      await this.monitor.beat(true, { running: false, lastSuccessAt: new Date().toISOString(), lastError: null })
    } catch (error) {
      this.log.warn('prediction settlement tick failed; retry on next pass')
      await this.monitor.beat(true, { running: false, lastError: 'settlement-cycle-failed' }).catch(() => this.log.warn('Prediction heartbeat write failed'))
    } finally {
      this.running = false
    }
  }

  async runOnce(): Promise<number> {
    await this.monitor.seed()
    const deadline = Date.now() + 20_000
    let settled = 0
    let processed = 0
    while (Date.now() < deadline && processed < 20) {
      const jobs = await this.monitor.claim(this.workerId)
      if (!jobs.length) break
      const results = await Promise.allSettled(jobs.map(job => this.process(job)))
      if (results.some(result => result.status === 'rejected')) throw new Error('Settlement task state could not be saved')
      settled += results.filter(result => result.status === 'fulfilled' && result.value).length
      processed += jobs.length
    }
    try { await this.monitor.reconcile(settled > 0) }
    catch { await this.monitor.beat(true, { auditError: true }); this.log.warn('Prediction reconciliation failed') }
    if (settled > 0) this.log.log(`prediction settlement run settled ${settled} market(s)`)
    return settled
  }

  private async process(job: SettlementJob): Promise<boolean> {
    const marketId = job.payload.marketId
    try {
      if (await this.monitor.alreadySettled(marketId)) {
        await this.monitor.finish(job, 'settled')
        return false
      }
      if (this.resolution.mode !== 'apply') {
        await this.monitor.finish(job, 'review', 'result-sync-observe-mode')
        return false
      }
      if (!await this.monitor.confirmed(marketId)) {
        const resolution = await this.resolution.syncMarket(marketId)
        if (resolution.status === 'retry') {
          await this.monitor.finish(job, 'failed', resolution.reason)
          return false
        }
        if (resolution.status === 'pending' || resolution.status === 'review') {
          await this.monitor.finish(job, resolution.status === 'pending' ? 'waiting_result' : 'review', resolution.reason)
          return false
        }
        if (!['applied', 'unchanged', 'resolved'].includes(resolution.status)) {
          await this.monitor.finish(job, 'review', 'unsupported-resolution-status')
          return false
        }
        if (!await this.monitor.confirmed(marketId)) {
          await this.monitor.finish(job, 'review', 'confirmed-result-missing')
          return false
        }
      }
      if (!await this.monitor.beginSettlement(job)) return false
      const result = await this.prediction.settleMarket(marketId)
      const complete = result.settled || await this.monitor.alreadySettled(marketId)
      await this.monitor.finish(job, complete ? 'settled' : 'failed', complete ? undefined : 'settlement-not-completed')
      return result.settled
    } catch {
      this.log.warn(`prediction settlement task failed market=${marketId}`)
      await this.monitor.finish(job, 'failed', 'settlement-task-failed')
      return false
    }
  }
}
