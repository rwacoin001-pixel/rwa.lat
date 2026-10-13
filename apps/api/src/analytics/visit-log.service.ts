import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import type { ActivityDevice, ActivityHit } from './activity-recorder.service'

/** A visit ends after this much inactivity; the next request starts a new visit. */
export const VISIT_IDLE_MS = 30 * 60_000
export const VISIT_RETENTION_DAYS = 180
const FLUSH_INTERVAL_MS = 30_000
const FLUSH_BATCH_SIZE = 500
/** Open visits tracked in memory; beyond this, new visitors are dropped until idle visits expire. */
const MAX_OPEN_VISITS = 50_000
const PRUNE_INTERVAL_MS = 12 * 60 * 60_000

interface OpenVisit { id: string; lastMs: number }
interface PendingVisit {
  id: string
  userId: string | null
  ip: string
  country: string | null
  device: ActivityDevice
  userAgent: string | null
  firstPage: string | null
  lastPage: string | null
  started: Date
  last: Date
  requests: number
}

/** Signed-in visitors by account; anonymous ones by IP + user agent (people behind one NAT stay apart). */
export function visitorIdentity(hit: Pick<ActivityHit, 'userId' | 'ip' | 'userAgent'>): string {
  if (hit.userId) return `u:${hit.userId}`
  return `a:${hit.ip}|${createHash('sha256').update(hit.userAgent ?? '').digest('base64url').slice(0, 16)}`
}

/**
 * Writes app.visit_log: one row per visit, upserted every 30 s. Fire-and-forget like the daily activity
 * recorder: it never delays or fails an API request and its memory is bounded. An API restart starts a new
 * visit for visitors who were mid-visit.
 */
@Injectable()
export class VisitLogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisitLogService.name)
  private readonly open = new Map<string, OpenVisit>()
  private readonly pending = new Map<string, PendingVisit>()
  private flushing: Promise<void> | null = null
  private timer: NodeJS.Timeout | null = null
  private nextPruneAt = Date.now() + 5 * 60_000
  private nextSweepAt = 0
  private dropped = 0

  constructor(private readonly db: DataSource) {}

  onModuleInit() {
    const flag = process.env.VISIT_LOG_ENABLED
    if (flag === 'false' || (process.env.NODE_ENV === 'test' && flag !== 'true')) return
    this.timer = setInterval(() => { void this.flush() }, FLUSH_INTERVAL_MS)
    this.timer.unref()
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (let attempt = 0; attempt < 20 && (this.pending.size || this.flushing); attempt++) await this.flush()
  }

  get enabled() { return this.timer !== null }
  get openVisits() { return this.open.size }
  get pendingVisits() { return this.pending.size }

  /** Returns false when the hit was dropped because too many visits are open. */
  record(hit: ActivityHit): boolean {
    const at = hit.at.getTime()
    this.sweep(at)
    const identity = visitorIdentity(hit)
    let visit = this.open.get(identity)
    if (!visit || at - visit.lastMs > VISIT_IDLE_MS) {
      if (!visit && this.open.size >= MAX_OPEN_VISITS) {
        this.dropped += 1
        return false
      }
      visit = { id: randomUUID(), lastMs: at }
      this.open.set(identity, visit)
    }
    visit.lastMs = Math.max(visit.lastMs, at)
    const row = this.pending.get(visit.id)
    if (row) {
      row.requests += 1
      if (hit.at > row.last) { row.last = hit.at; row.lastPage = hit.page ?? row.lastPage }
      row.country ??= hit.country
      row.firstPage ??= hit.page ?? null
    } else {
      this.pending.set(visit.id, {
        id: visit.id, userId: hit.userId, ip: hit.ip, country: hit.country, device: hit.device, userAgent: hit.userAgent ?? null,
        firstPage: hit.page ?? null, lastPage: hit.page ?? null, started: hit.at, last: hit.at, requests: 1,
      })
      if (this.pending.size >= FLUSH_BATCH_SIZE) void this.flush()
    }
    return true
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (!this.pending.size) return Promise.resolve()
    const batch: PendingVisit[] = []
    for (const [id, row] of this.pending) {
      batch.push(row)
      this.pending.delete(id)
      if (batch.length >= FLUSH_BATCH_SIZE) break
    }
    this.flushing = this.write(batch)
      .catch((error: unknown) => {
        this.logger.warn(`visit_log flush failed, ${batch.length} visit updates dropped: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        this.flushing = null
        if (this.dropped) {
          this.logger.warn(`visit_log at capacity, ${this.dropped} hits dropped`)
          this.dropped = 0
        }
        this.maybePrune()
        if (this.pending.size >= FLUSH_BATCH_SIZE) void this.flush()
      })
    return this.flushing
  }

  /** A row first written as a new visit; later batches only extend it (requests are added, never replaced). */
  private async write(batch: PendingVisit[]) {
    await this.db.query(
      `INSERT INTO app.visit_log AS v (id, user_id, ip, country, device, user_agent, first_page, last_page, started_at, last_seen_at, requests)
       SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::inet[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[],
         $9::timestamptz[], $10::timestamptz[], $11::int[])
       ON CONFLICT (id) DO UPDATE SET
         last_seen_at = GREATEST(v.last_seen_at, EXCLUDED.last_seen_at),
         started_at = LEAST(v.started_at, EXCLUDED.started_at),
         requests = v.requests + EXCLUDED.requests,
         last_page = CASE WHEN EXCLUDED.last_seen_at >= v.last_seen_at THEN COALESCE(EXCLUDED.last_page, v.last_page) ELSE v.last_page END,
         first_page = COALESCE(v.first_page, EXCLUDED.first_page),
         country = COALESCE(v.country, EXCLUDED.country)`,
      [
        batch.map((row) => row.id), batch.map((row) => row.userId), batch.map((row) => row.ip), batch.map((row) => row.country),
        batch.map((row) => row.device), batch.map((row) => row.userAgent), batch.map((row) => row.firstPage), batch.map((row) => row.lastPage),
        batch.map((row) => row.started.toISOString()), batch.map((row) => row.last.toISOString()), batch.map((row) => row.requests),
      ],
    )
  }

  private sweep(now: number) {
    if (now < this.nextSweepAt && this.open.size < MAX_OPEN_VISITS) return
    this.nextSweepAt = now + 60_000
    for (const [identity, visit] of this.open) if (now - visit.lastMs > VISIT_IDLE_MS) this.open.delete(identity)
  }

  private maybePrune() {
    const now = Date.now()
    if (now < this.nextPruneAt) return
    this.nextPruneAt = now + PRUNE_INTERVAL_MS
    this.db.query(`DELETE FROM app.visit_log WHERE started_at < now() - make_interval(days => $1::int)`, [VISIT_RETENTION_DAYS])
      .catch((error: unknown) => this.logger.warn(`visit_log prune failed: ${error instanceof Error ? error.message : String(error)}`))
  }
}
