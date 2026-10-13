import { ConfigService } from '@nestjs/config'
import { HttpException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AdminCoreOpsService } from '../src/admin-core-ops.service'
import { AdminCoreOpsController } from '../src/admin-core-ops.controller'
import { AdminPermissionGuard } from '../src/admin-permission.guard'

const originalFetch = global.fetch
function service() { return new AdminCoreOpsService(new ConfigService({ CORE_API_URL: 'http://core.test/v1', ADMIN_SERVICE_TOKEN: 'core-channel-test-token-at-least-thirty-two-bytes' })) }
async function failure(promise: Promise<unknown>) {
  try { await promise; throw new Error('Expected failure') } catch (error) { if (!(error instanceof HttpException)) throw error; return error }
}
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers() })
describe('Admin core operations upstream errors', () => {
  it.each([400, 401, 403, 404, 409, 422, 429])('preserves upstream HTTP %s and safe structured details', async status => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'admin.permission.denied', message: 'Missing permission', stack: 'private', token: 'private' } }), { status }))
    const error = await failure(service().get('actor', '/assets'))
    expect(error.getStatus()).toBe(status)
    expect(error.getResponse()).toEqual({ code: 'admin.permission.denied', message: 'Missing permission' })
  })
  it('does not expose an upstream internal error', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'SQL password=private internal stack' } }), { status: 500 }))
    const error = await failure(service().get('actor', '/assets'))
    expect(error.getStatus()).toBe(502)
    expect(JSON.stringify(error.getResponse())).not.toContain('private')
  })
  it.each([
    { message: ['amount must be positive', 'user id must be UUID', { internal: 'private' }] },
    { error: { message: ['amount must be positive', 'user id must be UUID', { internal: 'private' }] } },
  ])('preserves validation message arrays without forwarding objects: %j', async payload => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 400 }))
    const error = await failure(service().get('actor', '/assets'))
    expect(error.getStatus()).toBe(400)
    expect(error.getResponse()).toEqual({ code: 'CORE_ADMIN_OPS_REJECTED', message: 'amount must be positive; user id must be UUID' })
  })
  it('returns unavailable for connection failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'))
    expect((await failure(service().get('actor', '/assets'))).getStatus()).toBe(503)
  })
  it('returns gateway timeout for an aborted request', async () => {
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    expect((await failure(service().get('actor', '/assets'))).getStatus()).toBe(504)
  })
  it('preserves successful response and encoded query contract', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })))
    await expect(service().get('actor', '/assets', { search: 'a & b', page: 1 })).resolves.toEqual({ items: [], total: 0 })
    expect(global.fetch).toHaveBeenCalledWith('http://core.test/v1/admin/assets?search=a+%26+b&page=1', expect.objectContaining({ headers: expect.objectContaining({ 'x-actor-admin-id': 'actor' }) }))
  })
  it('rejects malformed success responses instead of presenting empty data', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<html>Error</html>'))
    expect((await failure(service().get('actor', '/assets'))).getStatus()).toBe(502)
  })
  it('preserves a valid JSON null response', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('null'))
    await expect(service().get('actor', '/optional')).resolves.toBeNull()
  })
  it('still denies a gateway administrator without the required console permission', () => {
    const guard = new AdminPermissionGuard(new Reflector())
    const context = { getClass: () => AdminCoreOpsController, getHandler: () => AdminCoreOpsController.prototype.consoleAssets, switchToHttp: () => ({ getRequest: () => ({ admin: { permissions: [] } }) }) } as any
    expect(() => guard.canActivate(context)).toThrow(HttpException)
  })
})

describe('Admin funds overview route', () => {
  it('requires ledger.reconciliation.manage and forwards to the core funds summary', async () => {
    const reflector = new Reflector()
    const required = reflector.get<string[]>('admin:required-permissions', AdminCoreOpsController.prototype.consoleFunds)
    expect(required).toEqual(['ledger.reconciliation.manage'])
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ balances: {} }), { status: 200 }))
    global.fetch = fetchMock
    const controller = new AdminCoreOpsController(service())
    await controller.consoleFunds({ admin: { id: '00000000-0000-4000-8000-000000000001' } } as never, { days: '7' })
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://core.test/v1/admin/funds/summary?days=7')
  })
})

describe('Admin activity overview route', () => {
  it('requires users.read and forwards to the core activity summary', async () => {
    const required = new Reflector().get<string[]>('admin:required-permissions', AdminCoreOpsController.prototype.consoleActivity)
    expect(required).toEqual(['users.read'])
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ series: [] }), { status: 200 }))
    global.fetch = fetchMock
    await new AdminCoreOpsController(service()).consoleActivity({ admin: { id: '00000000-0000-4000-8000-000000000001' } } as never, { days: '30' })
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://core.test/v1/admin/activity/summary?days=30')
  })
})
