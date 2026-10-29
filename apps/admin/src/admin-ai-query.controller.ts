import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import { AdminSessionGuard, type AdminRequest } from './admin-session.guard'
import { AdminAiMfaGuard } from './admin-ai-mfa.guard'
import { AdminAiExportDto, AdminAiQueryDto } from './admin-ai-query.dto'
import { AdminAiQueryService } from './admin-ai-query.service'

@ApiTags('admin-ai-query')
@ApiBearerAuth()
@Controller('admin/ai')
@UseGuards(AdminSessionGuard, AdminPermissionGuard, AdminAiMfaGuard)
@RequireAdminPermissions('ai.ops.query')
export class AdminAiQueryController {
  constructor(private readonly ai: AdminAiQueryService) {}
  @Post('query')
  @Header('Cache-Control', 'private, no-store')
  query(@Req() request: AdminRequest, @Body() body: AdminAiQueryDto) {
    return this.ai.query(request.admin!.id, body)
  }
  @Post('export')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="data-ai.csv"')
  export(@Req() request: AdminRequest, @Body() body: AdminAiExportDto) {
    return this.ai.export(request.admin!.id, body.auditId)
  }
}
