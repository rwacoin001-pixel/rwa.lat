import { randomBytes } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { ReferralShortCodes1792800000000 } from '../../src/database/migrations/1792800000000-referral-short-codes'
import { ReferralBindingService } from '../../src/referral/referral-binding.service'
import { ReferralContext } from '../../src/referral/referral-context'

const database = process.env.TEST_DATABASE_URL ? describe : describe.skip
database('referral short-code migration (PostgreSQL)', () => {
  let db: DataSource, binding: ReferralBindingService
  const user = async () => (await db.query(`INSERT INTO app.users(status) VALUES('active') RETURNING id`))[0].id as string
  const hex = () => randomBytes(8).toString('hex')
  const issue = async (userId: string, code: string, changedLater = false) => {
    await db.query('INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)', [code, userId])
    await db.query(`INSERT INTO app.referral_codes(user_id,code,created_at,updated_at) VALUES($1,$2,'2026-10-01T00:00:00Z',$3)`,
      [userId, code, changedLater ? '2026-10-05T00:00:00Z' : '2026-10-01T00:00:00Z'])
  }
  const current = async (userId: string) => (await db.query('SELECT code,created_at,updated_at FROM app.referral_codes WHERE user_id=$1', [userId]))[0]
  const migrate = async (direction: 'up' | 'down') => {
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    try { await new ReferralShortCodes1792800000000()[direction](runner); await runner.commitTransaction() }
    finally { if (runner.isTransactionActive) await runner.rollbackTransaction(); await runner.release() }
  }

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })); await db.initialize(); await db.runMigrations({ transaction: 'all' })
    binding = new ReferralBindingService(db, new ConfigService({ IDENTITY_HMAC_KEY: '11'.repeat(32) }), new ReferralContext())
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  it('shortens only system-generated codes and keeps every old link, edge and custom code', async () => {
    const generated = await user(), changed = await user(), custom = await user(), invitee = await user()
    const oldCode = hex(), changedCode = hex()
    await issue(generated, oldCode); await issue(changed, changedCode, true); await issue(custom, 'areit2026')
    await db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)', [invitee, generated, oldCode])

    await migrate('up')

    const now = await current(generated)
    expect(now.code).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
    // The user's own 30-day code change stays available.
    expect(new Date(now.updated_at).getTime()).toBe(new Date(now.created_at).getTime())
    expect((await current(changed)).code).toBe(changedCode)
    expect((await current(custom)).code).toBe('areit2026')
    expect(await db.query('SELECT inviter_user_id,code FROM app.referral_edges WHERE invitee_user_id=$1', [invitee])).toEqual([{ inviter_user_id: generated, code: oldCode }])
    const [audit] = await db.query(`SELECT metadata FROM app.referral_audit WHERE action='code.shortened' AND object_id=$1`, [generated])
    expect(audit.metadata).toEqual({ from: oldCode, to: now.code })

    // Old links, new links and the signup lookup all resolve to the same inviter.
    for (const code of [oldCode, now.code, now.code.toUpperCase()]) {
      const landed = await binding.land(code)
      expect(await binding.describeAttribution(landed.token)).toEqual(expect.objectContaining({ code: (code === oldCode ? oldCode : now.code).toUpperCase() }))
    }
    await expect(binding.lookup(oldCode.toUpperCase())).resolves.toEqual({ valid: true, code: oldCode.toUpperCase() })
    await expect(binding.lookup(`${now.code.slice(0, 3)}-${now.code.slice(3)}`)).resolves.toEqual({ valid: true, code: now.code.toUpperCase() })
    await expect(binding.lookup('zzzzzz')).resolves.toEqual({ valid: false })

    // First click wins: a second code with an existing attribution keeps the first inviter.
    const first = await binding.land(now.code), second = await binding.land('areit2026', first.token)
    expect(second.token).toBe(first.token)

    // Re-running is a no-op; rollback points the user back at the old code and the short alias still resolves.
    await migrate('up')
    expect((await current(generated)).code).toBe(now.code)
    await migrate('down')
    expect((await current(generated)).code).toBe(oldCode)
    await expect(binding.lookup(now.code)).resolves.toEqual({ valid: true, code: now.code.toUpperCase() })
  })

  it('issues new codes in the short format', async () => {
    const fresh = await user()
    expect(await binding.getCode(fresh)).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/)
  })
})
