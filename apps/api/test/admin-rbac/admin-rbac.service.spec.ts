import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from '../../src/security/audit-log.entity'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AdminRbacModule } from '../../src/admin-rbac/admin-rbac.module'
import { AdminRbacService } from '../../src/admin-rbac/admin-rbac.service'
import { AdminRole, AdminUser, AdminApprovalRequest, AdminRolePermission, AdminSession } from '../../src/admin-rbac/admin-rbac.entities'

describe('AdminRbacService', () => {
  let svc: AdminRbacService
  let ds: DataSource

  const ADMIN_A = 'aaaaaaaa-0000-0000-0000-0000000000a1'
  const ADMIN_B = 'bbbbbbbb-0000-0000-0000-0000000000b2'

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

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...opts,
          entities: [AdminRole, AdminUser, AdminApprovalRequest, AdminRolePermission, AdminSession, AuditLog],
        }),
        AdminRbacModule,
      ],
    }).compile()
    svc = moduleRef.get(AdminRbacService)

    // seed 角色 + 两个管理员
    const role = await ds.getRepository(AdminRole).save(ds.getRepository(AdminRole).create({ name: 'ops', description: 'ops' }))
    await ds.getRepository(AdminUser).save([
      ds.getRepository(AdminUser).create({ id: ADMIN_A, email: 'a@admin.test', roleId: role.id }),
      ds.getRepository(AdminUser).create({ id: ADMIN_B, email: 'b@admin.test', roleId: role.id }),
    ])
    await ds.getRepository(AdminRolePermission).save(
      ds.getRepository(AdminRolePermission).create({ roleId: role.id, permission: 'redemption:approve' }),
    )
  })

  afterAll(async () => {
    await ds.destroy()
    if (moduleRef) await moduleRef.close()
  })

  it('getProfile returns role + permissions', async () => {
    const p = await svc.getProfile(ADMIN_A)
    expect(p.roleName).toBe('ops')
    expect(p.permissions).toContain('redemption:approve')
  })

  it('assertPermission passes for granted permission', async () => {
    await expect(svc.assertPermission(ADMIN_A, 'redemption:approve')).resolves.toBeUndefined()
  })

  it('assertPermission throws for missing permission', async () => {
    await expect(svc.assertPermission(ADMIN_A, 'user:delete')).rejects.toMatchObject({
      response: { code: 'admin.permission.denied' },
    })
  })

  it('four-eyes: requester cannot self-approve', async () => {
    const req = await svc.createApproval({ actorId: ADMIN_A, action: 'redeem', objectType: 'redemption', objectId: 'r1', auditContext: { requestId: 'request-self' } })
    await expect(svc.decideApproval(req.id, ADMIN_A, true)).rejects.toMatchObject({
      response: { code: 'admin.approval.self_forbidden' },
    })
  })

  it('four-eyes: other admin can approve and state flips to approved', async () => {
    const req = await svc.createApproval({ actorId: ADMIN_A, action: 'redeem', objectType: 'redemption', objectId: 'r2', auditContext: { requestId: 'request-approve' } })
    const decided = await svc.decideApproval(req.id, ADMIN_B, true, 'approved_by_ops')
    expect(decided.state).toBe('approved')
    expect(decided.approvedBy).toBe(ADMIN_B)
    expect(decided.requestedBy).toBe(ADMIN_A)
  })

  it('reject flips state and cannot be re-decided', async () => {
    const req = await svc.createApproval({ actorId: ADMIN_A, action: 'redeem', objectType: 'redemption', objectId: 'r3', auditContext: { requestId: 'request-reject' } })
    await svc.decideApproval(req.id, ADMIN_B, false, 'risk')
    await expect(svc.decideApproval(req.id, ADMIN_B, true)).rejects.toMatchObject({
      response: { code: 'admin.approval.state_invalid' },
    })
  })
})
