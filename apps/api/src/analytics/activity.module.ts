import { Controller, Get, Header, MiddlewareConsumer, Module, NestModule, Query, RequestMethod, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminRbacModule } from '../admin-rbac/admin-rbac.module'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { assertAdminPermission } from '../admin-rbac/admin-authorization'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { ActivityRecorderService } from './activity-recorder.service'
import { ActivitySummaryService } from './activity-summary.service'
import { ActivityTrackingMiddleware } from './activity-tracking.middleware'
import { VisitLogService } from './visit-log.service'
import { VisitQueryService, type VisitQuery } from './visit-query.service'
import { IdentityModule } from '../identity/identity.module'

/**
 * Admin user-activity overview (read-only). Reached through the admin API service channel; the admin
 * API enforces users.read before forwarding.
 */
@ApiTags('admin-activity')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin/activity')
export class ActivitySummaryController {
  constructor(
    private readonly activity: ActivitySummaryService,
    private readonly visits: VisitQueryService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Daily active users, sign-ins, registrations, countries and devices' })
  async summary(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('days') days?: string) {
    await assertAdminPermission(admin, this.rbac, 'console.view')
    return this.activity.summary(Number(days ?? 30))
  }

  @Get('visits')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Visit log: one row per visit with time, IP, country, device, account and pages (raw IP; users.read)' })
  async visitLog(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: VisitQuery) {
    await assertAdminPermission(admin, this.rbac, 'console.view')
    return this.visits.list(query)
  }
}

/** Daily activity (app.daily_activity, no raw IP), the visit log (app.visit_log, raw IP) and their admin views. */
@Module({
  imports: [AdminRbacModule, IdentityModule],
  controllers: [ActivitySummaryController],
  providers: [ActivityRecorderService, ActivitySummaryService, VisitLogService, VisitQueryService, ActivityTrackingMiddleware],
})
export class ActivityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActivityTrackingMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}
