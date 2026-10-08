import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { LedgerService } from '../../src/ledger/ledger.service'
import { AdminUsersService } from '../../src/admin-users/admin-users.service'
import { SingleOperatorLedgerAdjustments1791446400000 } from '../../src/database/migrations/1791446400000-single-operator-ledger-adjustments'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip
describeDatabase('User management and single-operator adjustments (PostgreSQL)', () => {
  let db: DataSource
  let ledger: LedgerService
  let users: AdminUsersService
  let crypto: IdentityCrypto
  const adminId = randomUUID()
  const originalGate = process.env.LEDGER_ALLOW_SELF_APPROVAL
  beforeAll(async () => {
    process.env.LEDGER_ALLOW_SELF_APPROVAL = 'true'
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations({ transaction: 'all' })
    crypto = new IdentityCrypto(new ConfigService({ IDENTITY_HMAC_KEY: '11'.repeat(32), IDENTITY_ENC_KEY: '22'.repeat(32) }))
    ledger = new LedgerService(db); users = new AdminUsersService(db, crypto, ledger)
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); if (originalGate === undefined) delete process.env.LEDGER_ALLOW_SELF_APPROVAL; else process.env.LEDGER_ALLOW_SELF_APPROVAL = originalGate })
  async function user() { const [u] = await db.query('INSERT INTO app.users DEFAULT VALUES RETURNING id'); return u.id as string }
  function input(userId: string, extra = {}) { return { userId, adminId, operationId: randomUUID(), mode: 'credit' as const, amount: '10.000001', expectedAtomicBalance: '0', reason: '测试账本调整', requestId: randomUUID(), ...extra } }
  async function balance(id: string) { const result = await ledger.listUserBalances(id); return result.accounts.find((a: any) => a.purpose === 'available')?.atomicBalance ?? '0' }

  it('posts exact credit, deduction and target differences with immutable balanced entries and real audit actors', async () => {
    const id = await user()
    await ledger.adjustUserBalance(input(id))
    expect(await balance(id)).toBe('10000001')
    await ledger.adjustUserBalance(input(id, { mode: 'debit', amount: '2.000001', expectedAtomicBalance: '10000001' }))
    expect(await balance(id)).toBe('8000000')
    const last = await ledger.adjustUserBalance(input(id, { mode: 'set', amount: '0', expectedAtomicBalance: '8000000' }))
    expect(await balance(id)).toBe('0')
    const entries = await db.query('SELECT side, atomic_amount::text AS amount FROM app.ledger_entries WHERE transaction_id = $1', [last.ledgerTransactionId])
    expect(entries).toEqual(expect.arrayContaining([{ side: 'debit', amount: '8000000' }, { side: 'credit', amount: '8000000' }]))
    const audit = await db.query("SELECT actor_id FROM app.audit_logs WHERE object_id = $1 AND action = 'ledger.adjustment.posted'", [last.id])
    expect(audit[0].actor_id).toBe(adminId)
    const detail = await users.detail(id)
    expect(detail.adjustments).toHaveLength(3)
    expect(detail.adjustments[0]).toMatchObject({ beforeAtomic: '8000000', afterAtomic: '0', requestedBy: adminId, approvedBy: adminId, state: 'posted' })
  })
  it('serializes simultaneous identical operations and returns the first committed result', async () => {
    const id = await user(); const body = input(id)
    const results = await Promise.all([ledger.adjustUserBalance(body), ledger.adjustUserBalance(body)])
    expect(results.filter((r) => r.duplicate)).toHaveLength(1)
    expect(await balance(id)).toBe('10000001')
    expect(results[0].ledgerTransactionId).toBe(results[1].ledgerTransactionId)
    process.env.LEDGER_ALLOW_SELF_APPROVAL = 'false'
    await expect(ledger.adjustUserBalance(body)).resolves.toMatchObject({ duplicate: true })
    process.env.LEDGER_ALLOW_SELF_APPROVAL = 'true'
  })
  it('rejects concurrent distinct operations with a stale balance and cannot overdraw', async () => {
    const id = await user()
    const results = await Promise.allSettled([ledger.adjustUserBalance(input(id)), ledger.adjustUserBalance(input(id))])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balance(id)).toBe('10000001')
    await expect(ledger.adjustUserBalance(input(id, { mode: 'debit', amount: '11', expectedAtomicBalance: '10000001' }))).rejects.toMatchObject({ response: { code: 'USER_BALANCE_INSUFFICIENT' } })
    expect(await balance(id)).toBe('10000001')
  })
  it('rolls back the request, approval, account and audit if posting fails', async () => {
    const id = await user(); const body = input(id)
    const faulty = Object.create(db) as DataSource
    faulty.createQueryRunner = (...args: Parameters<DataSource['createQueryRunner']>) => {
      const runner = db.createQueryRunner(...args); const original = runner.query.bind(runner)
      runner.query = async (sql: string, params?: any[], useStructuredResult?: boolean) => {
        if (sql.includes('INSERT INTO app.ledger_entries')) throw new Error('Injected posting failure')
        return useStructuredResult ? original(sql, params, true) : original(sql, params)
      }
      return runner
    }
    await expect(new LedgerService(faulty).adjustUserBalance(body)).rejects.toThrow('Injected posting failure')
    expect(await balance(id)).toBe('0')
    expect(await db.query('SELECT id FROM app.ledger_adjustment_requests WHERE request_id = $1', [body.operationId])).toHaveLength(0)
    expect(await db.query('SELECT id FROM app.audit_logs WHERE request_id = $1', [body.requestId])).toHaveLength(0)
  })
  it('supports accounts whose positive normal side is debit', async () => {
    const id = await user()
    await db.query("INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES ('user',$1,'available','USDT',6,'debit')", [id])
    await ledger.adjustUserBalance(input(id))
    expect(await balance(id)).toBe('10000001')
    await ledger.adjustUserBalance(input(id, { mode: 'set', amount: '1.25', expectedAtomicBalance: '10000001' }))
    expect(await balance(id)).toBe('1250000')
  })
  it('finds encrypted email case-insensitively and returns only authorized display data', async () => {
    const id = await user(); const email = `${randomUUID()}@example.com`; const encrypted = crypto.encrypt(email)
    await db.query("INSERT INTO app.login_identities(user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at) VALUES ($1,'email','verified',$2,$3,$4,now())", [id, crypto.hashIdentifier(email), encrypted.ciphertext, encrypted.keyVersion])
    const result = await users.list({ limit: 1, offset: 0, q: ` ${email.toUpperCase()} ` })
    expect(result.total).toBe(1)
    expect(result.users[0]).toMatchObject({ id, email, emailState: 'verified', availableAtomic: '0' })
    expect(JSON.stringify(result)).not.toContain('cipher')
    expect(JSON.stringify(result)).not.toContain('identifier_hash')
    const emptyPage = await users.list({ limit: 1, offset: 1, q: email })
    expect(emptyPage).toMatchObject({ total: 1, count: 0, users: [] })
  })
  it('treats search wildcards literally and never presents unreadable identity or projection as valid', async () => {
    const id = await user(); const handle = `qa_${randomUUID().slice(0, 8)}`
    const marker = `QA_%_${randomUUID()}`
    await db.query('INSERT INTO app.community_profiles(user_id,display_name,handle) VALUES ($1,$2,$3)', [id, marker, handle])
    const result = await users.list({ limit: 50, offset: 0, q: marker })
    expect(result.users.map((u: { id: string }) => u.id)).toEqual([id])
    await db.query("INSERT INTO app.login_identities(user_id,kind,state,identifier_hash,identifier_ciphertext,encryption_key_version,verified_at) VALUES ($1,'email','verified',$2,$3,99,now())", [id, crypto.hashIdentifier(`${id}@example.com`), Buffer.from('invalid')])
    const detail = await users.detail(id)
    expect(detail.user).toMatchObject({ email: null, emailState: 'unavailable' })
  })
  it('never replaces a missing historical balance projection with zero', async () => {
    const id = await user(); await ledger.adjustUserBalance(input(id))
    await db.query('DELETE FROM app.ledger_account_balances WHERE account_id IN (SELECT id FROM app.ledger_accounts WHERE user_id=$1)', [id])
    expect((await users.detail(id)).user).toMatchObject({ availableAtomic: null, balanceAdjustable: false })
    await expect(ledger.adjustUserBalance(input(id))).rejects.toMatchObject({ response: { code: 'USER_ADJUSTMENT_UNAVAILABLE' } })
  })
  it('can restore the older approval constraint without invalidating historical posted adjustments', async () => {
    const id = await user(); const posted = await ledger.adjustUserBalance(input(id))
    const runner = db.createQueryRunner(); await runner.connect()
    const migration = new SingleOperatorLedgerAdjustments1791446400000()
    try {
      await migration.down(runner)
      const [constraint] = await runner.query("SELECT convalidated FROM pg_constraint WHERE conrelid='app.ledger_adjustment_requests'::regclass AND conname='ledger_adjustments_different_approver'")
      expect(constraint.convalidated).toBe(false)
      const [account] = await runner.query('SELECT ledger_account_id FROM app.ledger_adjustment_requests WHERE id=$1', [posted.id])
      await expect(runner.query(`INSERT INTO app.ledger_adjustment_requests
        (ledger_account_id,side,atomic_amount,reason_code,state,requested_by,approved_by,request_id,decided_at)
        VALUES ($1,'credit',1,'test','approved',$2,$2,$3,now())`, [account.ledger_account_id, adminId, randomUUID()])).rejects.toMatchObject({ code: '23514' })
      expect(await balance(id)).toBe('10000001')
    } finally { await migration.up(runner); await runner.release() }
  })
})
