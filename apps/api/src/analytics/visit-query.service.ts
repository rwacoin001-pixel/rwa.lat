import { BadRequestException, Injectable } from '@nestjs/common'
import { isIP } from 'node:net'
import { DataSource } from 'typeorm'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { ACTIVITY_TIMEZONE } from './activity-recorder.service'

export interface VisitQuery {
  page?: string
  pageSize?: string
  /** IP, CIDR range, email, or user id (prefix of at least 8 hex characters). */
  q?: string
  /** YYYY-MM-DD in Asia/Shanghai. */
  day?: string
  kind?: string
}

const UUID_PREFIX = /^[0-9a-f-]{8,36}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Admin read model for app.visit_log (raw IPs: reached only through the users.read admin route). */
@Injectable()
export class VisitQueryService {
  constructor(private readonly db: DataSource, private readonly crypto: IdentityCrypto) {}

  async list(query: VisitQuery) {
    const page = query.page === undefined ? 1 : Number(query.page)
    const pageSize = query.pageSize === undefined ? 50 : Number(query.pageSize)
    if (!Number.isInteger(page) || page < 1 || page > 100_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      throw new BadRequestException({ code: 'VISIT_QUERY_INVALID', message: 'Invalid pagination.' })
    }
    const where: string[] = []
    const params: unknown[] = []
    const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)) }

    const q = query.q?.trim()
    if (q) {
      if (isIP(q)) add('v.ip = ?::inet', q)
      else if (/^[0-9a-f.:]+\/\d{1,3}$/i.test(q) && isIP(q.split('/')[0])) add('v.ip <<= ?::inet', q)
      else if (q.includes('@')) {
        add(`v.user_id IN (SELECT i.user_id FROM app.login_identities i WHERE i.kind = 'email' AND i.identifier_hash = ?::bytea)`, this.crypto.hashIdentifier(q))
      } else if (UUID_PREFIX.test(q)) add('v.user_id::text LIKE ?', `${q.toLowerCase()}%`)
      else throw new BadRequestException({ code: 'VISIT_QUERY_INVALID', message: 'Search by IP, IP range, email or user id.' })
    }
    if (query.day) {
      if (!DAY.test(query.day)) throw new BadRequestException({ code: 'VISIT_QUERY_INVALID', message: 'Invalid day.' })
      add(`(v.started_at AT TIME ZONE '${ACTIVITY_TIMEZONE}')::date = ?::date`, query.day)
    }
    if (query.kind === 'user') where.push('v.user_id IS NOT NULL')
    else if (query.kind === 'anonymous') where.push('v.user_id IS NULL')
    else if (query.kind !== undefined && query.kind !== 'all') throw new BadRequestException({ code: 'VISIT_QUERY_INVALID', message: 'Invalid kind.' })

    const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
    return this.db.transaction('REPEATABLE READ', async (m) => {
      const [count] = await m.query(`SELECT count(*)::int AS total FROM app.visit_log v ${filter}`, params)
      const rows = await m.query(
        `SELECT v.id, v.user_id AS "userId", host(v.ip) AS ip, v.country, v.device, v.user_agent AS "userAgent",
                v.first_page AS "firstPage", v.last_page AS "lastPage", v.started_at AS "startedAt", v.last_seen_at AS "lastSeenAt",
                v.requests, extract(epoch FROM v.last_seen_at - v.started_at)::int AS "durationSeconds"
           FROM app.visit_log v ${filter}
          ORDER BY v.started_at DESC, v.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      ) as Array<Record<string, unknown> & { userId: string | null }>
      const emails = await this.emails(m, [...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id)))])
      return {
        items: rows.map((row) => ({ ...row, email: row.userId ? emails.get(row.userId) ?? null : null })),
        total: count.total as number, page, pageSize,
        retentionDays: 180, idleMinutes: 30, timezone: ACTIVITY_TIMEZONE,
      }
    })
  }

  private async emails(m: { query: DataSource['query'] }, userIds: string[]) {
    const result = new Map<string, string>()
    if (!userIds.length) return result
    const rows = await m.query(
      `SELECT DISTINCT ON (i.user_id) i.user_id, encode(i.identifier_ciphertext, 'hex') AS cipher, i.encryption_key_version AS version
         FROM app.login_identities i
        WHERE i.user_id = ANY($1::uuid[]) AND i.kind = 'email' AND i.revoked_at IS NULL AND i.state <> 'revoked'
        ORDER BY i.user_id, (i.state = 'verified') DESC, i.created_at DESC`,
      [userIds],
    ) as Array<{ user_id: string; cipher: string; version: number }>
    for (const row of rows) {
      try { result.set(row.user_id, this.crypto.decrypt(Buffer.from(row.cipher, 'hex'), row.version)) } catch { /* key unavailable: show the id only */ }
    }
    return result
  }
}
