import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { assertAdminPermission } from '../admin-rbac/admin-authorization'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { FundsSummaryService } from './funds-summary.service'

/**
 * Admin funds overview (read-only). Reached through the admin API service channel like the other
 * console data domains; the admin API enforces ledger.reconciliation.manage before forwarding.
 */
@ApiTags('admin-funds')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/funds')
export class FundsSummaryController {
  constructor(
    private readonly funds: FundsSummaryService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'User liabilities, deposit/withdrawal flows, pending queues, hot wallet and a daily series' })
  async summary(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('days') days?: string) {
    await assertAdminPermission(admin, this.rbac, 'console.view')
    return this.funds.summary(Number(days ?? 30))
  }
}
