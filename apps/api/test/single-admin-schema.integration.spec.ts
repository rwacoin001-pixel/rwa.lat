import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'
import { SingleAdministratorApprovals1791532800000 } from '../src/database/migrations/1791532800000-single-administrator-approvals'
import { FundsOperationalSwitchService } from '../src/wallet/funds-operational-switch.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('Single-administrator schema and audit evidence (PostgreSQL)', () => {
  let db: DataSource
  let adminId: string
  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    const [role] = await db.query(`INSERT INTO app.admin_roles(name) VALUES($1) RETURNING id`, [`single-${randomUUID()}`])
    const [admin] = await db.query(`INSERT INTO app.admin_users(email,role_id) VALUES($1,$2) RETURNING id`, [`${randomUUID()}@example.test`, role.id])
    adminId = admin.id
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  it('removes separation-of-person checks from all three approval tables', async () => {
    const checks = await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='c'
      AND conrelid IN ('app.admin_approval_requests'::regclass,'app.operational_switch_change_requests'::regclass,'app.ledger_adjustment_requests'::regclass)`)
    expect(checks.some((c: { definition: string }) => /(?:approved|decided)_by <> requested_by/.test(c.definition))).toBe(false)
    expect(checks.some((c: { definition: string }) => c.definition.includes('posted_ledger_transaction_id'))).toBe(true)
  })

  it('records a same-person approval while still refusing approval without a decision maker or timestamp', async () => {
    const [r] = await db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,approved_by,decided_at)
      VALUES('test','test','approved',$1,$1,now()) RETURNING id,state,requested_by,approved_by`, [adminId])
    expect(r).toMatchObject({ state: 'approved', requested_by: adminId, approved_by: adminId })
    await expect(db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,decided_at)
      VALUES('test','test','approved',$1,now())`, [adminId])).rejects.toMatchObject({ code: '23514' })
    await expect(db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,approved_by)
      VALUES('test','test','approved',$1,$1)`, [adminId])).rejects.toMatchObject({ code: '23514' })
  })

  it('retains prior single-person history across rollback and reapplication', async () => {
    const [r] = await db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,approved_by,decided_at)
      VALUES('rollback-test','test','approved',$1,$1,now()) RETURNING id`, [adminId])
    const runner = db.createQueryRunner()
    await runner.connect()
    const migration = new SingleAdministratorApprovals1791532800000()
    try {
      await migration.down(runner)
      expect((await db.query(`SELECT id FROM app.admin_approval_requests WHERE id=$1`, [r.id])).length).toBe(1)
      await expect(db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,approved_by,decided_at)
        VALUES('rollback-test','test','approved',$1,$1,now())`, [adminId])).rejects.toMatchObject({ code: '23514' })
    } finally { await migration.up(runner); await runner.release() }
    await expect(db.query(`INSERT INTO app.admin_approval_requests(action,object_type,state,requested_by,approved_by,decided_at)
      VALUES('reapply-test','test','approved',$1,$1,now())`, [adminId])).resolves.toBeDefined()
  })

  it('records the requester when pausing and rejecting their own pending resume request', async () => {
    const svc = new FundsOperationalSwitchService(db, new ConfigService({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true', WALLET_EXECUTION_ENABLED: 'true' }))
    const r = await svc.requestResume(adminId, `change-${randomUUID()}`, 'test resume', randomUUID())
    await svc.pause(adminId, 'test pause', randomUUID())
    const [row] = await db.query(`SELECT state,requested_by,decided_by,decided_at FROM app.operational_switch_change_requests WHERE id=$1`, [r.id])
    expect(row).toMatchObject({ state: 'rejected', requested_by: adminId, decided_by: adminId, decided_at: expect.any(Date) })
  })

  it('allows the same administrator to explicitly restore the switch and records the audit actor', async () => {
    const svc = new FundsOperationalSwitchService(db, new ConfigService({ PRODUCTION_FINANCIAL_FEATURES_ENABLED: 'true', WALLET_EXECUTION_ENABLED: 'true' }))
    const trace = randomUUID()
    const r = await svc.requestResume(adminId, `change-${randomUUID()}`, 'test resume', randomUUID())
    await expect(svc.decideResume(r.id, adminId, true, trace)).resolves.toMatchObject({ state: 'approved', enabled: true })
    const [audit] = await db.query(`SELECT actor_id,metadata FROM app.audit_logs WHERE request_id=$1`, [trace])
    expect(audit).toMatchObject({ actor_id: adminId, metadata: expect.objectContaining({ requestedBy: adminId, resumeRequestId: r.id }) })
    await svc.pause(adminId, 'test cleanup pause', randomUUID())
  })
})
