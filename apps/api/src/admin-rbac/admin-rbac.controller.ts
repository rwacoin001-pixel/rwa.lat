import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { RequestWithContext } from '../common/request-context.middleware'
import { CurrentAdmin } from './current-admin.decorator'
import { AdminSessionGuard } from './admin-session.guard'
import type { AuthenticatedAdmin } from './admin-session-auth.service'
import { AdminRbacService } from './admin-rbac.service'
import {
  AuditExportQueryDto,
  CreateApprovalDto,
  DecideApprovalDto,
  ListApprovalsQueryDto,
} from './admin-rbac.dto'

// 全部管理端点受 ADMIN_API_KEY 守卫保护（fail-closed）。
// Authenticated admin session supplies the actor identity; the service enforces RBAC permissions.
@Controller('admin')
@UseGuards(AdminSessionGuard)
export class AdminRbacController {
  constructor(private readonly svc: AdminRbacService) {}

  @Get('me')
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.svc.getProfile(admin.id)
  }

  @Get('approvals')
  async listApprovals(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() q: ListApprovalsQueryDto) {
    await this.svc.assertPermission(admin.id, 'approvals.manage')
    return this.svc.listApprovals(q.state, q.limit ? Number(q.limit) : 50)
  }

  @Post('approvals')
  async createApproval(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateApprovalDto, @Req() request: RequestWithContext) {
    await this.svc.assertPermission(admin.id, 'approvals.manage')
    return this.svc.createApproval({
      actorId: admin.id,
      action: dto.action,
      objectType: dto.objectType,
      objectId: dto.objectId,
      payload: dto.payload,
      auditContext: this.auditContext(request),
    })
  }

  @Put('approvals/:id/decide')
  async decide(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: DecideApprovalDto, @Req() request: RequestWithContext) {
    await this.svc.assertPermission(admin.id, 'approvals.manage')
    return this.svc.decideApproval(id, admin.id, true, dto.reasonCode, this.auditContext(request))
  }

  @Put('approvals/:id/reject')
  async reject(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: DecideApprovalDto, @Req() request: RequestWithContext) {
    await this.svc.assertPermission(admin.id, 'approvals.manage')
    return this.svc.decideApproval(id, admin.id, false, dto.reasonCode, this.auditContext(request))
  }

  @Get('audit')
  async exportAudit(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() q: AuditExportQueryDto) {
    await this.svc.assertPermission(admin.id, 'audit.read')
    return this.svc.exportAudit({
      actorType: q.actorType,
      userId: q.userId,
      action: q.action,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit ? Number(q.limit) : 100,
    })
  }

  private auditContext(request: RequestWithContext) {
    return {
      requestId: request.requestId ?? randomUUID(),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    }
  }
}
