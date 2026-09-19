import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminPredictionService } from './admin-prediction.service'

function adminId(request: AdminRequest): string {
  if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
  return request.admin.id
}

function numeric(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 预测市场运营通道（管理台 /polymarket 页的"投注管理"视图）：
 * 投注统计、投注列表、结算批次、手动触发结算。
 */
@ApiTags('admin-prediction')
@ApiBearerAuth()
@Controller('admin/predictions')
@UseGuards(AdminPermissionGuard)
export class AdminPredictionController {
  constructor(private readonly prediction: AdminPredictionService) {}

  @Get('stats')
  @RequireAdminPermissions('polymarket.manage')
  @ApiOperation({ summary: 'Prediction betting stats' })
  stats(@Req() request: AdminRequest) {
    return this.prediction.stats(adminId(request))
  }

  @Get('bets')
  @RequireAdminPermissions('polymarket.manage')
  @ApiOperation({ summary: 'List prediction bets' })
  bets(
    @Req() request: AdminRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('marketId') marketId?: string,
  ) {
    return this.prediction.bets(adminId(request), {
      page: page ? numeric(page, 1) : undefined,
      limit: limit ? Math.min(numeric(limit, 20), 100) : undefined,
      status,
      marketId,
    })
  }

  @Get('settlements')
  @RequireAdminPermissions('polymarket.manage')
  @ApiOperation({ summary: 'List settlement runs' })
  settlements(@Req() request: AdminRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.prediction.settlements(adminId(request), {
      page: page ? numeric(page, 1) : undefined,
      limit: limit ? Math.min(numeric(limit, 20), 100) : undefined,
    })
  }

  @Post('settle/:marketMappingId')
  @RequireAdminPermissions('polymarket.manage')
  @ApiOperation({ summary: 'Manually trigger settlement for a resolved market' })
  settle(@Req() request: AdminRequest, @Param('marketMappingId') marketMappingId: string) {
    return this.prediction.settle(adminId(request), marketMappingId)
  }
}
