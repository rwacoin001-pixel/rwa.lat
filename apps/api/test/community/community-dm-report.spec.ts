import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { CommunityDmController } from '../../src/community/community-dm.controller'
import { CommunityReportAuthGuard } from '../../src/community/community-report-auth.guard'
import { SessionAuthGuard } from '../../src/security/session-auth.guard'
import { CommunityService } from '../../src/community/community.service'
import { CommunityController } from '../../src/community/community.controller'

const dto = { targetType: 'dm_message' as const, targetId: 'private-message', reason: 'Please review this message' }
function setup(member = true) {
  const repo = { create: jest.fn(r => r), save: jest.fn(async r => ({ ...r, id: 'report', created_at: new Date(0) })) }
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('JOIN app.users')) return [{ id: 'session-profile', identity_configured: true, status: 'active', is_active: true }]
    if (sql.includes('SELECT msg.id')) return member ? [{ id: dto.targetId }] : []
    if (sql.includes('INSERT INTO app.audit_logs')) return []
    throw new Error('Unexpected query')
  })
  const db = { transaction: (work: (m: unknown) => unknown) => work({ query, getRepository: () => repo }) }
  const service = Reflect.construct(CommunityService, [...Array.from({ length: 9 }, () => ({})), {}, db]) as CommunityService
  return { service, repo, query }
}

describe('DM report scoping and route authentication', () => {
  it('guards all DM endpoints and the existing reports endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityDmController)).toContain(SessionAuthGuard)
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityController.prototype.report)).toContain(CommunityReportAuthGuard)
  })
  it('rejects unauthenticated private reports while keeping public reports anonymous', async () => {
    const sessions = { canActivate: jest.fn().mockRejectedValue(new UnauthorizedException()) }
    const guard = new CommunityReportAuthGuard(sessions as unknown as SessionAuthGuard)
    const context = (targetType: string) => ({ switchToHttp: () => ({ getRequest: () => ({ body: { targetType } }) }) }) as ExecutionContext
    expect(guard.canActivate(context('post'))).toBe(true)
    await expect(guard.canActivate(context('dm_message'))).rejects.toMatchObject({ status: 401 })
    await expect(setup().service.submitReport(dto)).rejects.toMatchObject({ status: 401 })
  })
  it('returns 404 for reports on another pair\'s messages', async () => {
    const { service, repo, query } = setup(false)
    await expect(service.submitReport(dto, 'session-user')).rejects.toMatchObject({ status: 404 })
    expect(repo.save).not.toHaveBeenCalled()
    const [sql, args] = query.mock.calls.find(([sql]) => sql.includes('SELECT msg.id'))! as unknown as [string, unknown[]]
    expect(sql).toContain('member.profile_id=$2')
    expect(args).toEqual([dto.targetId, 'session-profile'])
  })
  it('uses the session identity and existing moderation report store without logging the message body', async () => {
    const { service, repo, query } = setup()
    expect(await service.submitReport(dto, 'session-user')).toMatchObject({ id: 'report', state: 'open' })
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ profile_id: 'session-profile', target_type: 'dm_message', target_id: dto.targetId }))
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO app.audit_logs'))?.[0]).toContain('community.dm.report')
  })
  it('forwards only the session user to DM actions', async () => {
    const dm = { send: jest.fn() }
    const controller = new CommunityDmController(dm as any)
    controller.send({ userId: 'session-user', sessionId: 'session', deviceId: null }, 'thread', { body: 'hello', clientId: 'client' })
    expect(dm.send).toHaveBeenCalledWith('session-user', 'thread', { body: 'hello', clientId: 'client' })
  })
})
