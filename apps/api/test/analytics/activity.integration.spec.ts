import type { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { ActivityRecorderService } from '../../src/analytics/activity-recorder.service'
import { ActivitySummaryService } from '../../src/analytics/activity-summary.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('daily activity (PostgreSQL)', () => {
  let db: DataSource
  let recorder: ActivityRecorderService
  let summary: ActivitySummaryService

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    recorder = new ActivityRecorderService(db, { get: () => 'cd'.repeat(32) } as unknown as ConfigService)
    summary = new ActivitySummaryService(db)
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  it('upserts visitor-days and reports active users, visitors, sign-ins, registrations, countries and devices', async () => {
    const before = await summary.summary(7)
    const [user] = await db.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [device] = await db.query(
      `INSERT INTO app.devices (user_id, fingerprint_hash, trust_state) VALUES ($1, $2, 'trusted') RETURNING id`,
      [user.id, randomBytes(32)],
    ).catch(async () => db.query(`INSERT INTO app.devices (user_id, fingerprint_hash) VALUES ($1, $2) RETURNING id`, [user.id, randomBytes(32)]))
    await db.query(
      `INSERT INTO app.sessions (user_id, device_id, token_hash, state, expires_at) VALUES ($1, $2, $3, 'active', now() + interval '1 day')`,
      [user.id, device.id, randomBytes(32)],
    )
    const now = new Date()
    recorder.record({ at: now, ip: '203.0.113.7', userId: user.id, country: 'JP', device: 'mobile' })
    recorder.record({ at: now, ip: '203.0.113.7', userId: user.id, country: 'JP', device: 'mobile' })
    recorder.record({ at: now, ip: '198.51.100.20', userId: null, country: 'SG', device: 'desktop' })
    await recorder.flush()
    // A second flush for the same visitor-day must update, not duplicate.
    recorder.record({ at: now, ip: '203.0.113.7', userId: user.id, country: 'JP', device: 'mobile' })
    await recorder.flush()

    const [{ requests }] = await db.query(`SELECT requests FROM app.daily_activity WHERE user_id = $1`, [user.id])
    expect(requests).toBe(3)
    const [{ raw }] = await db.query(`SELECT count(*)::int AS raw FROM app.daily_activity WHERE encode(visitor_key, 'escape') LIKE '%203.0.113.7%'`)
    expect(raw).toBe(0)

    const after = await summary.summary(7)
    expect(after.today.activeUsers - before.today.activeUsers).toBe(1)
    expect(after.today.anonymousVisitors - before.today.anonymousVisitors).toBe(1)
    expect(after.today.logins - before.today.logins).toBe(1)
    expect(after.today.loginUsers - before.today.loginUsers).toBe(1)
    expect(after.today.registrations - before.today.registrations).toBe(1)
    expect(after.totals.users - before.totals.users).toBe(1)
    expect(after.totals.active7 - before.totals.active7).toBe(1)
    expect(after.series).toHaveLength(7)
    expect(after.trackingSince).not.toBeNull()
    const jp = after.countries.find((row) => row.country === 'JP')
    expect(jp?.users).toBeGreaterThanOrEqual(1)
    expect(after.devices.map((row) => row.device)).toEqual(expect.arrayContaining(['mobile', 'desktop']))
  })
})
