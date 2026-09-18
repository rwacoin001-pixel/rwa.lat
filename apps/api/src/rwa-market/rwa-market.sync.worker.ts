import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { JobQueueService } from '../job-queue/job-queue.service'
import { RWA_MARKET_SYNC_QUEUE, isRwaSyncKind, type RwaSyncKind } from './rwa-market.constants'
import { RwaMarketSyncService } from './rwa-market.sync.service'

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown rwa sync error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

function dayBucket(now: Date): string {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
}

function hourBucket(now: Date): string {
  return `${dayBucket(now)}${String(now.getUTCHours()).padStart(2, '0')}`
}

/**
 * RWA 目录同步 Worker（job_queue 样板同 wallet/withdrawal-execution.worker.ts）：
 * - 调度：issuers/assets/snapshot 每日一次；metrics 每小时一次（dedupKey 分桶去重）
 * - 执行：claim → runSync(kind) → ack/nack
 * - 门控：RWA_SYNC_WORKER_ENABLED=true 且 RWA_SYNC_ENABLED=true（生产默认 false，由运维显式开启）
 */
@Injectable()
export class RwaMarketSyncWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(RwaMarketSyncWorker.name)
  private readonly workerEnabled: boolean
  private readonly syncEnabled: boolean
  private readonly cmcEnabled: boolean
  private readonly pollMs: number
  private readonly leaseSeconds: number
  private readonly workerId = `${hostname()}:${process.pid}:rwa-sync:${randomUUID()}`.slice(0, 128)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly queue: JobQueueService,
    private readonly sync: RwaMarketSyncService,
    config: ConfigService,
  ) {
    this.workerEnabled = config.get<string>('RWA_SYNC_WORKER_ENABLED') === 'true'
    this.syncEnabled = config.get<string>('RWA_SYNC_ENABLED') === 'true'
    this.cmcEnabled = config.get<string>('RWA_SYNC_CMC_ENABLED') === 'true'
    this.pollMs = boundedInteger(config.get<string>('RWA_SYNC_WORKER_POLL_MS'), 15_000, 5_000, 120_000)
    this.leaseSeconds = boundedInteger(config.get<string>('RWA_SYNC_QUEUE_LEASE_SECONDS'), 1_200, 300, 1_800)
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
    if (!this.syncEnabled) return 0
    await this.schedule()
    return this.drain()
  }

  /** 周期性入队（dedupKey 分桶保证一天/一小时只跑一次） */
  private async schedule(): Promise<void> {
    if (!this.cmcEnabled) return
    const now = new Date()
    const day = dayBucket(now)
    const hour = hourBucket(now)
    // 说明：metrics-full / snapshot 不在时间表里延迟触发（会与全量 assets 撞 advisory lock），
    // 改为 assets 成功后链式入队（见 drain）；此处仅保留独立轻任务。
    const planned: Array<{ kind: RwaSyncKind; dedupKey: string; delayMs: number; maxItems?: number }> = [
      { kind: 'issuers', dedupKey: `rwa-sync:issuers:${day}`, delayMs: 0 },
      { kind: 'assets', dedupKey: `rwa-sync:assets:${day}`, delayMs: 90_000 },
      { kind: 'metrics', dedupKey: `rwa-sync:metrics-hour:${hour}`, delayMs: 0, maxItems: 1000 },
    ]
    for (const item of planned) {
      try {
        await this.queue.enqueue({
          queueName: RWA_MARKET_SYNC_QUEUE,
          payload: item.maxItems
            ? { kind: item.kind, maxItems: item.maxItems, scheduled: true }
            : { kind: item.kind, scheduled: true },
          dedupKey: item.dedupKey,
          maxAttempts: 3,
          runAt: new Date(now.getTime() + item.delayMs),
        })
      } catch (error) {
        this.log.warn(`enqueue ${item.kind} failed: ${safeError(error)}`)
      }
    }
  }

  private async drain(): Promise<number> {
    const jobs = await this.queue.claim(RWA_MARKET_SYNC_QUEUE, 1, new Date(), {
      workerId: this.workerId,
      leaseSeconds: this.leaseSeconds,
    })
    for (const job of jobs) {
      const kind = job.payload.kind
      const maxItems = typeof job.payload.maxItems === 'number' && Number.isFinite(job.payload.maxItems)
        ? Math.max(1, Math.trunc(job.payload.maxItems as number))
        : undefined
      if (!isRwaSyncKind(kind)) {
        await this.queue.nack(job.id, `Invalid rwa sync kind: ${String(kind)}`, new Date(), this.workerId)
        continue
      }
      try {
        const summary = await this.sync.run(kind, { maxItems })
        if (summary.status === 'failed') {
          await this.queue.nack(job.id, `RWA sync ${kind} failed (0/${summary.itemsTotal} upserted)`, new Date(), this.workerId)
        } else {
          await this.queue.ack(job.id, new Date(), this.workerId)
          // 链式：assets 成功后立即（去重键按天）追加入队 metrics-full 与 snapshot
          if (kind === 'assets') {
            await this.chainAfterAssets()
          }
        }
      } catch (error) {
        await this.queue.nack(job.id, safeError(error), new Date(), this.workerId)
      }
    }
    return jobs.length
  }

  private async chainAfterAssets(): Promise<void> {
    const now = new Date()
    const day = dayBucket(now)
    try {
      await this.queue.enqueue({
        queueName: RWA_MARKET_SYNC_QUEUE,
        payload: { kind: 'metrics', scheduled: true },
        dedupKey: `rwa-sync:metrics-full:${day}`,
        maxAttempts: 3,
        runAt: now,
      })
      await this.queue.enqueue({
        queueName: RWA_MARKET_SYNC_QUEUE,
        payload: { kind: 'snapshot', scheduled: true },
        dedupKey: `rwa-sync:snapshot:${day}`,
        maxAttempts: 3,
        runAt: new Date(now.getTime() + 60_000),
      })
      this.log.log('chained metrics-full + snapshot after assets sync')
    } catch (error) {
      this.log.warn(`chain enqueue failed: ${safeError(error)}`)
    }
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.error(`RWA sync poll failed: ${safeError(error)}`)
    } finally {
      this.running = false
    }
  }
}
