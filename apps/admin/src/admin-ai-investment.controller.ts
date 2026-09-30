import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import { AdminRequest } from './admin-session.guard'
import { AdminCoreOpsService } from './admin-core-ops.service'

@Controller('admin/ai-investment') @UseGuards(AdminPermissionGuard) @RequireAdminPermissions('platform.manage')
export class AdminAiInvestmentController {
  constructor(private readonly core: AdminCoreOpsService) {}
  @Get('rules') rules(@Req() request: AdminRequest) { return this.core.get(request.admin!.id,'/ai-investment/rules') }
  @Get('runs') runs(@Req() request: AdminRequest) { return this.core.get(request.admin!.id,'/ai-investment/runs') }
  @Post('rules/:id') save(@Req() request: AdminRequest,@Param('id',ParseUUIDPipe) id: string,@Body() body: Record<string,unknown>) { return this.core.put(request.admin!.id,`/ai-investment/rules/${id}`,body) }
  @Post('runs/:id/review') review(@Req() request: AdminRequest,@Param('id',ParseUUIDPipe) id: string,@Body() body: Record<string,unknown>) { return this.core.post(request.admin!.id,`/ai-investment/runs/${id}/review`,body) }
}
