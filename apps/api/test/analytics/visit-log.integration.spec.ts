import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { VisitLogService } from '../../src/analytics/visit-log.service'
import { VisitQueryService } from '../../src/analytics/visit-query.service'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('visit log (PostgreSQL)', () => {
  let db: DataSource
  let visits: VisitLogService
  let query: VisitQueryService
  let userId: string
  const crypto = {
    hashIdentifier: (value: string) => Buffer.from(`hash:${value.toLowerCase()}`),
    decrypt: (blob: Buffer) => blob.toString('utf8'),
  } as unknown as IdentityCrypto

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    visits = new VisitLogService(db)
    query = new VisitQueryService(db, crypto)
    const [user] = await db.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    userId = user.id
    await db.query(`INSERT INTO app.login_identities (user_id, kind, state, identifier_hash, identifier_ciphertext, encryption_key_version, verified_at)
      VALUES ($1, 'email', 'verified', $2, $3, 1, now())`, [userId, Buffer.from('hash:visitor@example.com'), Buffer.from('visitor@example.com')])
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  it('records every visit with time and IP, and the admin can search by IP, range, email and day', async () => {
    const now = Date.now()
    const at = (minutes: number) => new Date(now - 60 * 60_000 + minutes * 60_000)
    visits.record({ at: at(0), ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile', userAgent: 'iPhone', page: '/home' })
    visits.record({ at: at(5), ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile', userAgent: 'iPhone', page: '/markets' })
    visits.record({ at: at(1), ip: '2001:db8::5', userId, country: 'SG', device: 'desktop', userAgent: 'Windows', page: '/assets' })
    await visits.flush()
    visits.record({ at: at(8), ip: '203.0.113.7', userId: null, country: 'JP', device: 'mobile', userAgent: 'iPhone', page: '/profile' })
    await visits.flush()

    const all = await query.list({})
    expect(all.total).toBe(2)
    const anonymous = all.items.find((row) => row.userId === null)!
    expect(anonymous).toMatchObject({ ip: '203.0.113.7', country: 'JP', requests: 3, firstPage: '/home', lastPage: '/profile', durationSeconds: 480, email: null })
    const signedIn = all.items.find((row) => row.userId === userId)!
    expect(signedIn).toMatchObject({ ip: '2001:db8::5', email: 'visitor@example.com', requests: 1 })

    expect((await query.list({ q: '203.0.113.7' })).total).toBe(1)
    expect((await query.list({ q: '203.0.113.0/24' })).total).toBe(1)
    expect((await query.list({ q: 'Visitor@Example.com' })).items[0].userId).toBe(userId)
    expect((await query.list({ q: userId.slice(0, 8) })).total).toBe(1)
    expect((await query.list({ kind: 'anonymous' })).total).toBe(1)
    expect((await query.list({ day: '2000-01-01' })).total).toBe(0)
    await expect(query.list({ q: 'drop table' })).rejects.toMatchObject({ response: { code: 'VISIT_QUERY_INVALID' } })
    await expect(query.list({ pageSize: '500' })).rejects.toMatchObject({ response: { code: 'VISIT_QUERY_INVALID' } })
  })
})
