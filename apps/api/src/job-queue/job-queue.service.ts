import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository, IsNull } from 'typeorm'
import { JobQueueEntry, InboundCallbackEvent } from './job-queue.entities'
import { JOB_QUEUE_ERROR_CODES, JobQueueError } from './job-queue.errors'

const DEFAULT_MAX_ATTEMPTS = 5
const RETRY_BACKOFF_MS = 5_000
const DEFAULT_LEASE_SECONDS = 120

@Injectable()
export class JobQueueService {
  private readonly log = new Logger(JobQueueService.name)

  constructor(
    @InjectRepository(JobQueueEntry)
    private readonly jobs: Repository<JobQueueEntry>,
    @InjectRepository(InboundCallbackEvent)
    private readonly callbacks: Repository<InboundCallbackEvent>,
    private readonly ds: DataSource,
  ) {}

  // ---- 任务入队 ----
  /** 幂等入队：dedupKey 相同的任务不会重复创建。 */
  async enqueue(input: {
    queueName: string
    payload: Record<string, unknown>
    dedupKey?: string
    maxAttempts?: number
    runAt?: Date
  }): Promise<JobQueueEntry> {
    if (input.dedupKey) {
      const existing = await this.jobs.findOne({ where: { dedupKey: input.dedupKey } })
      if (existing) return existing
    }
    const job = this.jobs.create({
      queueName: input.queueName,
      payload: input.payload,
      dedupKey: input.dedupKey,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      runAt: input.runAt ?? new Date(),
      state: 'pending',
    })
    try {
      return await this.jobs.save(job)
    } catch (error) {
      if (input.dedupKey && isUniqueViolation(error)) {
        const raced = await this.jobs.findOne({ where: { dedupKey: input.dedupKey } })
        if (raced) return raced
      }
      throw error
    }
  }

  // ---- 乱序领取（SKIP LOCKED 避免 worker 争抢同一行） ----
  /** 从指定队列领取最多 limit 个 pending 且到期的任务，置 running。 */
  async claim(
    queueName: string,
    limit = 1,
    now: Date = new Date(),
    lease: { workerId?: string; leaseSeconds?: number } = {},
  ): Promise<JobQueueEntry[]> {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
    const leaseSeconds = Math.min(Math.max(Math.trunc(lease.leaseSeconds ?? DEFAULT_LEASE_SECONDS), 30), 900)
    const workerId = (lease.workerId?.trim() || `manual:${process.pid}`).slice(0, 128)
    return this.ds.transaction(async (tx) => {
      await tx.query(
        `UPDATE app.job_queue
            SET state = 'dead',
                last_error = COALESCE(last_error, 'Execution lease expired after maximum attempts'),
                locked_at = NULL,
                lease_expires_at = NULL,
                worker_id = NULL
          WHERE queue_name = $1
            AND state = 'running'
            AND lease_expires_at <= $2
            AND attempts >= max_attempts`,
        [queueName, now],
      )
      const raw = await tx.query(
        `UPDATE app.job_queue
           SET state = 'running', attempts = attempts + 1,
               locked_at = $2,
               lease_expires_at = $2 + make_interval(secs => $4),
               worker_id = $5,
               last_error = CASE WHEN state = 'running'
                 THEN COALESCE(last_error, 'Previous execution lease expired')
                 ELSE last_error END
           WHERE id IN (
             SELECT id FROM app.job_queue
              WHERE queue_name = $1
                AND run_at <= $2
                AND attempts < max_attempts
                AND (
                  state = 'pending'
                  OR (state = 'running' AND lease_expires_at <= $2)
                )
              ORDER BY run_at, created_at
              FOR UPDATE SKIP LOCKED
              LIMIT $3
           )
         RETURNING id, queue_name, payload, state, attempts, max_attempts,
                   last_error, dedup_key, run_at, created_at, completed_at,
                   locked_at, lease_expires_at, worker_id`,
        [queueName, now, boundedLimit, leaseSeconds, workerId],
      )
      const rows = queryRows(raw)
      this.log.debug(`Claimed ${rows.length} job(s) from ${queueName}`)
      return rows.map(mapJobRow)
    })
  }

  /** 确认完成：state -> completed。 */
  async ack(jobId: string, now: Date = new Date(), workerId?: string): Promise<JobQueueEntry> {
    const job = await this.jobs.findOne({ where: { id: jobId } })
    if (!job) throw new JobQueueError(JOB_QUEUE_ERROR_CODES.JOB_NOT_FOUND, 'Job not found', 404)
    this.assertLeaseOwner(job, workerId, now)
    job.state = 'completed'
    job.completedAt = now
    job.lockedAt = null
    job.leaseExpiresAt = null
    job.workerId = null
    return this.jobs.save(job)
  }

  /** 失败：超过 max_attempts -> dead（死信）；否则退回 pending 并指数退避。 */
  async nack(jobId: string, error: string, now: Date = new Date(), workerId?: string): Promise<JobQueueEntry> {
    const job = await this.jobs.findOne({ where: { id: jobId } })
    if (!job) throw new JobQueueError(JOB_QUEUE_ERROR_CODES.JOB_NOT_FOUND, 'Job not found', 404)
    this.assertLeaseOwner(job, workerId, now)
    job.lastError = error
    if (job.attempts >= job.maxAttempts) {
      job.state = 'dead'
      this.log.error(`Job ${jobId} entered dead-letter: ${error}`)
    } else {
      job.state = 'pending'
      job.runAt = new Date(now.getTime() + RETRY_BACKOFF_MS * Math.pow(2, job.attempts - 1))
    }
    job.lockedAt = null
    job.leaseExpiresAt = null
    job.workerId = null
    return this.jobs.save(job)
  }

  async heartbeat(jobId: string, workerId: string, leaseSeconds = DEFAULT_LEASE_SECONDS, now: Date = new Date()): Promise<JobQueueEntry> {
    const boundedLease = Math.min(Math.max(Math.trunc(leaseSeconds), 30), 900)
    const raw = await this.ds.query(
      `UPDATE app.job_queue
          SET lease_expires_at = $3 + make_interval(secs => $4)
        WHERE id = $1 AND state = 'running' AND worker_id = $2
          AND lease_expires_at > $3
        RETURNING id, queue_name, payload, state, attempts, max_attempts,
                  last_error, dedup_key, run_at, created_at, completed_at,
                  locked_at, lease_expires_at, worker_id`,
      [jobId, workerId, now, boundedLease],
    )
    const row = queryRows(raw)[0]
    if (!row) throw new JobQueueError(JOB_QUEUE_ERROR_CODES.JOB_LEASE_LOST, 'Job execution lease is no longer owned by this worker', 409)
    return mapJobRow(row)
  }

  async listByState(queueName: string, state?: string, limit = 50): Promise<JobQueueEntry[]> {
    const where: any = { queueName }
    if (state) where.state = state
    return this.jobs.find({ where, order: { createdAt: 'DESC' }, take: limit })
  }

  /** 死信告警出口：列出所有 dead 任务，供报警消费者读取。 */
  async listDead(queueName: string, limit = 50): Promise<JobQueueEntry[]> {
    return this.jobs.find({ where: { queueName, state: 'dead' }, order: { createdAt: 'DESC' }, take: limit })
  }

  /** 重放：将 dead 任务重置为 pending（人工干预后重跑）。 */
  async replay(jobId: string, maxAttempts?: number): Promise<JobQueueEntry> {
    const job = await this.jobs.findOne({ where: { id: jobId } })
    if (!job) throw new JobQueueError(JOB_QUEUE_ERROR_CODES.JOB_NOT_FOUND, 'Job not found', 404)
    job.state = 'pending'
    job.attempts = 0
    job.lastError = null
    job.runAt = new Date()
    job.completedAt = null
    job.lockedAt = null
    job.leaseExpiresAt = null
    job.workerId = null
    if (maxAttempts) job.maxAttempts = maxAttempts
    return this.jobs.save(job)
  }

  // ---- 回调消费 ----
  /** 接收外部回调，落盘去重（partner+external_id 唯一），返回事件记录。 */
  async receiveCallback(input: {
    partner: string
    eventType: string
    externalId: string
    payload: Record<string, unknown>
    signatureOk: boolean
  }): Promise<InboundCallbackEvent> {
    const existing = await this.callbacks.findOne({ where: { partner: input.partner, externalId: input.externalId } })
    if (existing) {
      throw new JobQueueError(JOB_QUEUE_ERROR_CODES.CALLBACK_DUPLICATE, 'Duplicate callback', 409)
    }
    const evt = this.callbacks.create({
      partner: input.partner,
      eventType: input.eventType,
      externalId: input.externalId,
      payload: input.payload,
      signatureOk: input.signatureOk,
    })
    try {
      return await this.callbacks.save(evt)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new JobQueueError(JOB_QUEUE_ERROR_CODES.CALLBACK_DUPLICATE, 'Duplicate callback', 409)
      }
      throw error
    }
  }

  async listUnprocessedCallbacks(limit = 50): Promise<InboundCallbackEvent[]> {
    return this.callbacks.find({
      where: { processedAt: IsNull() },
      order: { receivedAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    })
  }

  /** 消费未处理回调：签名校验通过后入队，标记 processed_at。
   *  handler 返回 { queueName, payload, dedupKey } 决定如何派发。 */
  async consumeCallbacks(
    handler: (evt: InboundCallbackEvent) => { queueName: string; payload: Record<string, unknown>; dedupKey?: string } | null,
    limit = 50,
    now: Date = new Date(),
  ): Promise<number> {
    const pending = await this.callbacks.find({
      where: { processedAt: IsNull() },
      order: { receivedAt: 'ASC' },
      take: limit,
    })
    let processed = 0
    for (const evt of pending) {
      if (!evt.signatureOk) {
        evt.processedAt = now
        await this.callbacks.save(evt)
        processed++
        continue
      }
      const dispatch = handler(evt)
      if (dispatch) {
        await this.enqueue({
          queueName: dispatch.queueName,
          payload: dispatch.payload,
          dedupKey: dispatch.dedupKey ?? `cb:${evt.partner}:${evt.externalId}`,
        })
      }
      evt.processedAt = now
      await this.callbacks.save(evt)
      processed++
    }
    return processed
  }

  private assertLeaseOwner(job: JobQueueEntry, workerId: string | undefined, now: Date) {
    if (!workerId) return
    if (job.state !== 'running' || job.workerId !== workerId || !job.leaseExpiresAt || job.leaseExpiresAt <= now) {
      throw new JobQueueError(JOB_QUEUE_ERROR_CODES.JOB_LEASE_LOST, 'Job execution lease is no longer owned by this worker', 409)
    }
  }
}

function queryRows(raw: unknown): Array<Record<string, any>> {
  if (!Array.isArray(raw)) return []
  if (raw.length === 2 && Array.isArray(raw[0]) && typeof raw[1] === 'number') return raw[0]
  return raw as Array<Record<string, any>>
}

function mapJobRow(row: Record<string, any>): JobQueueEntry {
  return {
    id: row.id,
    queueName: row.queue_name,
    payload: row.payload,
    state: row.state,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastError: row.last_error,
    dedupKey: row.dedup_key,
    runAt: row.run_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    lockedAt: row.locked_at,
    leaseExpiresAt: row.lease_expires_at,
    workerId: row.worker_id,
  }
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505'
}
