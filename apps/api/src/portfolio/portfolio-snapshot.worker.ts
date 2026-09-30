import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { JobQueueService } from '../job-queue/job-queue.service'
import { PortfolioService } from './portfolio.service'

export const PORTFOLIO_SNAPSHOT_QUEUE = 'portfolio-market-value-snapshot'
const SNAPSHOT_SCHEDULE_WINDOW_MS = 15 * 60_000
const SNAPSHOT_JOB_BATCH_SIZE = 5

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

function midnightUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.name + ': ' + error.message : 'Unknown portfolio snapshot error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Captures one market-value point per active portfolio each UTC day.
 * Scheduling is gated off by default and uses the durable job queue so a
 * process restart does not lose jobs once they have been enqueued.
 */
@Injectable()
export class PortfolioSnapshotWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(PortfolioSnapshotWorker.name)
  private readonly enabled: boolean
  private readonly pollMs: number
  private readonly leaseSeconds: number
  private readonly workerId = (hostname() + ':' + process.pid + ':portfolio-snapshot:' + randomUUID()).slice(0, 128)
  private timer: NodeJS.Timeout | null = null
  private running = false
  private lastScheduledDay: string | null = null

  constructor(
    private readonly queue: JobQueueService,
    private readonly dataSource: DataSource,
    private readonly portfolio: PortfolioService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('PORTFOLIO_SNAPSHOT_WORKER_ENABLED') === 'true'
    this.pollMs = boundedInteger(config.get<string>('PORTFOLIO_SNAPSHOT_WORKER_POLL_MS'), 15_000, 5_000, 120_000)
    this.leaseSeconds = boundedInteger(config.get<string>('PORTFOLIO_SNAPSHOT_QUEUE_LEASE_SECONDS'), 900, 60, 900)
  }

  onApplicationBootstrap() {
    if (!this.enabled) return
    this.log.log('Daily portfolio snapshot worker started (UTC 00:00 schedule).')
    this.timer = setInterval(() => void this.tick(), this.pollMs)
    this.timer.unref()
    void this.tick()
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async runOnce(now = new Date()): Promise<number> {
    await this.schedule(now)
    return this.drain(now)
  }

  private async schedule(now: Date): Promise<void> {
    const runAt = midnightUtc(now)
    const scheduleDay = dayKey(runAt)
    const millisecondsAfterMidnight = now.getTime() - runAt.getTime()
    if (millisecondsAfterMidnight < 0 || millisecondsAfterMidnight > SNAPSHOT_SCHEDULE_WINDOW_MS) return
    if (this.lastScheduledDay === scheduleDay) return

    const users = await this.dataSource.query(
      'SELECT DISTINCT user_id AS "userId" ' +
      'FROM app.positions ' +
      "WHERE state = 'active' AND quantity_atomic_amount > 0 " +
      'ORDER BY user_id',
    ) as Array<{ userId: string }>

    for (const { userId } of users) {
      if (!isUuid(userId)) {
        this.log.warn('Skipped a portfolio snapshot candidate with an invalid user identifier.')
        continue
      }
      const snapshotBatchId = randomUUID()
      await this.queue.enqueue({
        queueName: PORTFOLIO_SNAPSHOT_QUEUE,
        payload: { userId, snapshotBatchId },
        dedupKey: 'portfolio-snapshot:' + scheduleDay + ':' + userId,
        maxAttempts: 5,
        runAt,
      })
    }
    this.lastScheduledDay = scheduleDay
    this.log.log('Scheduled ' + users.length + ' portfolio snapshot job(s) for ' + scheduleDay + ' UTC.')
  }

  private async drain(now: Date): Promise<number> {
    const jobs = await this.queue.claim(PORTFOLIO_SNAPSHOT_QUEUE, SNAPSHOT_JOB_BATCH_SIZE, now, {
      workerId: this.workerId,
      leaseSeconds: this.leaseSeconds,
    })
    await Promise.all(jobs.map((job) => this.process(job, now)))
    return jobs.length
  }

  private async process(job: { id: string; payload: Record<string, unknown> }, now: Date): Promise<void> {
    const userId = job.payload.userId
    const snapshotBatchId = job.payload.snapshotBatchId
    if (!isUuid(userId) || !isUuid(snapshotBatchId)) {
      await this.queue.nack(job.id, 'Invalid portfolio snapshot job payload', now, this.workerId)
      return
    }
    try {
      await this.portfolio.capturePortfolioSnapshot(userId, snapshotBatchId)
      await this.queue.ack(job.id, new Date(), this.workerId)
    } catch (error) {
      try {
        await this.queue.nack(job.id, safeError(error), new Date(), this.workerId)
      } catch (queueError) {
        this.log.error('Could not release portfolio snapshot job ' + job.id + ': ' + safeError(queueError))
      }
    }
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.error('Portfolio snapshot poll failed: ' + safeError(error))
    } finally {
      this.running = false
    }
  }
}
