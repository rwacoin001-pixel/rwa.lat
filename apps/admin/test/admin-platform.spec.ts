import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { validate } from 'class-validator'
import { AdminPlatformService } from '../src/admin-platform.service'
import { InvestmentBlockDto } from '../src/admin-platform.dto'
import { AdminPlatformController } from '../src/admin-platform.controller'
import { AdminPermissionGuard, ADMIN_REQUIRED_PERMISSIONS } from '../src/admin-permission.guard'

const USER = '9f1c0001-5b2e-4c71-9a3d-7e6400000001'
const ADMIN = '9f1c0001-5b2e-4c71-9a3d-7e6400000002'

function setup(exists = true, blocked = false) {
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.startsWith('SELECT id FROM app.users')) return { rowCount: exists ? 1 : 0, rows: exists ? [{ id: USER }] : [] }
    if (sql.startsWith('SELECT id FROM app.risk_flags')) return { rows: blocked ? [{ id: 'flag' }] : [] }
    return { rows: [] }
  })
  const release = jest.fn()
  const service = new AdminPlatformService(new ConfigService())
  Object.assign(service, { pool: { query, connect: jest.fn().mockResolvedValue({ query, release }) } })
  return { service, query, release }
}

describe('platform investment blocklist', () => {
  it('creates the high open flag and records its id in the audited transaction', async () => {
    const { service, query, release } = setup()
    await expect(service.blockInvestment({ userId: USER, reason: 'Operator request' }, ADMIN)).resolves.toEqual({ userId: USER, blocked: true })
    expect(query.mock.calls[0][0]).toBe('BEGIN')
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE')
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.risk_flags'))!
    expect(insert[0]).toContain("'investment_block','high','open','admin','admin_block'")
    const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.audit_logs'))!
    expect(audit[1]?.[1]).toBe(ADMIN)
    expect(audit[1]?.[2]).toBe('admin.platform.investment_blocked')
    expect(JSON.parse(audit[1]?.[4] as string)).toEqual({ userId: USER, flagId: insert[1]?.[0] })
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
    expect(release).toHaveBeenCalled()
  })

  it('does not insert a second open flag or replace the original blockedBy on replay', async () => {
    const { service, query } = setup(true, true)
    await service.blockInvestment({ userId: USER }, ADMIN)
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.risk_flags'))).toBe(false)
    const audit = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.audit_logs'))!
    expect(JSON.parse(audit[1]?.[4] as string)).toEqual({ userId: USER, replay: true })
  })

  it('returns 404 for a missing user and rolls back without an audit or flag', async () => {
    const { service, query, release } = setup(false)
    await expect(service.blockInvestment({ userId: USER }, ADMIN)).rejects.toMatchObject({ status: 404 })
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false)
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
    expect(release).toHaveBeenCalled()
  })

  it('resolves only open investment blocks and audits unblocking', async () => {
    const { service, query } = setup()
    await expect(service.unblockInvestment(USER, ADMIN)).resolves.toEqual({ userId: USER, blocked: false })
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE app.risk_flags'))!
    expect(update[0]).toContain("state = 'resolved', resolved_at = now()")
    expect(update[0]).toContain("category = 'investment_block' AND state = 'open'")
    expect(update[1]).toEqual([USER])
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.audit_logs'))?.[1]?.[2]).toBe('admin.platform.investment_unblocked')
  })

  it('lists open flags with profile and actor details, newest first, with null reasons', async () => {
    const { service, query } = setup()
    const items = [{ userId: USER, displayName: null, handle: null, reason: null, blockedAt: '2026-11-04', blockedBy: ADMIN }]
    query.mockResolvedValueOnce({ rows: items } as never)
    await expect(service.listInvestmentBlocks()).resolves.toEqual({ items })
    const sql = query.mock.calls[0][0]
    expect(sql).toContain('LEFT JOIN app.community_profiles')
    expect(sql).toContain("metadata->>'flagId' = f.id::text")
    expect(sql).toContain("f.category = 'investment_block' AND f.state = 'open'")
    expect(sql).toContain('ORDER BY f.opened_at DESC, f.id DESC LIMIT 200')
    expect(sql).toContain('NULL::text AS reason')
  })

  it('validates UUIDs and the optional 200-character reason', async () => {
    for (const reason of [undefined, '', 'x'.repeat(200)]) {
      expect(await validate(Object.assign(new InvestmentBlockDto(), { userId: USER, reason }))).toEqual([])
    }
    for (const input of [{ userId: 'invalid' }, { userId: USER, reason: 'x'.repeat(201) }, { userId: USER, reason: 42 }]) {
      expect((await validate(Object.assign(new InvestmentBlockDto(), input))).length).toBeGreaterThan(0)
    }
  })

  it('routes the blocklist alongside verified access under the same permission', () => {
    expect(Reflect.getMetadata(ADMIN_REQUIRED_PERMISSIONS, AdminPlatformController)).toEqual(['platform.manage'])
    expect(Reflect.getMetadata('__guards__', AdminPlatformController)).toContain(AdminPermissionGuard)
    expect(Reflect.getMetadata('path', AdminPlatformController)).toBe('admin/platform')
    expect(Reflect.getMetadata('path', AdminPlatformController.prototype.blocks)).toBe('investment-blocks')
    expect(Reflect.getMetadata('path', AdminPlatformController.prototype.block)).toBe('investment-blocks')
    expect(Reflect.getMetadata('path', AdminPlatformController.prototype.unblock)).toBe('investment-blocks/:userId')
  })
})
