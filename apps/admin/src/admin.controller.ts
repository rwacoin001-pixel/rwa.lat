import { Controller, Get, Param, ParseArrayPipe, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { AdminPublic } from './admin.guard.decorator'
import { ListQueryDto, RedemptionListQueryDto } from './admin.dto'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @AdminPublic()
  @Get('health')
  health() {
    return { status: 'ok', app: 'rwa-lat-admin', time: new Date().toISOString() }
  }

  @Get('users')
  @RequireAdminPermissions('users.read')
  @ApiOperation({ summary: 'List registered users (read-only)' })
  async listUsers(@Query() q: ListQueryDto) {
    const users = await this.admin.listUsers(q.limit, q.offset)
    return { count: users.length, users }
  }

  @Get('redemptions')
  @RequireAdminPermissions('redemptions.read')
  @ApiOperation({ summary: 'List redemption requests with optional state filter' })
  @ApiQuery({ name: 'state', required: false, isArray: true })
  async listRedemptions(
    @Query() q: RedemptionListQueryDto,
    @Query('state', new ParseArrayPipe({ optional: true })) states?: string[],
  ) {
    const rows = await this.admin.listRedemptions(states ?? (q.state ? [q.state] : undefined), q.limit, q.offset)
    return { count: rows.length, redemptions: rows }
  }

  @Get('redemptions/stats')
  @RequireAdminPermissions('redemptions.read')
  @ApiOperation({ summary: 'Redemption counts grouped by state' })
  async redemptionStats() {
    return this.admin.countRedemptionsByState()
  }

  @Get('redemptions/:id')
  @RequireAdminPermissions('redemptions.read')
  @ApiOperation({ summary: 'Get a single redemption request' })
  async getRedemption(@Param('id', new ParseUUIDPipe()) id: string) {
    const row = await this.admin.getRedemption(id)
    if (!row) {
      return { error: 'not_found', id }
    }
    return row
  }
}
