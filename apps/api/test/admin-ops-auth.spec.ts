import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { AdminSessionGuard } from '../src/admin-rbac/admin-session.guard'
import { AdminConsoleController } from '../src/admin-console/admin-console.controller'
import { ReferralAdminFoundationController } from '../src/referral/referral-http.module'
import { AdminSupportController } from '../src/notification/user-ops.controller'
import { AdminNotificationController } from '../src/notification/notification.controller'
import { JobQueueAdminController } from '../src/job-queue/job-queue.controller'
import { AdminNativeKycController } from '../src/compliance/admin-native-kyc.controller'
import { ComplianceController } from '../src/compliance/compliance.controller'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'

const id = '078c875a-fc72-4ce0-904b-3731bd46927c'
const token = 'admin-ops-service-token-at-least-thirty-two-bytes'
const ordinary = { id, email: 'operator@example.test', roleId: 'core-role', roleName: 'operator', permissions: [], sessionId: 'real-session' }
const methods = ['listAiAnalysis', 'listAssets', 'listYieldBatches', 'listSettlements', 'listCollections', 'listNetworks', 'listKycCases', 'listEligibility', 'listRiskFlags', 'overview', 'settings', 'reconcile', 'saveSettings', 'rollbackSettings', 'listTicketsForAdmin', 'getTicketTimelineForAdmin', 'respondToTicket', 'listByState', 'listDead', 'listUnprocessedCallbacks', 'replay', 'listForAdmin', 'channels', 'enqueue', 'reviewEvidence', 'decideKyc', 'toPublicKycCase']
type Harness = ReturnType<typeof harness>
function harness() {
  const svc: any = Object.fromEntries(methods.map(name => [name, jest.fn().mockResolvedValue({ ok: true })]))
  for (const name of ['list','detail','generateMonth','approve','pay']) svc[name]=jest.fn().mockResolvedValue({ok:true})
  const rbac = { assertPermission: jest.fn().mockRejectedValue(new ForbiddenException('Disabled audit-only principal')) }
  const sessions = { authenticate: jest.fn().mockResolvedValue(ordinary) }
  const guard = new AdminSessionGuard(new Reflector(), sessions as never, new ConfigService({ ADMIN_SERVICE_TOKEN: token }))
  return { svc, rbac, sessions, guard,
    console: new AdminConsoleController(svc, rbac as never),
    referral: new ReferralAdminFoundationController(svc, rbac as never, svc, svc),
    support: new AdminSupportController(svc, rbac as never),
    jobs: new JobQueueAdminController(svc, rbac as never),
    notifications: new AdminNotificationController(svc, rbac as never, svc),
    kyc: new AdminNativeKycController(svc, svc, rbac as never),
    legacyKyc: new ComplianceController(svc, svc, rbac as never, svc),
  }
}
const routes: Array<[string, string, (h: Harness, admin: any) => Promise<unknown>]> = [
  ...['aiAnalysis', 'assets', 'yields', 'settlements', 'collections', 'networks', 'kyc', 'eligibility', 'riskFlags'].map(method => [method, 'console.view', (h: Harness, a: any) => (h.console as any)[method](a)] as [string, string, (h: Harness, a: any) => Promise<unknown>]),
  ['referral settings', 'platform.manage', (h, a) => h.referral.settings(a)],
  ['referral overview', 'platform.manage', (h, a) => h.referral.overview(a)],
  ['team batches', 'platform.manage', (h, a) => h.referral.teamBatches(a)],
  ['team detail', 'platform.manage', (h, a) => h.referral.teamDetail(a,id)],
  ['team generation', 'platform.manage', (h, a) => h.referral.generateTeam(a, {month:'2026-09'})],
  ['team approval', 'platform.manage', (h, a) => h.referral.approveTeam(a, id)],
  ['team payment', 'platform.manage', (h, a) => h.referral.payTeam(a, id, 'test-payment')],
  ['referral reconciliation', 'platform.manage', (h, a) => h.referral.reconcile(a)],
  ['tickets', 'support.tickets.manage', (h, a) => h.support.list(a, {})],
  ['ticket timeline', 'support.tickets.manage', (h, a) => h.support.timeline(a, 'ticket')],
  ['jobs', 'operations.jobs.manage', (h, a) => h.jobs.list(a, 'default')],
  ['dead jobs', 'operations.jobs.manage', (h, a) => h.jobs.listDead(a, 'default')],
  ['callbacks', 'operations.jobs.manage', (h, a) => h.jobs.listUnprocessedCallbacks(a)],
  ['notifications', 'notifications.manage', (h, a) => h.notifications.list(a)],
  ['notification channels', 'notifications.manage', (h, a) => h.notifications.channels(a)],
  ['KYC evidence', 'compliance.manage', (h, a) => h.kyc.checks(a, 'case')],
  ['KYC decision', 'compliance.manage', (h, a) => h.kyc.decide(a, 'case', { decision: 'approved', reasonCode: 'verified' } as never)],
  ['legacy KYC decision', 'compliance.manage', (h, a) => h.legacyKyc.decideKyc(a, 'case', { decision: 'approved' } as never)],
  ['notification create', 'notifications.manage', (h, a) => h.notifications.create(a, {} as never)],
  ['ticket respond', 'support.tickets.manage', (h, a) => h.support.respond(a, 'ticket', { body: 'response', status: 'resolved' } as never)],
  ['job replay', 'operations.jobs.manage', (h, a) => h.jobs.replay(a, 'job')],
  ['referral save', 'platform.manage', (h, a) => h.referral.save(a, { config: {} } as never)],
  ['referral rollback', 'platform.manage', (h, a) => h.referral.rollback(a, { version: 1 } as never)],
]
async function authenticate(h: Harness, headers: Record<string, string>) {
  const req: any = { headers }
  await h.guard.canActivate({ getHandler: () => h.console.assets, getClass: () => AdminConsoleController, switchToHttp: () => ({ getRequest: () => req }) } as any)
  return req.admin
}
describe('Operations authorization across separate admin and core databases', () => {
  it.each(routes)('verified service actor reaches %s despite disabled core audit identity', async (_name, _permission, call) => {
    const h = harness()
    const actor = await authenticate(h, { authorization: `Bearer ${token}`, 'x-actor-admin-id': id })
    await expect(call(h, actor)).resolves.toBeDefined()
    expect(h.rbac.assertPermission).not.toHaveBeenCalled()
    expect(h.sessions.authenticate).not.toHaveBeenCalled()
  })
  it.each(routes)('ordinary or disabled core session still requires permission for %s', async (_name, permission, call) => {
    const h = harness()
    await expect(call(h, ordinary)).rejects.toBeInstanceOf(ForbiddenException)
    expect(h.rbac.assertPermission).toHaveBeenCalledWith(id, permission)
    methods.forEach(method => expect(h.svc[method]).not.toHaveBeenCalled())
  })
  it('keeps the verified admin ID for notification and KYC audit attribution', async () => {
    const h = harness()
    const actor = await authenticate(h, { authorization: `Bearer ${token}`, 'x-actor-admin-id': id })
    const notification = {} as never
    await h.notifications.create(actor, notification)
    expect(h.svc.enqueue).toHaveBeenCalledWith(notification, id)
    await h.kyc.decide(actor, 'case', { decision: 'approved', reasonCode: 'verified' } as never)
    expect(h.svc.decideKyc).toHaveBeenCalledWith('case', 'approved', 'verified', id)
  })
  it.each([
    { roleId: 'other-role', sessionId: `service:${id}`, permissions: ['*'] },
    { roleId: 'service-channel', sessionId: 'forged', permissions: ['*'] },
    { roleId: 'service-channel', sessionId: `service:${id}`, permissions: [] },
  ])('does not delegate an incomplete service identity: %j', async fields => {
    const h = harness()
    await expect(h.console.assets({ ...ordinary, ...fields })).rejects.toBeInstanceOf(ForbiddenException)
  })
  it('does not trust an actor header with an invalid token', async () => {
    const h = harness()
    h.sessions.authenticate.mockRejectedValue(new UnauthorizedException())
    await expect(authenticate(h, { authorization: 'Bearer invalid', 'x-actor-admin-id': id })).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it.each(['', 'not-a-uuid'])('rejects an invalid service actor: %s', async actor => {
    await expect(authenticate(harness(), { authorization: `Bearer ${token}`, 'x-actor-admin-id': actor })).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it('checks core permissions for a real session even when an actor header is supplied', async () => {
    const h = harness()
    const actor = await authenticate(h, { authorization: 'Bearer actual-session', 'x-actor-admin-id': id })
    await expect(h.console.assets(actor)).rejects.toBeInstanceOf(ForbiddenException)
    expect(h.sessions.authenticate).toHaveBeenCalledWith('actual-session')
  })
  it('allows a real core administrator after its own RBAC permits the operation', async () => {
    const h = harness()
    h.rbac.assertPermission.mockResolvedValue(undefined)
    await expect(h.console.assets(ordinary)).resolves.toEqual({ ok: true })
    expect(h.rbac.assertPermission).toHaveBeenCalledWith(id, 'console.view')
  })
})

describe('Operations service-channel HTTP matrix', () => {
  let app: INestApplication
  let base: string
  beforeAll(async () => {
    const h = harness()
    const controllers = [AdminConsoleController, ReferralAdminFoundationController, AdminSupportController, AdminNotificationController, JobQueueAdminController, AdminNativeKycController]
    const dependencies = new Set<any>(controllers.flatMap(controller => Reflect.getMetadata('design:paramtypes', controller)))
    const module = await Test.createTestingModule({ controllers, providers: [...dependencies].map(dependency => ({ provide: dependency, useValue: dependency.name === 'AdminRbacService' ? h.rbac : h.svc })) })
      .overrideGuard(AdminSessionGuard).useValue(h.guard).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('v1')
    await app.listen(0, '127.0.0.1')
    base = await app.getUrl()
  })
  afterAll(async () => { if (app) await app.close() })
  const paths = [
    '/admin/ai-analysis?limit=100', '/admin/assets?page=1&pageSize=50', '/admin/yields?limit=200', '/admin/settlements?limit=200',
    '/admin/referral/settings', '/admin/referral/overview?page=1&pageSize=20', '/admin/referral/reconciliation',
    '/admin/collections', '/admin/networks', '/admin/kyc?limit=200', '/admin/eligibility?limit=200', '/admin/risk-flags?limit=200',
    '/admin/tickets?limit=100', '/admin/tickets?category=appeal&limit=100', '/admin/tickets?category=dispute&limit=100',
    '/admin/job-queue/jobs?queueName=default&limit=100', '/admin/job-queue/jobs/dead?queueName=default&limit=100',
    '/admin/job-queue/callbacks/unprocessed?limit=100', '/admin/notifications?limit=100', '/admin/notifications/channels',
  ]
  it.each(paths)('serves the authenticated delegated request: %s', async path => {
    const response = await fetch(`${base}/v1${path}`, { headers: { authorization: `Bearer ${token}`, 'x-actor-admin-id': id } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
  it('rejects an unauthenticated request with only an actor header', async () => {
    const response = await fetch(`${base}/v1/admin/assets`, { headers: { 'x-actor-admin-id': id } })
    expect(response.status).toBe(401)
  })
  it('rejects a disabled ordinary session over HTTP', async () => {
    const response = await fetch(`${base}/v1/admin/assets`, { headers: { authorization: 'Bearer actual-core-session' } })
    expect(response.status).toBe(403)
  })
})
