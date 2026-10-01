import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AdminModule } from '../src/admin.module'
import { AdminService } from '../src/admin.service'
import { AdminAuthService, createAdminTotp, encryptAdminMfaSecret, hashAdminPassword } from '../src/admin-auth.service'
import { AdminSessionGuard } from '../src/admin-session.guard'
import { AdminCorePrincipalService } from '../src/admin-core-principal.service'
import { AdminPlatformService } from '../src/admin-platform.service'
import { buildDatabaseOptions } from './helpers/database-options'

describe('AdminModule (integration)', () => {
  let app: INestApplication
  let ds: DataSource
  let service: AdminService
  let auth: AdminAuthService
  const adminPassword = 'correct-horse-battery-staple'
  const USER = '00000000-0000-4000-8000-000000000001'
  const MFA_KEY = Buffer.alloc(32, 7).toString('base64')

  beforeAll(async () => {
    process.env.ADMIN_MFA_ENCRYPTION_KEY = MFA_KEY
    const opts = buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })
    ds = new DataSource(opts)
    await ds.initialize()
    console.info('Admin test fixture: connected to owned isolated database')
    const [connected] = await ds.query('SELECT current_database() AS name')
    if (connected.name !== decodeURIComponent(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)) || !connected.name.endsWith('_test')) throw new Error('Refusing to reset a database outside the explicit test target')
    await ds.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await ds.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await ds.runMigrations({ transaction: 'all' })
    console.info('Admin test fixture: schema migrations complete')

    await ds.query(
      `INSERT INTO app.users (id,status,locale,created_at,updated_at) VALUES ($1,'active','en',now(),now()) ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await ds.query(
      `INSERT INTO app.asset_classes (id, display_name, state, created_at) VALUES ('ac_admin_00000001','AC','active',now()) ON CONFLICT (id) DO NOTHING`,
    )
    const PRODUCT = '11111111-1111-1111-1111-111111111111'
    await ds.query(
      `INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
       VALUES ($1, 'ac_admin_00000001', 1, 'Admin Test RWA', 'USDT', 6, 'published', now()) ON CONFLICT (id) DO NOTHING`,
      [PRODUCT],
    )
    await ds.query(
      `INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, state)
       VALUES ('aaaaaaaa-bbbb-bbbb-bbbb-bbbbbbbbbbbb','user',$1,'available','USDT',6,'debit','active') ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until)
       VALUES (gen_random_uuid(), $1, 'USDT', 100, 'USD', 'seed', now() + interval '1 hour') ON CONFLICT DO NOTHING`,
      [PRODUCT],
    )
    await ds.query(
          `INSERT INTO app.redemptions (id, user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount,
                  estimated_unit_price_atomic_amount, currency, destination_address, state, request_id, requested_at)
           VALUES ('11111111-1111-1111-1111-111111111111', $1, $2, 'USDT', 6, '1000000', '100', 'USD', '0xadminseed', 'requested', 'req_admin_000000000001', now())
           ON CONFLICT (id) DO NOTHING`,
          [USER, PRODUCT],
        )

    await ds.query(
      `UPDATE app.admin_users
       SET password_hash = $2, password_updated_at = now(), failed_login_count = 0, locked_until = NULL
       WHERE email = $1`,
      ['demo@admin.rwa.lat', hashAdminPassword(adminPassword)],
    )
    const moduleRef = await Test.createTestingModule({ imports: [AdminModule.forTest(ds)] }).compile()
    console.info('Admin test fixture: module compiled')
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    await app.init()
    console.info('Admin test fixture: application initialized')
    await app.listen(0)
    service = moduleRef.get(AdminService)
    auth = moduleRef.get(AdminAuthService)
  }, 120000)

  afterAll(async () => {
    await app?.close()
    await ds?.destroy()
  })

  it('lists redemptions from the shared app schema', async () => {
    const rows = await service.listRedemptions()
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe('11111111-1111-1111-1111-111111111111')
    expect(rows[0].state).toBe('requested')
  })

  it('uses the explicit isolated database for injected services', async () => {
    expect(app.get(DataSource)).toBe(ds)
    const [row] = await app.get(DataSource).query('SELECT current_database() AS name')
    expect(row.name).toBe(decodeURIComponent(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)))
    expect(row.name.endsWith('_test')).toBe(true)
  })

  it('registers a cross-database administrator as a non-login principal without granting permissions', async () => {
    const actor = { id: '99999999-1111-4111-8111-111111111111', email: 'authoritative@example.invalid', roleId: 'external', roleName: 'operator', permissions: ['operations.write'], sessionId: 'external-session' }
    const principals = app.get(AdminCorePrincipalService)
    await Promise.all([principals.ensure(actor), principals.ensure(actor)])
    const [row] = await ds.query(`SELECT u.password_hash,u.mfa_secret_ciphertext,u.disabled_at,
      (SELECT count(*)::int FROM app.admin_role_permissions p WHERE p.role_id=u.role_id) AS permissions
      FROM app.admin_users u WHERE u.id=$1`, [actor.id])
    expect(row).toMatchObject({ password_hash: null, mfa_secret_ciphertext: null, permissions: 0 })
    expect(row.disabled_at).not.toBeNull()
    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM app.audit_logs WHERE action='admin.control_plane.principal_registered' AND object_id=$1`, [actor.id])
    expect(count).toBe(1)
    await ds.query(`UPDATE app.operational_switches SET changed_by=$1 WHERE switch_key='orders.acceptance'`, [actor.id])
  })

  it('never overwrites an existing administrator authentication record when databases are shared', async () => {
    const [before] = await ds.query(`SELECT id,password_hash,mfa_secret_ciphertext,role_id,disabled_at FROM app.admin_users WHERE email='demo@admin.rwa.lat'`)
    await app.get(AdminCorePrincipalService).ensure({ id: before.id, email: 'other@example.invalid', roleId: 'external', roleName: 'external', permissions: [], sessionId: 'external' })
    const [after] = await ds.query(`SELECT id,password_hash,mfa_secret_ciphertext,role_id,disabled_at FROM app.admin_users WHERE id=$1`, [before.id])
    expect(after).toEqual(before)
  })

  it('edits an imported publication without losing its contents or colliding with its published version', async () => {
    const platform = app.get(AdminPlatformService)
    const [actor] = await ds.query(`SELECT id FROM app.admin_users WHERE email='demo@admin.rwa.lat'`)
    const published = { legalName: 'Isolated Operator', registrationNumber: '', jurisdiction: 'SG', address: '', supportEmail: '', description: '', allowedRegions: ['SG'], investorTypes: ['professional'], documents: [], officialChannels: [] }
    await ds.query(`UPDATE app.platform_configuration SET revision=0,draft='{}',published=$1,published_revision=1,published_at=now() WHERE id=true`, [JSON.stringify(published)])
    expect((await platform.getPlatformConfiguration()).draft).toEqual(published)
    const content = { ...published, investorTypes: ['professional', 'retail'] }
    const saved = await platform.savePlatformConfiguration({ expectedRevision: 0, content }, actor.id)
    expect(saved.revision).toBe(2)
    expect(saved.published).toEqual(published)
    const result = await platform.publishPlatformConfiguration({ expectedRevision: 2 }, actor.id)
    expect(result.publishedRevision).toBe(2)
    expect(result.published.investorTypes).toEqual(['professional', 'retail'])
    const [history] = await ds.query(`SELECT content FROM app.platform_configuration_versions WHERE revision=2`)
    expect(history.content).toEqual(content)
    await expect(platform.savePlatformConfiguration({ expectedRevision: 0, content }, actor.id)).rejects.toThrow('资料已被其他人更新')
  })

  it('counts redemptions grouped by state', async () => {
    const stats = await service.countRedemptionsByState()
    expect(stats.requested).toBe(1)
  })

  it('lists users', async () => {
    const users = await service.listUsers()
    expect(users.some((u) => u.id === USER)).toBe(true)
  })

  it('serves the Admin health endpoint at the single v1/admin route only', async () => {
    const port = app.getHttpServer().address().port
    const canonical = await fetch(`http://127.0.0.1:${port}/v1/admin/health`)
    const doubled = await fetch(`http://127.0.0.1:${port}/v1/admin/admin/health`)
    expect(canonical.status).toBe(200)
    expect(doubled.status).toBe(404)
  })

  it('issues a revocable hashed session only after a valid password login', async () => {
    const login = await auth.login({ email: 'demo@admin.rwa.lat', password: adminPassword, ipAddress: '127.0.0.1' })
    expect(login.sessionToken).toMatch(/^ras_/)
    const actor = await auth.authenticate(login.sessionToken)
    expect(actor.email).toBe('demo@admin.rwa.lat')
    const refreshed = await auth.refresh(login.sessionToken, { ipAddress: '127.0.0.1' })
    await expect(auth.authenticate(login.sessionToken)).rejects.toThrow()
    await expect(auth.authenticate(refreshed.sessionToken)).resolves.toMatchObject({ email: 'demo@admin.rwa.lat' })
    await auth.logout(refreshed.sessionToken)
    await expect(auth.authenticate(refreshed.sessionToken)).rejects.toThrow()
    const audit = await ds.query(`SELECT action FROM app.audit_logs ORDER BY occurred_at ASC`)
    expect(audit.map((row: { action: string }) => row.action)).toEqual(expect.arrayContaining([
      'admin.session.login_succeeded',
      'admin.session.refreshed',
      'admin.session.logout',
    ]))
  })

  it('session guard rejects requests without a Bearer session', async () => {
    const guard = app.get(AdminSessionGuard)
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as never
    await expect(guard.canActivate(ctx)).rejects.toThrow()
  })

  it('rejects an invalid password without exposing an account-specific response', async () => {
    await expect(auth.login({ email: 'demo@admin.rwa.lat', password: 'wrong-password' })).rejects.toThrow('Invalid administrator credentials')
    const audit = await ds.query(`SELECT action FROM app.audit_logs WHERE action = 'admin.session.login_failed'`)
    expect(audit).toHaveLength(1)
  })

  it('fails closed while administrator MFA is pending', async () => {
    await ds.query(`UPDATE app.admin_users SET mfa_state = 'pending' WHERE email = $1`, ['demo@admin.rwa.lat'])
    await expect(auth.login({ email: 'demo@admin.rwa.lat', password: adminPassword })).rejects.toThrow('Additional administrator verification is required')
    const audit = await ds.query(`SELECT action FROM app.audit_logs WHERE action = 'admin.session.mfa_required'`)
    expect(audit).toHaveLength(1)
  })

  it('requires and verifies a time-based MFA code before issuing a session', async () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    await ds.query(
      `UPDATE app.admin_users SET mfa_state = 'enabled', mfa_secret_ciphertext = $2 WHERE email = $1`,
      ['demo@admin.rwa.lat', encryptAdminMfaSecret(secret, MFA_KEY)],
    )
    await expect(auth.login({ email: 'demo@admin.rwa.lat', password: adminPassword })).rejects.toThrow('Additional administrator verification is required')
    const result = await auth.login({ email: 'demo@admin.rwa.lat', password: adminPassword, mfaCode: createAdminTotp(secret) })
    await expect(auth.authenticate(result.sessionToken)).resolves.toMatchObject({ email: 'demo@admin.rwa.lat' })
  })

  it('rejects unauthenticated password changes', async () => {
    const port = app.getHttpServer().address().port
    const response = await fetch(`http://127.0.0.1:${port}/v1/admin/auth/password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: adminPassword, newPassword: 'another-secure-password' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns the actual authenticated account security policy without factor material', async () => {
    const port = app.getHttpServer().address().port
    expect((await fetch(`http://127.0.0.1:${port}/v1/admin/auth/security`)).status).toBe(401)
    const login = await auth.login({email: 'demo@admin.rwa.lat', password: adminPassword, mfaCode: createAdminTotp('JBSWY3DPEHPK3PXP')})
    const response = await fetch(`http://127.0.0.1:${port}/v1/admin/auth/security`, {headers: {authorization: `Bearer ${login.sessionToken}`}})
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({mfaState: 'enabled', mfaRequired: false, sessionTtlSeconds: 28800, loginMaxFailures: 5, loginLockSeconds: 900, environment: 'test'})
    await auth.logout(login.sessionToken)
  })

  it('does not change a password with wrong current credentials, a missing factor or a short replacement', async () => {
    const [before] = await ds.query(`SELECT id,password_hash,mfa_secret_ciphertext FROM app.admin_users WHERE email=$1`, ['demo@admin.rwa.lat'])
    await expect(auth.changePassword(before.id, {currentPassword: adminPassword, newPassword: 'short'})).rejects.toThrow('12 to 256')
    await expect(auth.changePassword(before.id, {currentPassword: 'wrong-current-password', newPassword: 'another-secure-password'})).rejects.toThrow('Current administrator password')
    await expect(auth.changePassword(before.id, {currentPassword: adminPassword, newPassword: 'another-secure-password'})).rejects.toThrow('Additional administrator verification')
    const [after] = await ds.query(`SELECT password_hash,mfa_secret_ciphertext,failed_login_count FROM app.admin_users WHERE id=$1`, [before.id])
    expect(after.password_hash).toBe(before.password_hash)
    expect(after.mfa_secret_ciphertext).toBe(before.mfa_secret_ciphertext)
    expect(after.failed_login_count).toBe(2)
    const events = await ds.query(`SELECT metadata FROM app.audit_logs WHERE actor_id=$1 AND action='admin.password.change_failed'`, [before.id])
    expect(events).toHaveLength(2)
    expect(events.every((event: {metadata: Record<string, unknown>}) => Object.keys(event.metadata).join(',') === 'reason')).toBe(true)
  })

  it('changes only the authenticated administrator password, preserves MFA and permissions and revokes every old session', async () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const [before] = await ds.query(`SELECT id,role_id,mfa_secret_ciphertext FROM app.admin_users WHERE email=$1`, ['demo@admin.rwa.lat'])
    const oldSessions = await Promise.all([1, 2].map(() => auth.login({email: 'demo@admin.rwa.lat', password: adminPassword, mfaCode: createAdminTotp(secret)})))
    const newPassword = 'changed-local-admin-password'
    await expect(auth.changePassword(before.id, {currentPassword: adminPassword, newPassword, mfaCode: createAdminTotp(secret)})).resolves.toMatchObject({status: 'password_changed', reauthenticationRequired: true})
    for (const session of oldSessions) await expect(auth.authenticate(session.sessionToken)).rejects.toThrow()
    await expect(auth.login({email: 'demo@admin.rwa.lat', password: adminPassword, mfaCode: createAdminTotp(secret)})).rejects.toThrow('Invalid administrator credentials')
    const result = await auth.login({email: 'demo@admin.rwa.lat', password: newPassword, mfaCode: createAdminTotp(secret)})
    await expect(auth.authenticate(result.sessionToken)).resolves.toMatchObject({id: before.id})
    const [after] = await ds.query(`SELECT role_id,mfa_state,mfa_secret_ciphertext FROM app.admin_users WHERE id=$1`, [before.id])
    expect(after.role_id).toBe(before.role_id)
    expect(after.mfa_state).toBe('enabled')
    expect(after.mfa_secret_ciphertext).toBe(before.mfa_secret_ciphertext)
    const events = await ds.query(`SELECT metadata FROM app.audit_logs WHERE actor_id=$1 AND action='admin.password.changed'`, [before.id])
    expect(events).toHaveLength(1)
    expect(events[0].metadata).toEqual({sessionsRevoked: true, mfaPreserved: true})
    await auth.logout(result.sessionToken)
  })
})
