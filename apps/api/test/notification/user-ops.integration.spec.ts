import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { Ticket } from '../../src/notification/ticket.entity'
import { TicketMessage } from '../../src/notification/ticket-message.entity'
import { TicketEvent } from '../../src/notification/ticket-event.entity'
import { Invitation } from '../../src/notification/invitation.entity'
import { Reward } from '../../src/notification/reward.entity'
import { Subscription } from '../../src/notification/subscription.entity'
import { Preference } from '../../src/notification/preference.entity'
import { UserOpsService } from '../../src/notification/user-ops.service'
import { NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'

const USER = '33333333-3333-3333-3333-333333333333'
const INVITEE = '44444444-4444-4444-4444-444444444444'

describe('API-012 user-ops integration (PG)', () => {
  let ds: DataSource
  let svc: UserOpsService

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await ds.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await ds.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy()
  })

  beforeEach(async () => {
    await ds.query(
      `INSERT INTO app.users (id, status, locale, created_at, updated_at)
       VALUES ($1, 'active', 'en', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await ds.query(
      `INSERT INTO app.users (id, status, locale, created_at, updated_at)
       VALUES ($1, 'active', 'en', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [INVITEE],
    )
    await ds.query(`TRUNCATE TABLE app.tickets, app.invitations, app.rewards, app.subscriptions, app.preferences RESTART IDENTITY CASCADE`)
  })

  const service = () => new UserOpsService(
    ds.getRepository(Ticket),
    ds.getRepository(Invitation),
    ds.getRepository(Subscription),
    ds.getRepository(Preference),
    ds.getRepository(Reward),
    ds.getRepository(TicketMessage),
    ds.getRepository(TicketEvent),
    { assertCleanAttachmentIds: jest.fn().mockResolvedValue([]) } as any,
  )

  it('ticket create -> list -> close lifecycle', async () => {
    svc = service()
    const t = await svc.createTicket({ author_user_id: USER, subject: 'help', body: 'x' })
    expect(t.id).toBeDefined()

    const list = await svc.listTickets(USER)
    expect(list).toHaveLength(1)

    const closed = await svc.closeTicket(t.id, USER)
    expect(closed.status).toBe('closed')
    expect(closed.closedAt).toBeDefined()
  })

  it('closeTicket throws NotFound for unknown', async () => {
    svc = service()
    await expect(svc.closeTicket('deadbeef-dead-dead-dead-deaddeaddead', USER)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('invitation create -> revoke flips state', async () => {
    svc = service()
    const { view } = await svc.createInvitation({ inviter_user_id: USER, role: 'member' })
    expect(view.state).toBe('pending')

    const revoked = await svc.revokeInvitation(view.id, USER)
    expect(revoked.state).toBe('revoked')
  })

  it('accepting an invitation persists both referral reward records', async () => {
    svc = service()
    const { token } = await svc.createInvitation({ inviter_user_id: USER, role: 'member' })
    const accepted = await svc.acceptInvitation(token, INVITEE)
    expect(accepted.invitation.state).toBe('accepted')
    expect(accepted.inviterReward.state).toBe('earned')
    expect(accepted.inviteeReward.userId).toBe(INVITEE)
    await expect(svc.listRewards(USER)).resolves.toHaveLength(1)
    await expect(svc.listRewards(INVITEE)).resolves.toHaveLength(1)
  })

  it('support replies and status changes are visible in the user timeline', async () => {
    svc = service()
    const ticket = await svc.createTicket({ author_user_id: USER, subject: 'dispute', body: 'please review', category: 'dispute' })
    const adminTimeline = await svc.respondToTicket(ticket.id, {
      body: 'We are reviewing your request.',
      status: 'investigating',
      assignee: 'demo-ops',
    })
    expect(adminTimeline.ticket.status).toBe('investigating')
    expect(adminTimeline.messages).toHaveLength(2)
    expect(adminTimeline.events.some((event) => event.eventType === 'status_changed')).toBe(true)
    const userTimeline = await svc.getTicketTimeline(ticket.id, USER)
    expect(userTimeline.messages.at(-1)?.actorType).toBe('admin')
  })

  it('subscription cancel flips active -> canceled', async () => {
    svc = service()
    const sub = await ds.getRepository(Subscription).save(
      ds.getRepository(Subscription).create({
        user_id: USER,
        plan: 'pro',
        current_period_start: new Date(Date.now() - 86400_000),
        current_period_end: new Date(Date.now() + 86400_000),
      }),
    )
    const canceled = await svc.cancelSubscription(sub.id, USER)
    expect(canceled.state).toBe('canceled')
  })

  it('preferences upsert then get reflects stored values', async () => {
    svc = service()
    const upserted = await svc.upsertPreferences(USER, {
      locale: 'zh',
      channels: { in_app: true, email: true, sms: false, push: false },
      communication_consent: true,
    })
    expect(upserted.locale).toBe('zh')
    expect(upserted.communicationConsent).toBe(true)

    const got = await svc.getPreferences(USER)
    expect(got.locale).toBe('zh')
    expect(got.channels.email).toBe(true)
  })
})
