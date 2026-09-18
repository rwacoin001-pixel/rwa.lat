import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { JobQueueService } from '../job-queue/job-queue.service'
import { BASKET_OPS_QUEUE } from './basket.constants'
import { BasketNavService } from './basket.nav.service'
import { BasketRebalanceService } from './rebalance.service'

export type BasketOpsJobKind = 'nav-batch' | 'drift-scan'
export function isBasketOpsJobKind(value: unknown): value is BasketOpsJobKind {
  return value === 'nav-batch' || value === 'drift-scan'
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown basket ops error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

function bucket(now: Date, window: '6h' | 'day'): string {
  const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  return window === 'day' ? day : `${day}${Math.floor(now.getUTCHours() / 6)}`
}

/**
 * Basket 运维 Worker：
 * - nav-batch：每 6 小时刷新所有 pilot/active 组合的 NAV 快照
 * - drift-scan：每日扫描漂移；BASKET_REBALANCE_MODE=auto 时自动生成调仓计划（仅计划，不执行）
 * - 门控：BASKET_OPS_WORKER_ENABLED=true 且 BASKET_OPS_ENABLED=true
 */
@Injectable()
export class BasketOpsWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BasketOpsWorker.name)
  private readonly workerEnabled: boolean
  private readonly opsEnabled: boolean
  private readonly rebalanceMode: string
  private readonly pollMs: number
  private readonly leaseSeconds: number
  private readonly workerId = `${hostname()}:${process.pid}:basket-ops:${randomUUID()}`.slice(0, 128)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly queue: JobQueueService,
    private readonly nav: BasketNavService,
    private readonly rebalance: BasketRebalanceService,
    private readonly dataSource: import('typeorm').DataSource,
    config: ConfigService,
  ) {
    this.workerEnabled = config.get<string>('BASKET_OPS_WORKER_ENABLED') === 'true'
    this.opsEnabled = config.get<string>('BASKET_OPS_ENABLED') === 'true'
    this.rebalanceMode = (config.get<string>('BASKET_REBALANCE_MODE') ?? 'manual').trim().toLowerCase()
    this.pollMs = boundedInteger(config.get<string>('BASKET_OPS_WORKER_POLL_MS'), 30_000, 10_000, 300_000)
    this.leaseSeconds = boundedInteger(config.get<string>('BASKET_OPS_QUEUE_LEASE_SECONDS'), 600, 120, 1_800)
  }

  onApplicationBootstrap() {
    if (!this.workerEnabled) return
    this.timer = setInterval(() => void this.tick(), this.pollMs)
    this.timer.unref()
    void this.tick()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async runOnce(): Promise<number> {
    if (!this.opsEnabled) return 0
    await this.schedule()
    return this.drain()
  }

  private async schedule(): Promise<void> {
    const now = new Date()
    const planned: Array<{ kind: BasketOpsJobKind; dedupKey: string; delayMs: number }> = [
      { kind: 'nav-batch', dedupKey: `basket-ops:nav:${bucket(now, '6h')}`, delayMs: 0 },
      { kind: 'drift-scan', dedupKey: `basket-ops:drift:${bucket(now, 'day')}`, delayMs: 240_000 },
    ]
    for (const item of planned) {
      try {
        await this.queue.enqueue({ queueName: BASKET_OPS_QUEUE, payload: { kind: item.kind }, dedupKey: item.dedupKey, maxAttempts: 3, runAt: new Date(now.getTime() + item.delayMs) })
      } catch (error) {
        this.log.warn(`enqueue ${item.kind} failed: ${safeError(error)}`)
      }
    }
  }

  private async drain(): Promise<number> {
    const jobs = await this.queue.claim(BASKET_OPS_QUEUE, 1, new Date(), { workerId: this.workerId, leaseSeconds: this.leaseSeconds })
    for (const job of jobs) {
      const kind = job.payload.kind
      if (!isBasketOpsJobKind(kind)) {
        await this.queue.nack(job.id, `Invalid basket ops kind: ${String(kind)}`, new Date(), this.workerId)
        continue
      }
      try {
        if (kind === 'nav-batch') await this.runNavBatch()
        else await this.runDriftScan(typeof job.payload.portfolioId === 'string' ? job.payload.portfolioId : undefined)
        await this.queue.ack(job.id, new Date(), this.workerId)
      } catch (error) {
        await this.queue.nack(job.id, safeError(error), new Date(), this.workerId)
      }
    }
    return jobs.length
  }

  private async activePortfolios(portfolioId?: string): Promise<Array<{ id: string }>> {
    if (portfolioId) return [{ id: portfolioId }]
    return this.dataSource.query(`SELECT id FROM app.basket_portfolios WHERE status IN ('pilot', 'active') ORDER BY created_at`) as Promise<Array<{ id: string }>>
  }

  async runNavBatch(portfolioId?: string): Promise<number> {
    const portfolios = await this.activePortfolios(portfolioId)
    let ok = 0
    for (const portfolio of portfolios) {
      try {
        await this.nav.computeNav(portfolio.id)
        ok += 1
      } catch (error) {
        this.log.warn(`nav-batch failed for ${portfolio.id}: ${safeError(error)}`)
      }
    }
    this.log.log(`nav-batch computed ${ok}/${portfolios.length} portfolios`)
    return ok
  }

  async runDriftScan(portfolioId?: string): Promise<number> {
    const portfolios = await this.activePortfolios(portfolioId)
    let planned = 0
    for (const portfolio of portfolios) {
      try {
        const drift = await this.rebalance.detectDrift(portfolio.id)
        if (!drift.needsRebalance) continue
        if (this.rebalanceMode !== 'auto') {
          this.log.log(`drift detected on ${portfolio.id} (${drift.maxAbsDriftPct}%) — auto-planning disabled (mode=${this.rebalanceMode})`)
          continue
        }
        await this.rebalance.planRebalance(portfolio.id, { trigger: 'scheduled' })
        planned += 1
      } catch (error) {
        this.log.warn(`drift-scan failed for ${portfolio.id}: ${safeError(error)}`)
      }
    }
    this.log.log(`drift-scan complete: ${planned} plan(s) created`)
    return planned
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.error(`basket ops poll failed: ${safeError(error)}`)
    } finally {
      this.running = false
    }
  }
}
