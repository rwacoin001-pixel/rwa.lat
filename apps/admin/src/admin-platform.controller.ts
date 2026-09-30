import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminPlatformService } from './admin-platform.service'
import { PublishPlatformDto, SavePlatformDto, VerifiedAccessDto } from './admin-platform.dto'

@Controller('admin/platform')
@UseGuards(AdminPermissionGuard)
@RequireAdminPermissions('platform.manage')
export class AdminPlatformController {
  constructor(private readonly control: AdminPlatformService) {}

  @Get() get() { return this.control.getPlatformConfiguration() }

  @Put() save(@Body() dto: SavePlatformDto, @Req() req: AdminRequest) {
    return this.control.savePlatformConfiguration(dto, req.admin!.id)
  }

  @Post('publish') publish(@Body() dto: PublishPlatformDto, @Req() req: AdminRequest) {
    return this.control.publishPlatformConfiguration(dto, req.admin!.id)
  }

  @Get('versions') versions() { return this.control.listPlatformVersions() }

  @Get('users/:id/access') access(@Param('id', ParseUUIDPipe) id: string) {
    return this.control.getVerifiedAccess(id)
  }

  @Put('users/:id/access') verify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VerifiedAccessDto, @Req() req: AdminRequest) {
    return this.control.saveVerifiedAccess(id, dto, req.admin!.id)
  }
}
