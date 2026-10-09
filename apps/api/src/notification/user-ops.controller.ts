import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { UserOpsService } from './user-ops.service'
import {
  AcceptInvitationDto,
  AcceptInvitationResultResponseDto,
  AdminTicketListQueryDto,
  AdminTicketResponseDto,
  CreateInvitationDto,
  CreateTicketDto,
  CreateTicketMessageDto,
  RewardViewResponseDto,
  UpsertPreferencesDto,
} from './user-ops.dto'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { assertAdminPermission } from '../admin-rbac/admin-authorization'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'

@Controller('user-ops')
@UseGuards(SessionAuthGuard)
export class UserOpsController {
  constructor(private readonly svc: UserOpsService) {}

  // 工单
  @Post('tickets')
  createTicket(@CurrentAuth() actor: SecurityActor, @Body() dto: CreateTicketDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.svc.createTicket({
      author_user_id: actor.userId,
      idempotencyKey,
      subject: dto.subject,
      body: dto.body,
      priority: dto.priority,
      category: dto.category,
      order_id: dto.order_id,
      attachmentObjectIds: dto.attachmentObjectIds,
    })
  }

  @Get('tickets/:id/timeline')
  getTicketTimeline(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.getTicketTimeline(id, actor.userId)
  }

  @Post('tickets/:id/messages')
  addTicketMessage(@CurrentAuth() actor: SecurityActor, @Param('id') id: string, @Body() dto: CreateTicketMessageDto) {
    return this.svc.addTicketMessage(id, actor.userId, dto)
  }

  @Get('tickets')
  listTickets(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listTickets(actor.userId)
  }

  @Put('tickets/:id/close')
  closeTicket(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.closeTicket(id, actor.userId)
  }

  // 邀请
  @Post('invitations')
  createInvitation(@CurrentAuth() actor: SecurityActor, @Body() dto: CreateInvitationDto) {
    return this.svc.createInvitation({
      inviter_user_id: actor.userId,
      email: dto.email,
      role: dto.role,
      ttl_ms: dto.ttl_ms,
    })
  }

  @Get('invitations')
  listInvitations(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listInvitations(actor.userId)
  }

  @Put('invitations/:id/revoke')
  revokeInvitation(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.revokeInvitation(id, actor.userId)
  }

  @Post('invitations/accept')
  @ApiOkResponse({ type: AcceptInvitationResultResponseDto })
  acceptInvitation(@CurrentAuth() actor: SecurityActor, @Body() dto: AcceptInvitationDto) {
    return this.svc.acceptInvitation(dto.token, actor.userId)
  }

  @Get('rewards')
  @ApiOkResponse({ type: RewardViewResponseDto, isArray: true })
  listRewards(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listRewards(actor.userId)
  }

  // 订阅
  @Get('subscriptions')
  listSubscriptions(@CurrentAuth() actor: SecurityActor) {
    return this.svc.listSubscriptions(actor.userId)
  }

  @Put('subscriptions/:id/cancel')
  cancelSubscription(@CurrentAuth() actor: SecurityActor, @Param('id') id: string) {
    return this.svc.cancelSubscription(id, actor.userId)
  }

  // 偏好
  @Get('preferences')
  getPreferences(@CurrentAuth() actor: SecurityActor) {
    return this.svc.getPreferences(actor.userId)
  }

  @Put('preferences')
  upsertPreferences(@CurrentAuth() actor: SecurityActor, @Body() dto: UpsertPreferencesDto) {
    return this.svc.upsertPreferences(actor.userId, {
      locale: dto.locale,
      channels: dto.channels,
      communication_consent: dto.communication_consent,
    })
  }
}

@Controller('admin/tickets')
@UseGuards(AdminSessionGuard)
export class AdminSupportController {
  constructor(
    private readonly svc: UserOpsService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get()
  async list(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: AdminTicketListQueryDto) {
    await this.authorize(admin)
    return this.svc.listTicketsForAdmin(query.status, query.limit, query.category)
  }

  @Get(':id/timeline')
  async timeline(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    await this.authorize(admin)
    return this.svc.getTicketTimelineForAdmin(id)
  }

  @Post(':id/respond')
  async respond(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string, @Body() dto: AdminTicketResponseDto) {
    await this.authorize(admin)
    return this.svc.respondToTicket(id, dto)
  }

  private authorize(admin: AuthenticatedAdmin) {
    return assertAdminPermission(admin, this.rbac, 'support.tickets.manage')
  }
}
