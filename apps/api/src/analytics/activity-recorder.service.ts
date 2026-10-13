import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'node:crypto'
import { DataSource } from 'typeorm'

export const ACTIVITY_TIMEZONE = 'Asia/Shanghai'
export const ACTIVITY_RETENTION_DAYS = 400
const FLUSH_INTERVAL_MS = 30_000
const FLUSH_BATCH_SIZE = 500
/** Distinct visitor-days held in memory; beyond this new visitors are dropped until the next flush. */
const MAX_BUFFERED = 20_000
const PRUNE_INTERVAL_MS = 12 * 60 * 60_000

export type ActivityDevice = 'mobile' | 'desktop' | 'tablet' | 'other'

export interface ActivityHit {
  at: Date
  ip: string
  userId: string | null
  country: string | null
  device: ActivityDevice
}

interface Aggregate {
  day: string
  key: Buffer
  userId: string | null
  country: string | null
  device: ActivityDevice
  first: Date
  last: Date
  requests: number
}

/** Calendar day (YYYY-MM-DD) of an instant in the activity timezone. */
export function activityDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ACTIVITY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
}

/**
 * Aggregates end-user requests into one row per visitor per day and upserts them every 30s.
 * Fire-and-forget: nothing here can delay or fail an API request, and memory stays bounded.
 */
@Injectable()
export class ActivityRecorderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ActivityRecorderService.name)
  private readonly buffer = new Map<string, Aggregate>()
  private readonly visitorKeySecret: Buffer | null
  private flushing: Promise<void> | null = null
  private timer: NodeJS.Timeout | null = null
  private nextPruneAt = Date.now() + 5 * 60_000
  private dropped = 0

  constructor(private readonly db: DataSource, config: ConfigService) {
    const identityKey = config.get<string>('IDENTITY_HMAC_KEY')?.trim()
    // Domain-separated key: visitor keys can never collide with identity hashes made from the same secret.
    this.visitorKeySecret = identityKey && /^[0-9a-fA-F]{64}$/.test(identityKey)
      ? createHmac('sha256', Buffer.from(identityKey, 'hex')).update('a-reit:daily-activity-visitor:v1').digest()
      : null
  }

  onModuleInit() {
    const flag = process.env.ACTIVITY_TRACKING_ENABLED
    if (flag === 'false' || (process.env.NODE_ENV === 'test' && flag !== 'true')) return
    if (!this.visitorKeySecret) {
      this.logger.warn('Activity tracking disabled: IDENTITY_HMAC_KEY is not a 32-byte hex key')
      return
    }
    this.timer = setInterval(() => { void this.flush() }, FLUSH_INTERVAL_MS)
    this.timer.unref()
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (let attempt = 0; attempt < 20 && (this.buffer.size || this.flushing); attempt++) await this.flush()
  }

  get enabled() { return this.timer !== null }
  get pending() { return this.buffer.size }

  /** HMAC over the day and the visitor identity: signed-in users by id, anonymous visitors by IP. */
  visitorKey(day: string, hit: Pick<ActivityHit, 'ip' | 'userId'>): Buffer {
    if (!this.visitorKeySecret) throw new Error('Activity visitor key secret is not configured')
    const subject = hit.userId ? `u:${hit.userId}` : `ip:${hit.ip}`
    return createHmac('sha256', this.visitorKeySecret).update(`${day}|${subject}`).digest()
  }

  /** Returns false when the hit was dropped because the buffer is full. */
  record(hit: ActivityHit): boolean {
    const day = activityDay(hit.at)
    const key = this.visitorKey(day, hit)
    const id = `${day}|${key.toString('hex')}`
    const current = this.buffer.get(id)
    if (current) {
      current.requests += 1
      if (hit.at > current.last) current.last = hit.at
      if (hit.at < current.first) current.first = hit.at
      current.country ??= hit.country
      return true
    }
    if (this.buffer.size >= MAX_BUFFERED) {
      this.dropped += 1
      return false
    }
    this.buffer.set(id, { day, key, userId: hit.userId, country: hit.country, device: hit.device, first: hit.at, last: hit.at, requests: 1 })
    if (this.buffer.size >= FLUSH_BATCH_SIZE) void this.flush()
    return true
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing
    if (!this.buffer.size) return Promise.resolve()
    const batch: Aggregate[] = []
    for (const [id, row] of this.buffer) {
      batch.push(row)
      this.buffer.delete(id)
      if (batch.length >= FLUSH_BATCH_SIZE) break
    }
    this.flushing = this.write(batch)
      .catch((error: unknown) => {
        this.logger.warn(`daily_activity flush failed, ${batch.length} visitor-days dropped: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        this.flushing = null
        if (this.dropped) {
          this.logger.warn(`daily_activity buffer full, ${this.dropped} hits dropped`)
          this.dropped = 0
        }
        this.maybePrune()
        if (this.buffer.size >= FLUSH_BATCH_SIZE) void this.flush()
      })
    return this.flushing
  }

  private async write(batch: Aggregate[]) {
    await this.db.query(
      `INSERT INTO app.daily_activity AS a (day, visitor_key, user_id, country, device, first_seen_at, last_seen_at, requests)
       SELECT v.day, v.visitor_key, v.user_id, v.country, v.device, v.first_seen_at, v.last_seen_at, v.requests
         FROM unnest($1::date[], $2::bytea[], $3::uuid[], $4::text[], $5::text[], $6::timestamptz[], $7::timestamptz[], $8::int[])
           AS v(day, visitor_key, user_id, country, device, first_seen_at, last_seen_at, requests)
       ON CONFLICT (day, visitor_key) DO UPDATE SET
         first_seen_at = LEAST(a.first_seen_at, EXCLUDED.first_seen_at),
         last_seen_at = GREATEST(a.last_seen_at, EXCLUDED.last_seen_at),
         requests = a.requests + EXCLUDED.requests,
         country = COALESCE(a.country, EXCLUDED.country)`,
      [
        batch.map((row) => row.day), batch.map((row) => row.key), batch.map((row) => row.userId), batch.map((row) => row.country),
        batch.map((row) => row.device), batch.map((row) => row.first.toISOString()), batch.map((row) => row.last.toISOString()),
        batch.map((row) => row.requests),
      ],
    )
  }

  private maybePrune() {
    const now = Date.now()
    if (now < this.nextPruneAt) return
    this.nextPruneAt = now + PRUNE_INTERVAL_MS
    this.db.query(
      `DELETE FROM app.daily_activity WHERE day < (now() AT TIME ZONE '${ACTIVITY_TIMEZONE}')::date - $1::int`,
      [ACTIVITY_RETENTION_DAYS],
    ).catch((error: unknown) => this.logger.warn(`daily_activity prune failed: ${error instanceof Error ? error.message : String(error)}`))
  }
}
