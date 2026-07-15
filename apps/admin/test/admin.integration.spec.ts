import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { AdminModule } from '../src/admin.module'
import { AdminService } from '../src/admin.service'
import { AdminAuthService, createAdminTotp, encryptAdminMfaSecret, hashAdminPassword } from '../src/admin-auth.service'
import { AdminSessionGuard } from '../src/admin-session.guard'
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
    await ds.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await ds.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await ds.runMigrations({ transaction: 'all' })

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
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    await app.init()
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
})
