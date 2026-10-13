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
    private readonly rbac: AdminRbacService,
  ) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Daily active users, sign-ins, registrations, countries and devices' })
  async summary(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('days') days?: string) {
    await assertAdminPermission(admin, this.rbac, 'console.view')
    return this.activity.summary(Number(days ?? 30))
  }
}

/** Privacy-preserving daily activity (app.daily_activity) and its admin summary. */
@Module({
  imports: [AdminRbacModule],
  controllers: [ActivitySummaryController],
  providers: [ActivityRecorderService, ActivitySummaryService, ActivityTrackingMiddleware],
})
export class ActivityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActivityTrackingMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL })
  }
}
