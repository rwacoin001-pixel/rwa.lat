import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { createHash, randomBytes } from 'crypto'
import { Ticket } from './ticket.entity'
import { TicketMessage } from './ticket-message.entity'
import { TicketEvent } from './ticket-event.entity'
import { Invitation } from './invitation.entity'
import { Reward } from './reward.entity'
import { Subscription } from './subscription.entity'
import { Preference } from './preference.entity'
import { NotificationError } from './notification.errors'
import { ObjectStorageService } from '../object-storage/object-storage.service'

export interface TicketView {
  id: string
  authorUserId: string
  subject: string
  body: string
  status: string
  priority: string
  category: string
  orderId?: string
  reference: string
  assignee?: string
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
}

export interface TicketMessageView {
  id: string
  actorType: string
  body: string
  attachments: Record<string, unknown>
  createdAt: Date
}

export interface TicketEventView {
  id: string
  eventType: string
  actorType: string
  previousStatus?: string
  nextStatus?: string
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface TicketTimelineView {
  ticket: TicketView
  messages: TicketMessageView[]
  events: TicketEventView[]
}

export interface InvitationView {
  id: string
  inviterUserId: string
  email?: string
  role: string
  state: string
  acceptedUserId?: string
  acceptedAt?: Date
  expiresAt: Date
  createdAt: Date
}

export interface RewardView {
  id: string
  userId: string
  kind: string
  amountAtomic: string
  currency: string
  state: string
  referenceType?: string
  referenceId?: string
  earnedAt: Date
}

export interface SubscriptionView {
  id: string
  userId: string
  plan: string
  version: number
  state: string
  currentPeriodStart: Date
  currentPeriodEnd: Date
}

export interface PreferenceView {
  userId: string
  locale?: string
  channels: Record<string, boolean>
  communicationConsent: boolean
  updatedAt: Date
}

@Injectable()
export class UserOpsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Invitation) private readonly inviteRepo: Repository<Invitation>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Preference) private readonly prefRepo: Repository<Preference>,
    @InjectRepository(Reward) private readonly rewardRepo: Repository<Reward>,
    @InjectRepository(TicketMessage) private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(TicketEvent) private readonly eventRepo: Repository<TicketEvent>,
    private readonly storage: ObjectStorageService,
  ) {}

  // ---- 工单 ----
  async createTicket(dto: {
    author_user_id: string
    subject: string
    body: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    category?: 'support' | 'dispute' | 'appeal' | 'scam_report'
    order_id?: string
    attachmentObjectIds?: string[]
  }): Promise<TicketView> {
    const attachments = await this.storage.assertCleanAttachmentIds(dto.attachmentObjectIds, dto.author_user_id)
    const t = await this.ticketRepo.save(
      this.ticketRepo.create({
        author_user_id: dto.author_user_id,
        subject: dto.subject,
        body: dto.body,
        priority: dto.priority ?? 'normal',
        category: dto.category ?? 'support',
        order_id: dto.order_id,
        updated_at: new Date(),
      }),
    )
    await this.messageRepo.save(this.messageRepo.create({
      ticket_id: t.id,
      actor_type: 'user',
      actor_user_id: dto.author_user_id,
      body: dto.body,
      attachments,
    }))
    await this.recordTicketEvent(t.id, 'created', 'user', dto.author_user_id, undefined, t.status, {
      category: t.category,
      orderId: t.order_id,
    })
    return this.toTicketView(t)
  }

  async listTickets(userId: string): Promise<TicketView[]> {
    const rows = await this.ticketRepo.find({
      where: { author_user_id: userId },
      order: { created_at: 'DESC' },
    })
    return rows.map((r) => this.toTicketView(r))
  }

  async getTicketTimeline(id: string, userId: string): Promise<TicketTimelineView> {
    const ticket = await this.ticketRepo.findOne({ where: { id, author_user_id: userId } })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    const [messages, events] = await Promise.all([
      this.messageRepo.find({ where: { ticket_id: id }, order: { created_at: 'ASC' } }),
      this.eventRepo.find({ where: { ticket_id: id }, order: { created_at: 'ASC' } }),
    ])
    return {
      ticket: this.toTicketView(ticket),
      messages: messages.map((message) => this.toTicketMessageView(message)),
      events: events.map((event) => this.toTicketEventView(event)),
    }
  }

  async addTicketMessage(id: string, userId: string, dto: { body: string; attachmentObjectIds?: string[] }): Promise<TicketTimelineView> {
    const ticket = await this.ticketRepo.findOne({ where: { id, author_user_id: userId } })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    if (ticket.status === 'closed') throw new ConflictException(`Ticket ${id} is closed`)
    const attachments = await this.storage.assertCleanAttachmentIds(dto.attachmentObjectIds, userId)
    await this.messageRepo.save(this.messageRepo.create({
      ticket_id: id,
      actor_type: 'user',
      actor_user_id: userId,
      body: dto.body,
      attachments,
    }))
    ticket.updated_at = new Date()
    await this.ticketRepo.save(ticket)
    await this.recordTicketEvent(id, 'message_added', 'user', userId, undefined, undefined, {})
    return this.getTicketTimeline(id, userId)
  }

  async respondToTicket(id: string, dto: {
    body: string
    status?: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'
    assignee?: string
    attachmentObjectIds?: string[]
  }): Promise<TicketTimelineView> {
    const ticket = await this.ticketRepo.findOne({ where: { id } })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    const previousStatus = ticket.status
    const nextStatus = dto.status ?? 'waiting_user'
    if (ticket.status === 'closed' && nextStatus !== 'closed') throw new ConflictException(`Ticket ${id} is closed`)
    const attachments = await this.storage.assertCleanAttachmentIds(dto.attachmentObjectIds)
    await this.messageRepo.save(this.messageRepo.create({
      ticket_id: id,
      actor_type: 'admin',
      body: dto.body,
      attachments,
    }))
    ticket.status = nextStatus
    ticket.assignee = dto.assignee ?? ticket.assignee
    ticket.closed_at = nextStatus === 'closed' ? new Date() : undefined
    ticket.updated_at = new Date()
    await this.ticketRepo.save(ticket)
    await this.recordTicketEvent(id, 'message_added', 'admin', undefined, undefined, undefined, {})
    if (previousStatus !== nextStatus) {
      await this.recordTicketEvent(id, 'status_changed', 'admin', undefined, previousStatus, nextStatus, {})
    }
    if (dto.assignee) {
      await this.recordTicketEvent(id, 'assigned', 'admin', undefined, undefined, undefined, { assignee: dto.assignee })
    }
    return this.loadTicketTimelineForAdmin(id)
  }

  async listTicketsForAdmin(status?: Ticket['status'], limit = 50): Promise<TicketView[]> {
    const rows = await this.ticketRepo.find({
      where: status ? { status } : {},
      order: { updated_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    })
    return rows.map((ticket) => this.toTicketView(ticket))
  }

  getTicketTimelineForAdmin(id: string): Promise<TicketTimelineView> {
    return this.loadTicketTimelineForAdmin(id)
  }

  async closeTicket(id: string, userId: string): Promise<TicketView> {
    const t = await this.ticketRepo.findOne({ where: { id, author_user_id: userId } })
    if (!t) throw new NotFoundException(`Ticket ${id} not found`)
    if (t.status !== 'closed') {
      t.status = 'closed'
      t.closed_at = new Date()
      t.updated_at = new Date()
      await this.ticketRepo.save(t)
      await this.recordTicketEvent(id, 'status_changed', 'user', userId, 'open', 'closed', {})
    }
    return this.toTicketView(t)
  }

  // ---- 邀请 ----
  async createInvitation(dto: {
    inviter_user_id: string
    email?: string
    role: string
    ttl_ms?: number
  }): Promise<{ view: InvitationView; token: string }> {
    const token = randomBytes(24).toString('hex')
    const token_hash = createHash('sha256').update(token).digest()
    const invite = await this.inviteRepo.save(
      this.inviteRepo.create({
        inviter_user_id: dto.inviter_user_id,
        email: dto.email,
        role: dto.role,
        state: 'pending',
        token_hash,
        expires_at: new Date(Date.now() + (dto.ttl_ms ?? 7 * 86400_000)),
      }),
    )
    return { view: this.toInvitationView(invite), token }
  }

  async listInvitations(userId: string): Promise<InvitationView[]> {
    const rows = await this.inviteRepo.find({
      where: { inviter_user_id: userId },
      order: { created_at: 'DESC' },
    })
    return rows.map((r) => this.toInvitationView(r))
  }

  async revokeInvitation(id: string, userId: string): Promise<InvitationView> {
    const inv = await this.inviteRepo.findOne({ where: { id, inviter_user_id: userId } })
    if (!inv) throw new NotFoundException(`Invitation ${id} not found`)
    if (inv.state === 'pending') {
      inv.state = 'revoked'
      inv.revoked_at = new Date()
      await this.inviteRepo.save(inv)
    }
    return this.toInvitationView(inv)
  }

  async acceptInvitation(token: string, userId: string): Promise<{ invitation: InvitationView; inviterReward: RewardView; inviteeReward: RewardView }> {
    if (!token || token.length < 16) throw new BadRequestException('Invitation token is invalid')
    const tokenHash = createHash('sha256').update(token).digest()
    const invitation = await this.inviteRepo.findOne({ where: { token_hash: tokenHash } })
    if (!invitation) throw new NotFoundException('Invitation not found')
    if (invitation.state !== 'pending') throw new ConflictException(`Invitation ${invitation.id} is ${invitation.state}`)
    if (invitation.expires_at.getTime() <= Date.now()) {
      invitation.state = 'expired'
      await this.inviteRepo.save(invitation)
      throw new ConflictException(`Invitation ${invitation.id} is expired`)
    }
    if (invitation.inviter_user_id === userId) throw new BadRequestException('Inviter cannot accept their own invitation')
    invitation.state = 'accepted'
    invitation.accepted_user_id = userId
    invitation.accepted_at = new Date()
    await this.inviteRepo.save(invitation)
    const [inviterReward, inviteeReward] = await Promise.all([
      this.ensureReferralReward(invitation.inviter_user_id, invitation.id),
      this.ensureReferralReward(userId, invitation.id),
    ])
    return {
      invitation: this.toInvitationView(invitation),
      inviterReward: this.toRewardView(inviterReward),
      inviteeReward: this.toRewardView(inviteeReward),
    }
  }

  async listRewards(userId: string): Promise<RewardView[]> {
    const rows = await this.rewardRepo.find({ where: { user_id: userId }, order: { earned_at: 'DESC' } })
    return rows.map((reward) => this.toRewardView(reward))
  }

  // ---- 订阅 ----
  async listSubscriptions(userId: string): Promise<SubscriptionView[]> {
    const rows = await this.subRepo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } })
    return rows.map((r) => this.toSubscriptionView(r))
  }

  async cancelSubscription(id: string, userId: string): Promise<SubscriptionView> {
    const s = await this.subRepo.findOne({ where: { id, user_id: userId } })
    if (!s) throw new NotFoundException(`Subscription ${id} not found`)
    if (s.state === 'active') {
      s.state = 'canceled'
      s.canceled_at = new Date()
      await this.subRepo.save(s)
    }
    return this.toSubscriptionView(s)
  }

  // ---- 偏好 ----
  async getPreferences(userId: string): Promise<PreferenceView> {
    const p = await this.prefRepo.findOne({ where: { user_id: userId } })
    if (!p) {
      // 返回默认偏好（不落库），保证调用方总能拿到结构
      return {
        userId,
        locale: undefined,
        channels: { in_app: true, email: false, sms: false, push: false },
        communicationConsent: false,
        updatedAt: new Date(0),
      }
    }
    return this.toPreferenceView(p)
  }

  async upsertPreferences(
    userId: string,
    dto: { locale?: string; channels?: Record<string, boolean>; communication_consent?: boolean },
  ): Promise<PreferenceView> {
    let p = await this.prefRepo.findOne({ where: { user_id: userId } })
    if (!p) p = this.prefRepo.create({ user_id: userId })
    if (dto.locale !== undefined) p.locale = dto.locale
    if (dto.channels !== undefined) p.channels = dto.channels
    if (dto.communication_consent !== undefined) p.communication_consent = dto.communication_consent
    const saved = await this.prefRepo.save(p)
    return this.toPreferenceView(saved)
  }

  private toTicketView(t: Ticket): TicketView {
    return {
      id: t.id,
      authorUserId: t.author_user_id,
      subject: t.subject,
      body: t.body,
      status: t.status,
      priority: t.priority,
      category: t.category,
      orderId: t.order_id,
      reference: `TKT-${t.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
      assignee: t.assignee,
      createdAt: t.created_at,
      updatedAt: t.updated_at ?? t.created_at,
      closedAt: t.closed_at,
    }
  }

  private toInvitationView(i: Invitation): InvitationView {
    return {
      id: i.id,
      inviterUserId: i.inviter_user_id,
      email: i.email,
      role: i.role,
      state: i.state,
      acceptedUserId: i.accepted_user_id,
      acceptedAt: i.accepted_at,
      expiresAt: i.expires_at,
      createdAt: i.created_at,
    }
  }

  private toSubscriptionView(s: Subscription): SubscriptionView {
    return {
      id: s.id,
      userId: s.user_id,
      plan: s.plan,
      version: s.version,
      state: s.state,
      currentPeriodStart: s.current_period_start,
      currentPeriodEnd: s.current_period_end,
    }
  }

  private toPreferenceView(p: Preference): PreferenceView {
    return {
      userId: p.user_id,
      locale: p.locale,
      channels: p.channels,
      communicationConsent: p.communication_consent,
      updatedAt: p.updated_at,
    }
  }

  private async loadTicketTimelineForAdmin(id: string): Promise<TicketTimelineView> {
    const ticket = await this.ticketRepo.findOne({ where: { id } })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    const [messages, events] = await Promise.all([
      this.messageRepo.find({ where: { ticket_id: id }, order: { created_at: 'ASC' } }),
      this.eventRepo.find({ where: { ticket_id: id }, order: { created_at: 'ASC' } }),
    ])
    return {
      ticket: this.toTicketView(ticket),
      messages: messages.map((message) => this.toTicketMessageView(message)),
      events: events.map((event) => this.toTicketEventView(event)),
    }
  }

  private async recordTicketEvent(
    ticketId: string,
    eventType: TicketEvent['event_type'],
    actorType: TicketEvent['actor_type'],
    actorUserId: string | undefined,
    previousStatus: string | undefined,
    nextStatus: string | undefined,
    metadata: Record<string, unknown>,
  ) {
    await this.eventRepo.save(this.eventRepo.create({
      ticket_id: ticketId,
      event_type: eventType,
      actor_type: actorType,
      actor_user_id: actorUserId,
      previous_status: previousStatus,
      next_status: nextStatus,
      metadata,
    }))
  }

  private async ensureReferralReward(userId: string, invitationId: string): Promise<Reward> {
    const existing = await this.rewardRepo.findOne({ where: { user_id: userId, kind: 'referral', ref_type: 'invitation', ref_id: invitationId } })
    if (existing) return existing
    return this.rewardRepo.save(this.rewardRepo.create({
      user_id: userId,
      kind: 'referral',
      amount_atomic: '1000000',
      currency: 'USD',
      state: 'earned',
      ref_type: 'invitation',
      ref_id: invitationId,
      earned_at: new Date(),
    }))
  }

  private toTicketMessageView(message: TicketMessage): TicketMessageView {
    return {
      id: message.id,
      actorType: message.actor_type,
      body: message.body,
      attachments: message.attachments,
      createdAt: message.created_at,
    }
  }

  private toTicketEventView(event: TicketEvent): TicketEventView {
    return {
      id: event.id,
      eventType: event.event_type,
      actorType: event.actor_type,
      previousStatus: event.previous_status,
      nextStatus: event.next_status,
      metadata: event.metadata,
      createdAt: event.created_at,
    }
  }

  private toRewardView(reward: Reward): RewardView {
    return {
      id: reward.id,
      userId: reward.user_id,
      kind: reward.kind,
      amountAtomic: reward.amount_atomic,
      currency: reward.currency,
      state: reward.state,
      referenceType: reward.ref_type,
      referenceId: reward.ref_id,
      earnedAt: reward.earned_at,
    }
  }
}
