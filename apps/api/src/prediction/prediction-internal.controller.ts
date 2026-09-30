import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import { PredictionService } from './prediction.service'
import { PredictionExposureService } from './prediction-exposure.service'
import { PredictionHedgeWorker } from './prediction-hedge.worker'

/**
 * 预测市场内部通道（运营/管理台用）：
 * 投注统计、投注列表、结算批次、手动触发结算、敞口核算、对冲干跑。
 * 与 wallet/community 相同：ADMIN_SERVICE_TOKEN + x-actor-admin-id。
 */
@ApiTags('internal-prediction')
@UseGuards(InternalServiceGuard)
@Controller('internal/predictions')
export class InternalPredictionController {
  constructor(
    private readonly prediction: PredictionService,
    private readonly exposure: PredictionExposureService,
    private readonly hedge: PredictionHedgeWorker,
  ) {}

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

  // ── 敞口与对冲（庄家盘第 2 期）──────────────────────────────────────────

  @Get('exposure')
  @ApiOperation({ summary: 'Platform-wide prediction exposure summary + per-market hedge sizing' })
  exposureSummary() {
    return this.exposure.summary()
  }

  @Get('exposure/:marketMappingId')
  @ApiOperation({ summary: 'Single market exposure: liability per outcome, worst case, hedge plan' })
  exposureForMarket(@Param('marketMappingId') marketMappingId: string) {
    return this.exposure.marketExposure(marketMappingId)
  }

  @Post('hedge/dry-run')
  @ApiOperation({ summary: 'Run one hedge planning pass (dry-run only — never submits to CLOB)' })
  hedgeDryRun() {
    return this.hedge.runOnce().then((recorded) => ({ mode: 'dry_run', recorded }))
  }

  @Get('hedge/decisions')
  @ApiOperation({ summary: 'Recent hedge decisions (dry-run plan and skip reasons)' })
  hedgeDecisions(@Query('limit') limit?: string) {
    return this.hedge.recentDecisions(Number(limit) || 50)
  }
}
