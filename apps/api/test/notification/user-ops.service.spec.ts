import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserOpsService } from '../../src/notification/user-ops.service'
import { Ticket } from '../../src/notification/ticket.entity'
import { TicketMessage } from '../../src/notification/ticket-message.entity'
import { TicketEvent } from '../../src/notification/ticket-event.entity'
import { Invitation } from '../../src/notification/invitation.entity'
import { Reward } from '../../src/notification/reward.entity'
import { Subscription } from '../../src/notification/subscription.entity'
import { Preference } from '../../src/notification/preference.entity'
import { NotFoundException } from '@nestjs/common'
import { ObjectStorageService } from '../../src/object-storage/object-storage.service'

const USER = '22222222-2222-2222-2222-222222222222'

function mkTicket(over: Partial<Ticket> = {}): Ticket {
  const t = new Ticket()
  Object.assign(t, { id: 't1', author_user_id: USER, subject: 's', body: 'b', status: 'open', priority: 'normal', created_at: new Date() }, over)
  return t
}

describe('UserOpsService (unit)', () => {
  let svc: UserOpsService
  let ticketRepo: jest.Mocked<Repository<Ticket>>
  let inviteRepo: jest.Mocked<Repository<Invitation>>
  let subRepo: jest.Mocked<Repository<Subscription>>
  let prefRepo: jest.Mocked<Repository<Preference>>
  let messageRepo: jest.Mocked<Repository<TicketMessage>>
  let storage: jest.Mocked<Pick<ObjectStorageService, 'assertCleanAttachmentIds'>>

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        UserOpsService,
        { provide: getRepositoryToken(Ticket), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => ({ ...e, id: e.id ?? 'tid' })), create: jest.fn((e) => Object.assign(new Ticket(), e)) } },
        { provide: getRepositoryToken(Invitation), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => ({ ...e, id: e.id ?? 'iid' })), create: jest.fn((e) => Object.assign(new Invitation(), e)) } },
        { provide: getRepositoryToken(Subscription), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => ({ ...e, id: e.id ?? 'sid' })) } },
        { provide: getRepositoryToken(Preference), useValue: { findOne: jest.fn(), save: jest.fn((e) => e), create: jest.fn((e) => Object.assign(new Preference(), e)) } },
        { provide: getRepositoryToken(Reward), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn((e) => ({ ...e, id: e.id ?? 'rid' })), create: jest.fn((e) => Object.assign(new Reward(), e)) } },
        { provide: getRepositoryToken(TicketMessage), useValue: { find: jest.fn().mockResolvedValue([]), save: jest.fn((e) => ({ ...e, id: e.id ?? 'mid' })), create: jest.fn((e) => Object.assign(new TicketMessage(), e)) } },
        { provide: getRepositoryToken(TicketEvent), useValue: { find: jest.fn().mockResolvedValue([]), save: jest.fn((e) => ({ ...e, id: e.id ?? 'eid' })), create: jest.fn((e) => Object.assign(new TicketEvent(), e)) } },
        { provide: ObjectStorageService, useValue: { assertCleanAttachmentIds: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile()
    svc = mod.get(UserOpsService)
    ticketRepo = mod.get(getRepositoryToken(Ticket))
    inviteRepo = mod.get(getRepositoryToken(Invitation))
    subRepo = mod.get(getRepositoryToken(Subscription))
    prefRepo = mod.get(getRepositoryToken(Preference))
    messageRepo = mod.get(getRepositoryToken(TicketMessage))
    storage = mod.get(ObjectStorageService)
  })

  it('createTicket persists a ticket', async () => {
    const r = await svc.createTicket({ author_user_id: USER, subject: 's', body: 'b' })
    expect(r.id).toBeDefined()
    expect(ticketRepo.save).toHaveBeenCalled()
  })

  it('stores only attachment IDs cleared by object storage for the same user', async () => {
    const objectId = '33333333-3333-4333-8333-333333333333'
    storage.assertCleanAttachmentIds.mockResolvedValue({ objectIds: [objectId] })
    await svc.createTicket({
      author_user_id: USER,
      subject: 'Evidence',
      body: 'Attached evidence',
      attachmentObjectIds: [objectId],
    })
    expect(storage.assertCleanAttachmentIds).toHaveBeenCalledWith([objectId], USER)
    expect(messageRepo.create).toHaveBeenCalledWith(expect.objectContaining({ attachments: { objectIds: [objectId] } }))
  })

  it('does not create a ticket when attachment clearance fails', async () => {
    storage.assertCleanAttachmentIds.mockRejectedValue(new Error('attachment pending'))
    await expect(svc.createTicket({
      author_user_id: USER,
      subject: 'Evidence',
      body: 'Attached evidence',
      attachmentObjectIds: ['33333333-3333-4333-8333-333333333333'],
    })).rejects.toThrow('attachment pending')
    expect(ticketRepo.save).not.toHaveBeenCalled()
  })

  it('closeTicket sets status=closed + closed_at', async () => {
    ticketRepo.findOne.mockResolvedValue(mkTicket({ id: 't1', status: 'open' }))
    const r = await svc.closeTicket('t1', USER)
    expect(r.status).toBe('closed')
    expect(r.closedAt).toBeDefined()
  })

  it('closeTicket idempotent when already closed', async () => {
    ticketRepo.findOne.mockResolvedValue(mkTicket({ id: 't1', status: 'closed', closed_at: new Date() }))
    const r = await svc.closeTicket('t1', USER)
    expect(r.status).toBe('closed')
    expect(ticketRepo.save).not.toHaveBeenCalled()
  })

  it('closeTicket throws NotFound for unknown id', async () => {
    ticketRepo.findOne.mockResolvedValue(null)
    await expect(svc.closeTicket('x', USER)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('createInvitation returns token + hashed token', async () => {
    const { view, token } = await svc.createInvitation({ inviter_user_id: USER, role: 'member' })
    expect(token).toHaveLength(48)
    expect(view.state).toBe('pending')
    expect(inviteRepo.save).toHaveBeenCalled()
  })

  it('revokeInvitation flips pending to revoked', async () => {
    const inv = new Invitation()
    Object.assign(inv, { id: 'i1', inviter_user_id: USER, role: 'member', state: 'pending', expires_at: new Date(), created_at: new Date() })
    inviteRepo.findOne.mockResolvedValue(inv)
    const r = await svc.revokeInvitation('i1', USER)
    expect(r.state).toBe('revoked')
    expect(inv.revoked_at).toBeDefined()
  })

  it('getPreferences returns defaults when none stored', async () => {
    prefRepo.findOne.mockResolvedValue(null)
    const r = await svc.getPreferences(USER)
    expect(r.userId).toBe(USER)
    expect(r.channels.in_app).toBe(true)
    expect(r.communicationConsent).toBe(false)
  })

  it('upsertPreferences persists channels + consent', async () => {
    const p = new Preference()
    Object.assign(p, { user_id: USER })
    prefRepo.findOne.mockResolvedValue(null)
    prefRepo.create.mockReturnValue(p)
    const r = await svc.upsertPreferences(USER, { channels: { in_app: true, email: true, sms: false, push: false }, communication_consent: true })
    expect(r.channels.email).toBe(true)
    expect(r.communicationConsent).toBe(true)
    expect(prefRepo.save).toHaveBeenCalled()
  })
})
