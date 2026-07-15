import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { JobQueueService } from '../job-queue/job-queue.service'
import { WalletService } from './wallet.service'

export const WITHDRAWAL_EXECUTION_QUEUE = 'wallet-withdrawal-execution'

@Injectable()
export class WithdrawalExecutionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(WithdrawalExecutionWorker.name)
  private readonly enabled: boolean
  private readonly pollMs: number
  private readonly leaseSeconds: number
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`.slice(0, 128)
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly queue: JobQueueService,
    private readonly wallet: WalletService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('WALLET_EXECUTION_WORKER_ENABLED') === 'true'
    this.pollMs = boundedInteger(config.get<string>('WALLET_EXECUTION_WORKER_POLL_MS'), 5_000, 1_000, 60_000)
    this.leaseSeconds = boundedInteger(config.get<string>('WALLET_EXECUTION_QUEUE_LEASE_SECONDS'), 300, 60, 900)
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

  async runOnce(): Promise<number> {
    if (!await this.wallet.canProcessExecutionQueue()) return 0
    const jobs = await this.queue.claim(
      WITHDRAWAL_EXECUTION_QUEUE,
      1,
      new Date(),
      { workerId: this.workerId, leaseSeconds: this.leaseSeconds },
    )
    for (const job of jobs) {
      const withdrawalId = typeof job.payload.withdrawalId === 'string' ? job.payload.withdrawalId : ''
      if (!withdrawalId) {
        await this.queue.nack(job.id, 'Invalid withdrawal execution payload', new Date(), this.workerId)
        continue
      }
      try {
        await this.wallet.executeQueuedWithdrawal(
          withdrawalId,
          this.workerId,
          `withdrawal-worker:${job.id}`,
        )
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
      this.log.error(`Withdrawal execution poll failed: ${safeError(error)}`)
    } finally {
      this.running = false
    }
  }
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown withdrawal execution error'
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}
