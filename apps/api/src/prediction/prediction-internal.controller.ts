import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { PredictionService } from './prediction.service'

/**
 * 预测市场内部通道（运营/管理台用）：
 * 投注统计、投注列表、结算批次、手动触发结算。
 * 与 wallet/community 相同：ADMIN_SERVICE_TOKEN + x-actor-admin-id。
 */
@ApiTags('internal-prediction')
@UseGuards(InternalServiceGuard)
@Controller('internal/predictions')
export class InternalPredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Prediction betting stats (admin console)' })
  stats() {
    return this.prediction.adminStats()
  }

  @Get('bets')
  @ApiOperation({ summary: 'List prediction bets (admin console)' })
  bets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('marketId') marketId?: string,
  ) {
    return this.prediction.adminListBets({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      status: status || undefined,
      marketId: marketId || undefined,
    })
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List prediction settlement runs (admin console)' })
  settlements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prediction.adminListSettlements({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    })
  }

  @Post('settle/:marketMappingId')
  @ApiOperation({ summary: 'Manually trigger settlement for a resolved market' })
  settle(@Param('marketMappingId') marketMappingId: string) {
    return this.prediction.settleMarket(marketMappingId)
  }
}
