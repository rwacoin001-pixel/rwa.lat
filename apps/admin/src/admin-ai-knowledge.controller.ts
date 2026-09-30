import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminCoreOpsService } from './admin-core-ops.service'

@Controller('admin/ai-knowledge')
@UseGuards(AdminPermissionGuard)
@RequireAdminPermissions('platform.manage')
export class AdminAiKnowledgeController {
  constructor(private readonly core: AdminCoreOpsService) {}
  @Get() list(@Req() request: AdminRequest) { return this.core.get(request.admin!.id, '/ai-knowledge') }
  @Get('products') products(@Req() request: AdminRequest) { return this.core.get(request.admin!.id, '/ai-knowledge/products') }
  @Get('coverage') coverage(@Req() request: AdminRequest) { return this.core.get(request.admin!.id,'/ai-knowledge/coverage') }
  @Post('preview') preview(@Req() request: AdminRequest,@Body() body: Record<string,unknown>) { return this.core.post(request.admin!.id,'/ai-knowledge/preview',body) }
  @Post() create(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) { return this.core.post(request.admin!.id, '/ai-knowledge', body) }
  @Post(':id/save') save(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) { return this.core.put(request.admin!.id, `/ai-knowledge/${id}`, body) }
  @Get(':id/versions') versions(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string) { return this.core.get(request.admin!.id, `/ai-knowledge/${id}/versions`) }
  @Post(':id/publish') publish(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) { return this.core.post(request.admin!.id, `/ai-knowledge/${id}/publish`, body) }
  @Post(':id/archive') archive(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) { return this.core.post(request.admin!.id, `/ai-knowledge/${id}/archive`, body) }
  @Post(':id/restore') restore(@Req() request: AdminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) { return this.core.post(request.admin!.id, `/ai-knowledge/${id}/restore`, body) }
}
