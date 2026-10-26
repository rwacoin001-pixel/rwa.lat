import { Body, Controller, Get, Param, Post, Query, Sse, UseGuards, type MessageEvent } from '@nestjs/common'
import { distinctUntilChanged, from, interval, map, merge, startWith, switchMap, type Observable } from 'rxjs'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { assertAdminPermission } from '../admin-rbac/admin-authorization'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { NotificationService } from './notification.service'
import { ListNotificationsQueryDto, CreateNotificationDto } from './notification.dto'
import { NotificationDeliveryService } from './notification-delivery.service'

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationController {
  constructor(private readonly svc: NotificationService, private readonly delivery: NotificationDeliveryService) {}

  @Get('channels')
  channels() { return this.delivery.channels() }

  @Get()
  list(
    @CurrentAuth() actor: SecurityActor,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.svc.listForUser(actor.userId, query.channel, query.kind, query.filter)
  }

  /**
   * Live unread count for the AI buddy: the current count at once, then again whenever it changes (checked every
   * 10 s), plus a keep-alive every 25 s so proxies hold the stream open. Clients read it with fetch + Authorization.
   */
  @Sse('stream')
  stream(@CurrentAuth() actor: SecurityActor): Observable<MessageEvent> {
    const counts = interval(10_000).pipe(
      startWith(0),
      switchMap(() => from(this.svc.countUnread(actor.userId))),
      distinctUntilChanged(),
      map((unread): MessageEvent => ({ type: 'unread', data: { unread } })),
    )
    const keepAlive = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })))
    return merge(counts, keepAlive)
  }

  @Post(':id/read')
  markRead(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.markRead(id, actor.userId)
  }

  @Post('read-all')
  markAllRead(@CurrentAuth() actor: SecurityActor) {
    return this.svc.markAllRead(actor.userId)
  }
}

@Controller('admin/notifications')
@UseGuards(AdminSessionGuard)
export class AdminNotificationController {
  constructor(
    private readonly svc: NotificationService,
    private readonly rbac: AdminRbacService,
    private readonly delivery: NotificationDeliveryService,
  ) {}

  @Get()
  async list(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string, @Query('kind') kind?: string) {
    await assertAdminPermission(admin, this.rbac, 'notifications.manage')
    return this.svc.listForAdmin(limit ? Number(limit) : 100, kind)
  }

  @Post()
  async create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateNotificationDto) {
    await assertAdminPermission(admin, this.rbac, 'notifications.manage')
    const note = await this.delivery.enqueue(dto, admin.id)
    return { id: note.id, recipientUserId: note.recipient_user_id, channel: note.channel, kind: note.kind, title: note.title, body: note.body, payload: note.payload, readAt: note.read_at, createdAt: note.created_at }
  }

  @Get('channels')
  async channels(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await assertAdminPermission(admin, this.rbac, 'notifications.manage')
    return this.delivery.channels()
  }
}
