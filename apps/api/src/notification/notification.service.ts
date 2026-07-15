import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { Notification } from './notification.entity'
import { NotificationError } from './notification.errors'

export interface NotificationView {
  id: string
  recipientUserId: string
  channel: string
  kind: string
  title: string
  body?: string
  readAt?: Date
  createdAt: Date
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async listForUser(
    userId: string,
    channel?: string,
    kind?: string,
    filter: 'unread' | 'read' | 'all' = 'all',
  ): Promise<NotificationView[]> {
    const where: Record<string, unknown> = { recipient_user_id: userId }
    if (channel) where.channel = channel
    if (kind) where.kind = kind

    const rows = await this.notificationRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 100,
    })
    if (filter === 'unread') {
      return rows.filter((r) => r.read_at == null).map((r) => this.toView(r))
    }
    if (filter === 'read') {
      return rows.filter((r) => r.read_at != null).map((r) => this.toView(r))
    }
    return rows.map((r) => this.toView(r))
  }

  async markRead(id: string, userId: string): Promise<NotificationView> {
    const note = await this.notificationRepo.findOne({
      where: { id, recipient_user_id: userId },
    })
    if (!note) throw NotificationError.notFound(id)
    if (!note.read_at) {
      note.read_at = new Date()
      await this.notificationRepo.save(note)
    }
    return this.toView(note)
  }

  async markAllRead(userId: string): Promise<{ markedCount: number }> {
    const result = await this.notificationRepo.update(
      { recipient_user_id: userId, read_at: IsNull() },
      { read_at: new Date() },
    )
    return { markedCount: result.affected ?? 0 }
  }

  async create(dto: {
    recipient_user_id: string
    channel: string
    kind: string
    title: string
    body?: string
    payload?: Record<string, unknown>
  }): Promise<NotificationView> {
    const note = await this.notificationRepo.save(
      this.notificationRepo.create({
        recipient_user_id: dto.recipient_user_id,
        channel: dto.channel as Notification['channel'],
        kind: dto.kind,
        title: dto.title,
        body: dto.body,
        payload: dto.payload ?? {},
      }),
    )
    return this.toView(note)
  }

  private toView(n: Notification): NotificationView {
    return {
      id: n.id,
      recipientUserId: n.recipient_user_id,
      channel: n.channel,
      kind: n.kind,
      title: n.title,
      body: n.body,
      readAt: n.read_at,
      createdAt: n.created_at,
    }
  }
}
