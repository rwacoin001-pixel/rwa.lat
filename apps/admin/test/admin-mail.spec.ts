import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AdminMailController } from '../src/admin-mail.controller'
import { AdminMailReplyDto, AdminMailStateDto } from '../src/admin-mail.dto'
import { AdminPermissionGuard } from '../src/admin-permission.guard'

describe('admin inbox boundary', () => {
  const core = { get: jest.fn(), post: jest.fn() }
  const controller = new AdminMailController(core as any)
  const request = { admin: { id: 'session-admin' } } as any
  beforeEach(() => jest.clearAllMocks())
  it.each(['list', 'count', 'attachment', 'thread', 'state', 'reply'] as const)('requires mail.read for %s', method => {
    const guard = new AdminPermissionGuard(new Reflector())
    const context = { getHandler: () => controller[method], getClass: () => AdminMailController, switchToHttp: () => ({ getRequest: () => ({ admin: { permissions: ['mail.reply'] } }) }) }
    expect(() => guard.canActivate(context as any)).toThrow('mail.read')
  })
  it('requires both permissions to reply', () => {
    const guard = new AdminPermissionGuard(new Reflector())
    const context = (permissions: string[]) => ({ getHandler: () => controller.reply, getClass: () => AdminMailController, switchToHttp: () => ({ getRequest: () => ({ admin: { permissions } }) }) })
    expect(() => guard.canActivate(context(['mail.read']) as any)).toThrow('mail.reply')
    expect(guard.canActivate(context(['mail.read', 'mail.reply']) as any)).toBe(true)
  })
  it('forwards the session identity, never a client actor', () => {
    controller.state(request, 'thread', { assign: 'me' })
    expect(core.post).toHaveBeenCalledWith('session-admin', '/mail/thread/state', { assign: 'me' })
    expect(() => controller.list({} as any, {})).toThrow('Admin session is required')
  })
  it('validates reply idempotency keys and forbids client identity fields', async () => {
    const options = { whitelist: true, forbidNonWhitelisted: true }
    expect(await validate(plainToInstance(AdminMailReplyDto, { text: 'answer', replyAll: false, requestKey: 'invalid' }), options)).not.toHaveLength(0)
    expect(await validate(plainToInstance(AdminMailStateDto, { assign: 'me', userId: 'attacker' }), options)).not.toHaveLength(0)
  })
  it('downloads exact binary bytes with safe content disposition and no caching', async () => {
    core.get.mockResolvedValue({ filename: '客户 "file".bin', content: 'AP+A' })
    const response = { setHeader: jest.fn(), send: jest.fn() }
    await controller.attachment(request, 'attachment', response as any)
    expect(response.send).toHaveBeenCalledWith(Buffer.from([0,255,128]))
    expect(response.setHeader).toHaveBeenCalledWith('content-type', 'application/octet-stream')
    expect(response.setHeader).toHaveBeenCalledWith('cache-control', 'private, no-store')
    expect(response.setHeader.mock.calls.find(c => c[0] === 'content-disposition')![1]).toContain('%22file%22')
  })
})
