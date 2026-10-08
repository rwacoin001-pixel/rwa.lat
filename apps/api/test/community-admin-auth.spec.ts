import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { AdminSessionGuard } from '../src/admin-rbac/admin-session.guard'
import { AdminCommunityMemberController } from '../src/community/community-member.controller'

const id = '078c875a-fc72-4ce0-904b-3731bd46927c'
const serviceToken = 'community-service-channel-test-token-32-bytes'
const ordinary = { id, roleId: 'core-role', roleName: 'reviewer', sessionId: 'core-session', permissions: ['community.content.review'], email: 'test@example.com' }

function harness() {
  const member = { publications: jest.fn().mockResolvedValue([{ id: 'post-1' }]), moderate: jest.fn().mockResolvedValue({ state: 'hidden' }) }
  const rbac = { assertPermission: jest.fn().mockResolvedValue(undefined) }
  const sessions = { authenticate: jest.fn().mockResolvedValue(ordinary) }
  const guard = new AdminSessionGuard(new Reflector(), sessions as never, new ConfigService({ ADMIN_SERVICE_TOKEN: serviceToken }))
  const controller = new AdminCommunityMemberController(member as never, rbac as never)
  const request: any = { headers: {} }
  const context = { getHandler: () => controller.list, getClass: () => AdminCommunityMemberController, switchToHttp: () => ({ getRequest: () => request }) } as any
  return { member, rbac, sessions, guard, controller, request, context }
}

describe('Community publication authorization across admin databases', () => {
  it('reads publications through the verified service channel even when its audit-only core principal has no permissions', async () => {
    const h = harness()
    h.rbac.assertPermission.mockRejectedValue(new ForbiddenException('Missing permission: community.content.review'))
    h.request.headers = { authorization: `Bearer ${serviceToken}`, 'x-actor-admin-id': id }
    await h.guard.canActivate(h.context)
    await expect(h.controller.list(h.request.admin)).resolves.toEqual([{ id: 'post-1' }])
    expect(h.rbac.assertPermission).not.toHaveBeenCalled()
    expect(h.sessions.authenticate).not.toHaveBeenCalled()
  })

  it('preserves the verified administrator ID for moderation auditing', async () => {
    const h = harness()
    h.rbac.assertPermission.mockRejectedValue(new ForbiddenException())
    h.request.headers = { authorization: `Bearer ${serviceToken}`, 'x-actor-admin-id': id }
    await h.guard.canActivate(h.context)
    const body = { targetType: 'post', targetId: 'post-1', state: 'hidden', reason: 'Test moderation' } as const
    await h.controller.moderate(h.request.admin, body as never)
    expect(h.member.moderate).toHaveBeenCalledWith(body, id)
    expect(h.rbac.assertPermission).not.toHaveBeenCalled()
  })

  it('continues enforcing core RBAC on ordinary administrator sessions', async () => {
    const h = harness()
    h.request.headers = { authorization: 'Bearer real-core-session' }
    await h.guard.canActivate(h.context)
    await h.controller.list(h.request.admin)
    await h.controller.moderate(h.request.admin, {} as never)
    expect(h.rbac.assertPermission.mock.calls).toEqual([[id, 'community.content.review'], [id, 'community.content.review']])
  })

  it('cannot read or moderate after an ordinary administrator permission denial', async () => {
    const h = harness()
    h.rbac.assertPermission.mockRejectedValue(new ForbiddenException())
    await expect(h.controller.list(ordinary)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(h.controller.moderate(ordinary, {} as never)).rejects.toBeInstanceOf(ForbiddenException)
    expect(h.member.publications).not.toHaveBeenCalled()
    expect(h.member.moderate).not.toHaveBeenCalled()
  })

  it.each([
    { roleId: 'other-role', sessionId: `service:${id}`, permissions: ['*'] },
    { roleId: 'service-channel', sessionId: 'other-session', permissions: ['*'] },
    { roleId: 'service-channel', sessionId: `service:${id}`, permissions: [] },
  ])('does not delegate RBAC for an incomplete service identity: %j', async fields => {
    const h = harness()
    h.rbac.assertPermission.mockRejectedValue(new ForbiddenException())
    await expect(h.controller.list({ ...ordinary, ...fields })).rejects.toBeInstanceOf(ForbiddenException)
    expect(h.rbac.assertPermission).toHaveBeenCalledWith(id, 'community.content.review')
  })

  it('rejects an invalid service token instead of trusting its actor header', async () => {
    const h = harness()
    h.sessions.authenticate.mockRejectedValue(new UnauthorizedException())
    h.request.headers = { authorization: 'Bearer forged-service-token', 'x-actor-admin-id': id }
    await expect(h.guard.canActivate(h.context)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(h.request.admin).toBeUndefined()
    expect(h.member.publications).not.toHaveBeenCalled()
  })

  it.each([undefined, 'invalid-admin-id'])('rejects a missing or invalid service actor: %s', async actor => {
    const h = harness()
    h.request.headers = { authorization: `Bearer ${serviceToken}`, 'x-actor-admin-id': actor }
    await expect(h.guard.canActivate(h.context)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(h.request.admin).toBeUndefined()
  })

  it('rejects requests without authentication', async () => {
    const h = harness()
    await expect(h.guard.canActivate(h.context)).rejects.toBeInstanceOf(UnauthorizedException)
    expect(h.member.publications).not.toHaveBeenCalled()
  })
})
