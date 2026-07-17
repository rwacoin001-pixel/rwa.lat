import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { TypeOrmModule } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { AuditLog } from '../../src/security/audit-log.entity'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AdminRbacModule } from '../../src/admin-rbac/admin-rbac.module'
import { AdminRbacService } from '../../src/admin-rbac/admin-rbac.service'
import { AdminRole, AdminUser, AdminApprovalRequest, AdminRolePermission, AdminSession } from '../../src/admin-rbac/admin-rbac.entities'

const ADMIN_A = 'aaaaaaaa-0000-0000-0000-0000000000a1'
const ADMIN_B = 'bbbbbbbb-0000-0000-0000-0000000000b2'
const TOKEN_A = 'ras_test_admin_session_a_012345678901234567890123456789'
const TOKEN_B = 'ras_test_admin_session_b_012345678901234567890123456789'

describe('API-013 admin RBAC HTTP (Pg + guard)', () => {
  let app: INestApplication
  let ds: DataSource
  let moduleRef: any

  beforeAll(async () => {
    const opts = buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })
    ds = new DataSource({
      ...opts,
      entities: [...(Array.isArray(opts.entities) ? opts.entities : []), AdminRole, AdminUser, AdminApprovalRequest, AdminRolePermission, AdminSession, AuditLog],
    })
    await ds.initialize()
    await ds.query('DROP SCHEMA IF EXISTS app CASCADE')
    await ds.query('DROP TABLE IF EXISTS public.schema_migrations')
    await ds.runMigrations({ transaction: 'all' })

    const role = await ds.getRepository(AdminRole).save(ds.getRepository(AdminRole).create({ name: 'ops', description: 'ops' }))
    await ds.getRepository(AdminUser).save([
      ds.getRepository(AdminUser).create({ id: ADMIN_A, email: 'a@admin.test', roleId: role.id }),
      ds.getRepository(AdminUser).create({ id: ADMIN_B, email: 'b@admin.test', roleId: role.id }),
    ])
    await ds.getRepository(AdminRolePermission).save(
      ds.getRepository(AdminRolePermission).create({ roleId: role.id, permission: 'approvals.manage' }),
    )
    await ds.query(
      `INSERT INTO app.admin_sessions (admin_user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 hour'), ($3, $4, now() + interval '1 hour')`,
      [ADMIN_A, createHash('sha256').update(TOKEN_A).digest(), ADMIN_B, createHash('sha256').update(TOKEN_B).digest()],
    )

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ ...opts, entities: [AdminRole, AdminUser, AdminApprovalRequest, AdminRolePermission, AdminSession, AuditLog] }),
        AdminRbacModule,
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('v1')
    await app.init()
    await app.listen(0)
  })

  const url = () => `http://127.0.0.1:${app.getHttpServer().address().port}/v1`

  afterAll(async () => {
    await app?.close()
    await ds.destroy()
    if (moduleRef) await moduleRef.close()
  })

  it('rejects requests without a server-side admin session', async () => {
    const res = await fetch(`${url()}/admin/approvals`)
    expect(res.status).toBe(401)
  })

  it('lists approvals with a valid server-side session', async () => {
    const res = await fetch(`${url()}/admin/approvals`, {
      headers: { authorization: `Bearer ${TOKEN_A}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('uses one v1 prefix and does not expose a doubled prefix route', async () => {
    const canonical = await fetch(`${url()}/admin/approvals`, { headers: { authorization: `Bearer ${TOKEN_A}` } })
    const doubled = await fetch(`${url()}/v1/admin/approvals`, { headers: { authorization: `Bearer ${TOKEN_A}` } })
    expect(canonical.status).toBe(200)
    expect(doubled.status).toBe(404)
  })

  it('creates and approves a redemption approval through HTTP (four-eyes)', async () => {
    const create = await fetch(`${url()}/admin/approvals`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN_A}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', objectType: 'redemption', objectId: 'r-http', payload: { amount: 10 } }),
    })
    expect(create.status).toBe(201)
    const created = await create.json()

    const approve = await fetch(`${url()}/admin/approvals/${created.id}/decide`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${TOKEN_B}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reasonCode: 'ok' }),
    })
    expect(approve.status).toBe(200)
    const decided = await approve.json()
    expect(decided.state).toBe('approved')
    expect(decided.approvedBy).toBe(ADMIN_B)
    const audit = await ds.query(`SELECT action, actor_id FROM app.audit_logs WHERE object_id = $1 ORDER BY occurred_at ASC`, [created.id])
    expect(audit).toEqual([
      expect.objectContaining({ action: 'admin.approval.requested', actor_id: ADMIN_A }),
      expect.objectContaining({ action: 'admin.approval.approved', actor_id: ADMIN_B }),
    ])
  })
})
