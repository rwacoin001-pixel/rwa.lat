import { Body, Controller, Get, Param, ParseArrayPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { AdminPublic } from './admin.guard.decorator'
import { RedemptionListQueryDto, UserListQueryDto } from './admin.dto'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import { AdminCoreOpsService } from './admin-core-ops.service'
import type { AdminRequest } from './admin-session.guard'

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly core: AdminCoreOpsService) {}

  @AdminPublic()
  @Get('health')
  health() {
    return { status: 'ok', app: 'rwa-lat-admin', time: new Date().toISOString() }
  }

  @Get('users')
  @RequireAdminPermissions('users.read')
  @ApiOperation({ summary: 'Search registered users, identity information and ledger balances' })
  async listUsers(@Req() r: AdminRequest, @Query() q: UserListQueryDto) {
    return this.core.get(r.admin!.id, '/user-management', { limit: q.limit, offset: q.offset, q: q.q, status: q.status })
  }

  @Get('users/:id')
  @RequireAdminPermissions('users.read')
  async getUser(@Req() r: AdminRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.core.get(r.admin!.id, `/user-management/${id}`)
  }

  @Post('users/:id/balance-adjustments')
  @RequireAdminPermissions('users.read', 'ledger.adjustments.manage', 'ledger.adjustments.post')
  async adjustUserBalance(@Req() r: AdminRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(r.admin!.id, `/user-management/${id}/balance-adjustments`, body)
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
