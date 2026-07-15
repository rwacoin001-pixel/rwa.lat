import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { AdminRbacService } from '../../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../../admin-rbac/admin-session-auth.service'
import { AlertingService, AlertRule } from './alerting.service'

@Controller('alerting')
@UseGuards(AdminSessionGuard)
export class AlertingController {
  constructor(
    private readonly svc: AlertingService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('rules')
  async listRules(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<AlertRule[]> {
    await this.rbac.assertPermission(admin.id, 'observability.manage')
    return this.svc['rules']
  }

  @Get('alerts')
  async getAlerts(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('since') since?: string,
    @Query('severity') severity?: 'critical' | 'warning' | 'info',
  ) {
    await this.rbac.assertPermission(admin.id, 'observability.manage')
    return this.svc.getAlerts(since ? new Date(since) : undefined, severity)
  }

  @Post('alerts/:id/ack')
  async ackAlert(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string): Promise<{ acknowledged: boolean }> {
    await this.rbac.assertPermission(admin.id, 'observability.manage')
    return { acknowledged: this.svc.acknowledgeAlert(id) }
  }

  @Post('rules/:name/fire')
  async manualFire(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('name') name: string, @Body('value') value: number) {
    await this.rbac.assertPermission(admin.id, 'observability.manage')
    await this.svc.manualFire(name, value)
    return { ok: true }
  }
}
