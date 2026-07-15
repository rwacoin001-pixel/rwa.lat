import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { DataGovernanceService } from './data-governance.service'
import { StartDrillDto, FinishDrillDto, RequestDeletionDto, DecideDeletionDto } from './data-governance.dto'

// 数据治理管理端点：受 ADMIN_API_KEY 守卫保护（fail-closed）。
// Authenticated admin session supplies the actor identity.
@Controller('data-governance')
@UseGuards(AdminSessionGuard)
export class DataGovernanceController {
  constructor(
    private readonly svc: DataGovernanceService,
    private readonly rbac: AdminRbacService,
  ) {}

  // ---- 备份恢复演练 ----
  @Post('backup-drills')
  async startDrill(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: StartDrillDto) {
    await this.assertGovernancePermission(admin)
    return this.svc.startDrill(dto.kind, admin.id, dto.target)
  }

  @Put('backup-drills/:id/finish')
  async finishDrill(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string, @Body() dto: FinishDrillDto) {
    await this.assertGovernancePermission(admin)
    return this.svc.finishDrill(id, dto.status, dto.notes)
  }

  @Get('backup-drills')
  async listDrills(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string) {
    await this.assertGovernancePermission(admin)
    return this.svc.listDrills(limit ? Number(limit) : 50)
  }

  // ---- 删除请求生命周期 ----
  @Post('deletions')
  async requestDeletion(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: RequestDeletionDto) {
    await this.assertGovernancePermission(admin)
    return this.svc.requestDeletion({
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      requestedBy: admin.id,
      reasonCode: dto.reasonCode,
      retentionDays: dto.retentionDays,
    })
  }

  @Put('deletions/:id/decide')
  async decideDeletion(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: DecideDeletionDto) {
    await this.assertGovernancePermission(admin)
    return this.svc.decideDeletion(id, dto.approved, admin.id)
  }

  @Post('deletions/purge-expired')
  async purgeExpired(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.assertGovernancePermission(admin)
    return this.svc.purgeExpired().then((n) => ({ purged: n }))
  }

  @Get('deletions')
  async listDeletions(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.assertGovernancePermission(admin)
    return this.svc.listDeletions(state as any, limit ? Number(limit) : 50)
  }

  private assertGovernancePermission(admin: AuthenticatedAdmin) {
    return this.rbac.assertPermission(admin.id, 'data-governance.manage')
  }
}
