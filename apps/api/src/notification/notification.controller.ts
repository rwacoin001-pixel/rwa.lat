import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { NotificationService } from './notification.service'
import { ListNotificationsQueryDto, CreateNotificationDto } from './notification.dto'

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  list(
    @CurrentAuth() actor: SecurityActor,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.svc.listForUser(actor.userId, query.channel, query.kind, query.filter)
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
  ) {}

  @Post()
  async create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateNotificationDto) {
    await this.rbac.assertPermission(admin.id, 'notifications.manage')
    return this.svc.create(dto)
  }
}
