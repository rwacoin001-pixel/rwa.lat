import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { AdminRbacService } from '../../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../../admin-rbac/admin-session-auth.service'
import { AlertingService, AlertRule } from './alerting.service'
import { assertAdminPermission } from '../../admin-rbac/admin-authorization'

@Controller('alerting')
@UseGuards(AdminSessionGuard)
export class AlertingController {
  constructor(
    private readonly svc: AlertingService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('rules')
  async listRules(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<AlertRule[]> {
    await assertAdminPermission(admin, this.rbac, 'observability.manage')
    return this.svc['rules']
  }

  @Get('alerts')
  async getAlerts(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('since') since?: string,
    @Query('severity') severity?: 'critical' | 'warning' | 'info',
  ) {
    await assertAdminPermission(admin, this.rbac, 'observability.manage')
    return this.svc.getAlerts(since ? new Date(since) : undefined, severity)
  }

  @Post('alerts/:id/ack')
  async ackAlert(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string): Promise<{ acknowledged: boolean }> {
    await assertAdminPermission(admin, this.rbac, 'observability.manage')
    return { acknowledged: this.svc.acknowledgeAlert(id) }
  }

  @Post('rules/:name/fire')
  async manualFire(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('name') name: string, @Body('value') value: number) {
    await assertAdminPermission(admin, this.rbac, 'observability.manage')
    await this.svc.manualFire(name, value)
    return { ok: true }
  }
}
