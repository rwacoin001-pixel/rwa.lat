import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminLegalService } from './admin-legal.service'
import { PublishLegalDto, SaveLegalDto } from './admin-legal.dto'

@Controller('admin/legal')
@UseGuards(AdminPermissionGuard)
@RequireAdminPermissions('platform.manage')
export class AdminLegalController {
  constructor(private readonly legal: AdminLegalService) {}
  @Get(':kind') get(@Param('kind') kind: string) { return this.legal.get(kind) }
  @Put(':kind') save(@Param('kind') kind: string, @Body() dto: SaveLegalDto, @Req() req: AdminRequest) {
    return this.legal.save(kind,dto,req.admin!.id)
  }
  @Post(':kind/publish') publish(@Param('kind') kind: string, @Body() dto: PublishLegalDto, @Req() req: AdminRequest) {
    return this.legal.publish(kind,dto.expectedRevision,req.admin!.id)
  }
  @Get(':kind/versions') versions(@Param('kind') kind: string) { return this.legal.versions(kind) }
}
