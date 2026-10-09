import { ForbiddenException } from '@nestjs/common'
import { AdminRbacService } from '../../src/admin-rbac/admin-rbac.service'
import { AdminRbacController } from '../../src/admin-rbac/admin-rbac.controller'
import { AdminLedgerController } from '../../src/ledger/ledger.controller'
import { LedgerService } from '../../src/ledger/ledger.service'

const id = 'aaaaaaaa-0000-0000-0000-0000000000a1'
const actor = { id, email: 'console-service@rwa.lat', roleId: 'service-channel', roleName: 'service-channel', sessionId: `service:${id}`, permissions: ['*'] }

describe('Single-administrator approval policy', () => {
  it.each([true, false])('allows a requester to decide their own generic approval: %s', async approve => {
    const row = { id: 'request-1', state: 'requested', requestedBy: id, action: 'change', objectType: 'test' }
    const approvals = { findOne: jest.fn().mockResolvedValue(row), save: jest.fn(async value => value) }
    const audit = { insert: jest.fn() }
    const service = new AdminRbacService({} as never, {} as never, {} as never, approvals as never, audit as never)
    await expect(service.decideApproval(row.id, id, approve, 'operator confirmed')).resolves.toMatchObject({
      state: approve ? 'approved' : 'rejected', requestedBy: id, approvedBy: id, decidedAt: expect.any(Date),
    })
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({ actorId: id, action: approve ? 'admin.approval.approved' : 'admin.approval.rejected' }))
    await expect(service.decideApproval(row.id, id, approve)).rejects.toMatchObject({ response: { code: 'admin.approval.state_invalid' } })
  })

  it.each([true, false])('allows the same administrator to decide a ledger adjustment without posting it: %s', async approve => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM app.ledger_adjustment_requests')) return [{ id: 'adjust-1', state: 'requested', requested_by: id }]
      if (sql.includes('UPDATE app.ledger_adjustment_requests')) return [{ id: 'adjust-1', state: approve ? 'approved' : 'rejected', approvedBy: id }]
      return []
    })
    const runner = { query, connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() }
    const service = new LedgerService({ createQueryRunner: () => runner } as never)
    const previous = process.env.LEDGER_ALLOW_SELF_APPROVAL
    process.env.LEDGER_ALLOW_SELF_APPROVAL = 'false'
    try {
      await expect(service.decideLedgerAdjustment('adjust-1', id, approve, 'operator confirmed', 'trace-1')).resolves.toMatchObject({ approvedBy: id })
      expect(runner.commitTransaction).toHaveBeenCalled()
      expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO app.ledger_entries'))).toBe(false)
    } finally { if (previous === undefined) delete process.env.LEDGER_ALLOW_SELF_APPROVAL; else process.env.LEDGER_ALLOW_SELF_APPROVAL = previous }
  })

  it('uses the verified gateway actor for generic approval without rechecking the audit-only principal', async () => {
    const svc = { assertPermission: jest.fn().mockRejectedValue(new ForbiddenException()), decideApproval: jest.fn().mockResolvedValue({ state: 'approved' }) }
    const controller = new AdminRbacController(svc as never)
    await expect(controller.decide('request-1', actor, { reasonCode: 'confirmed' }, { headers: {}, requestId: 'trace-1' } as never)).resolves.toEqual({ state: 'approved' })
    expect(svc.assertPermission).not.toHaveBeenCalled()
    expect(svc.decideApproval).toHaveBeenCalledWith('request-1', id, true, 'confirmed', expect.any(Object))
  })

  it('uses the verified gateway actor for ledger approval and preserves ordinary RBAC', async () => {
    const rbac = { assertPermission: jest.fn().mockRejectedValue(new ForbiddenException()) }
    const ledger = { decideLedgerAdjustment: jest.fn().mockResolvedValue({ state: 'approved' }) }
    const controller = new AdminLedgerController(ledger as never, rbac as never)
    await expect(controller.approve(actor, 'adjust-1', {}, { requestId: 'trace-1' } as never)).resolves.toEqual({ state: 'approved' })
    expect(rbac.assertPermission).not.toHaveBeenCalled()
    await expect(controller.approve({ ...actor, roleId: 'ordinary-role' }, 'adjust-1', {}, {} as never)).rejects.toBeInstanceOf(ForbiddenException)
    expect(ledger.decideLedgerAdjustment).toHaveBeenCalledTimes(1)
  })

  it.each([
    { roleId: 'ordinary-role' },
    { sessionId: 'ordinary-session' },
    { permissions: ['approvals.manage'] },
  ])('does not delegate approval permissions for incomplete service identities: %j', async fields => {
    const svc = { assertPermission: jest.fn().mockRejectedValue(new ForbiddenException()), decideApproval: jest.fn() }
    const controller = new AdminRbacController(svc as never)
    await expect(controller.decide('request-1', { ...actor, ...fields }, {}, { headers: {} } as never)).rejects.toBeInstanceOf(ForbiddenException)
    expect(svc.assertPermission).toHaveBeenCalledWith(id, 'approvals.manage')
    expect(svc.decideApproval).not.toHaveBeenCalled()
  })
})
