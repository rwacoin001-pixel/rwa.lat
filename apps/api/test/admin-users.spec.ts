import { AdminUsersController } from '../src/admin-users/admin-users.controller'
import { AdminUserAdjustmentDto, AdminUserListDto } from '../src/admin-users/admin-users.dto'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

describe('Admin user management authorization and input', () => {
  const id = 'd414efd2-e128-46b2-b25b-c61662b5ae83'
  function harness(delegated = false) {
    const users = { list: jest.fn(), detail: jest.fn() }
    const ledger = { adjustUserBalance: jest.fn() }
    const rbac = { assertPermission: jest.fn() }
    const controller = new AdminUsersController(users as never, ledger as never, rbac as never)
    const request = { admin: { id, roleId: delegated ? 'service-channel' : 'normal', sessionId: delegated ? `service:${id}` : 'session', permissions: delegated ? ['*'] : [] } } as any
    return { controller, request, users, ledger, rbac }
  }
  it('requires read, request and post permissions for an ordinary core admin session', async () => {
    const h = harness()
    await h.controller.adjust(h.request, id, {} as never)
    expect(h.rbac.assertPermission.mock.calls).toEqual([[id, 'users.read'], [id, 'ledger.adjustments.manage'], [id, 'ledger.adjustments.post']])
  })
  it('cannot reach the ledger after a permission denial', async () => {
    const h = harness(); h.rbac.assertPermission.mockRejectedValue(new Error('Forbidden'))
    await expect(h.controller.adjust(h.request, id, {} as never)).rejects.toThrow('Forbidden')
    expect(h.ledger.adjustUserBalance).not.toHaveBeenCalled()
  })
  it('accepts only the guard-produced authenticated service actor for delegated RBAC', async () => {
    const h = harness(true); await h.controller.detail(h.request, id)
    expect(h.rbac.assertPermission).not.toHaveBeenCalled()
    h.request.admin.sessionId = 'forged'
    await h.controller.detail(h.request, id)
    expect(h.rbac.assertPermission).toHaveBeenCalledWith(id, 'users.read')
  })
  it('rejects incomplete or oversized adjustment payloads and invalid list bounds', async () => {
    expect(await validate(plainToInstance(AdminUserAdjustmentDto, { operationId: 'bad', mode: 'credit', amount: '1e3', expectedAtomicBalance: '-1', reason: 'x' }))).toHaveLength(4)
    expect(await validate(plainToInstance(AdminUserListDto, { limit: 101, offset: -1, status: 'unknown' }))).toHaveLength(3)
  })
})
