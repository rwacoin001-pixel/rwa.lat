import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { JobQueueService } from '../job-queue/job-queue.service'
import { AiAnalysisProvider } from './ai-analysis.provider'
import { AiAnalysisService } from './ai-analysis.service'
import { ScoringService } from './scoring.service'

export const RWA_ANALYSIS_QUEUE = 'rwa-analysis'

export type RwaAnalysisJobKind = 'score-batch' | 'ai-batch'
export function isRwaAnalysisJobKind(value: unknown): value is RwaAnalysisJobKind {
  return value === 'score-batch' || value === 'ai-batch'
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown rwa analysis error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

function bucket(now: Date, window: '6h' | 'day'): string {
  const day = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  if (window === 'day') return day
  return `${day}${Math.floor(now.getUTCHours() / 6)}`
}

/**
 * 分析与评分 Worker（job_queue 样板）：
 * - score-batch 每 6 小时（跟随行情同步刷新，无外部 credit 消耗）
 * - ai-batch 每日一次（DeepSeek；RWA_AI_ENABLED=true 时）
 * - 门控：RWA_ANALYSIS_WORKER_ENABLED=true 且 RWA_ANALYSIS_ENABLED=true
 */
@Injectable()
export class RwaAnalysisWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(RwaAnalysisWorker.name)
  private readonly workerEnabled: boolean
  private readonly analysisEnabled: boolean
  private readonly aiEnabled: boolean
  private readonly pollMs: number
  private readonly leaseSeconds: number
  private readonly workerId = `${hostname()}:${process.pid}:rwa-analysis:${randomUUID()}`.slice(0, 128)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly queue: JobQueueService,
    private readonly scoring: ScoringService,
    private readonly ai: AiAnalysisService,
    private readonly aiProvider: AiAnalysisProvider,
    config: ConfigService,
  ) {
    this.workerEnabled = config.get<string>('RWA_ANALYSIS_WORKER_ENABLED') === 'true'
    this.analysisEnabled = config.get<string>('RWA_ANALYSIS_ENABLED') === 'true'
    this.aiEnabled = config.get<string>('RWA_AI_ENABLED') === 'true'
    this.pollMs = boundedInteger(config.get<string>('RWA_ANALYSIS_WORKER_POLL_MS'), 20_000, 5_000, 120_000)
    this.leaseSeconds = boundedInteger(config.get<string>('RWA_ANALYSIS_QUEUE_LEASE_SECONDS'), 600, 120, 1_800)
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
    if (!this.analysisEnabled) return 0
    await this.schedule()
    return this.drain()
  }

  private async schedule(): Promise<void> {
    const now = new Date()
    const planned: Array<{ kind: RwaAnalysisJobKind; dedupKey: string; delayMs: number; limit?: number }> = [
      { kind: 'score-batch', dedupKey: `rwa-analysis:score:${bucket(now, '6h')}`, delayMs: 0, limit: 1000 },
    ]
    if (this.aiEnabled && this.aiProvider.isConfigured()) {
      planned.push({ kind: 'ai-batch', dedupKey: `rwa-analysis:ai:${bucket(now, 'day')}`, delayMs: 120_000, limit: 12 })
    }
    for (const item of planned) {
      try {
        await this.queue.enqueue({
          queueName: RWA_ANALYSIS_QUEUE,
          payload: { kind: item.kind, ...(item.limit ? { limit: item.limit } : {}) },
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
    const jobs = await this.queue.claim(RWA_ANALYSIS_QUEUE, 1, new Date(), {
      workerId: this.workerId,
      leaseSeconds: this.leaseSeconds,
    })
    for (const job of jobs) {
      const kind = job.payload.kind
      const limit = typeof job.payload.limit === 'number' && Number.isFinite(job.payload.limit)
        ? Math.max(1, Math.trunc(job.payload.limit as number))
        : undefined
      if (!isRwaAnalysisJobKind(kind)) {
        await this.queue.nack(job.id, `Invalid rwa analysis kind: ${String(kind)}`, new Date(), this.workerId)
        continue
      }
      try {
        if (kind === 'score-batch') {
          const result = await this.scoring.runBatch(limit ?? 1000)
          this.log.log(`score-batch scored ${result.scored}/${result.scanned}`)
        } else {
          const result = await this.ai.runBatch(limit ?? 12)
          this.log.log(`ai-batch analyzed ${result.analyzed}, failed ${result.failed}`)
        }
        await this.queue.ack(job.id, new Date(), this.workerId)
      } catch (error) {
        await this.queue.nack(job.id, safeError(error), new Date(), this.workerId)
      }
    }
    return jobs.length
  }

  private async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.runOnce()
    } catch (error) {
      this.log.error(`rwa analysis poll failed: ${safeError(error)}`)
    } finally {
      this.running = false
    }
  }
}
