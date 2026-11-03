import { Controller, Get, Header, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminTodayService } from './admin-today.service'

/**
 * Console home ("today"): every work queue, today's flows and the open alerts in one read.
 * No route-level permission: each item checks the administrator's own permissions and reports `forbidden` itself.
 */
@ApiTags('admin-console-today')
@ApiBearerAuth()
@Controller('admin/console')
@UseGuards(AdminPermissionGuard)
export class AdminTodayController {
  constructor(private readonly todayService: AdminTodayService) {}

  @Get('today')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Work queues, today\'s figures and alerts for the console home page (cached 15s per admin)' })
  today(@Req() request: AdminRequest) {
    if (!request.admin?.id) throw new UnauthorizedException('Admin session is required')
    return this.todayService.today(request.admin)
  }
}
