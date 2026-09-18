import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'
import { InternalServiceGuard } from '../wallet/internal-ops.controller'
import {
  ActivateBasketVersionDto,
  CreateBasketPortfolioDto,
  CreateBasketStrategyDto,
  CreateBasketVersionDto,
  CreateDisclosureDto,
  PlanRebalanceDto,
  ReconcilePortfolioDto,
  RecordFillDto,
  SetBasketPortfolioStatusDto,
  TargetAllocationDto,
} from './basket.dto'
import { BasketNavService } from './basket.nav.service'
import { BasketPortfolioService } from './portfolio.service'
import { BasketRebalanceService } from './rebalance.service'
import { BasketReconciliationService } from './reconciliation.service'
import { BasketRiskService } from './risk.service'
import { BasketSubscriptionService } from './subscription.service'
import { BasketStrategyService } from './strategy.service'

export class InternalRequestLike {
  internalActorAdminId?: string
}

class LimitQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  limit?: string
}

/** 内部运维通道（Bearer ADMIN_SERVICE_TOKEN + x-actor-admin-id）——Basket 运营台后端 */
@ApiTags('internal-basket')
@UseGuards(InternalServiceGuard)
@Controller('internal/basket')
export class InternalBasketController {
  constructor(
    private readonly strategies: BasketStrategyService,
    private readonly portfolios: BasketPortfolioService,
    private readonly nav: BasketNavService,
    private readonly risk: BasketRiskService,
    private readonly rebalance: BasketRebalanceService,
    private readonly subscriptions: BasketSubscriptionService,
    private readonly reconciliation: BasketReconciliationService,
  ) {}

  // ---- 策略 ----
  @Post('strategies')
  @ApiOperation({ summary: 'Create a basket strategy' })
  createStrategy(@Body() dto: CreateBasketStrategyDto) {
    return this.strategies.createStrategy(dto)
  }

  @Get('strategies')
  @ApiOperation({ summary: 'List basket strategies' })
  listStrategies() {
    return this.strategies.listStrategies()
  }

  @Get('strategies/:slug')
  @ApiOperation({ summary: 'Strategy detail with versions and target allocation' })
  strategyDetail(@Param('slug') slug: string) {
    return this.strategies.getStrategyDetail(slug)
  }

  @Post('strategies/:id/versions')
  @ApiOperation({ summary: 'Create a new draft strategy version' })
  createVersion(@Param('id') id: string, @Body() dto: CreateBasketVersionDto) {
    return this.strategies.createVersion(id, {
      methodology: parseJsonObject(dto.methodology),
      riskRules: parseJsonObject(dto.riskRules),
      scoringWeights: parseJsonObject(dto.scoringWeights),
    })
  }

  @Post('strategies/:id/versions/:versionId/allocation')
  @ApiOperation({ summary: 'Generate the deterministic target allocation for a version' })
  allocation(@Param('versionId') versionId: string, @Body() dto: TargetAllocationDto) {
    return this.strategies.generateTargetAllocation(versionId, dto)
  }

  @Post('strategies/:id/activate')
  @ApiOperation({ summary: 'Activate a strategy version (retires the previous active one)' })
  activate(@Param('id') id: string, @Body() dto: ActivateBasketVersionDto) {
    return this.strategies.activateVersion(id, dto.versionId)
  }

  // ---- 组合 ----
  @Post('portfolios')
  @ApiOperation({ summary: 'Create a basket portfolio from the active strategy version' })
  createPortfolio(@Body() dto: CreateBasketPortfolioDto) {
    return this.portfolios.createPortfolio(dto)
  }

  @Get('portfolios')
  @ApiOperation({ summary: 'List basket portfolios (includeClosed=true to see all)' })
  listPortfolios(@Query('includeClosed') includeClosed?: string) {
    return this.portfolios.listPortfolios(includeClosed === 'true')
  }

  @Get('portfolios/:id')
  @ApiOperation({ summary: 'Portfolio detail (holdings, targets, NAV history)' })
  portfolioDetail(@Param('id') id: string) {
    return this.portfolios.getPortfolioDetail(id)
  }

  @Post('portfolios/:id/status')
  @ApiOperation({ summary: 'Set portfolio status (draft/pilot/active/closed)' })
  setStatus(@Param('id') id: string, @Body() dto: SetBasketPortfolioStatusDto) {
    return this.portfolios.setStatus(id, dto.status)
  }

  @Post('portfolios/:id/nav')
  @ApiOperation({ summary: 'Recompute NAV and write a snapshot' })
  computeNav(@Param('id') id: string) {
    return this.nav.computeNav(id)
  }

  @Get('portfolios/:id/drift')
  @ApiOperation({ summary: 'Drift report (target vs actual weights)' })
  drift(@Param('id') id: string, @Query('thresholdPct') thresholdPct?: string) {
    const parsed = thresholdPct ? Number(thresholdPct) : undefined
    return this.rebalance.detectDrift(id, Number.isFinite(parsed) ? parsed : undefined)
  }

  @Get('portfolios/:id/risk')
  @ApiOperation({ summary: 'Portfolio risk evaluation (deterministic checks)' })
  riskEvaluation(@Param('id') id: string) {
    return this.risk.evaluatePortfolio(id)
  }

  @Post('portfolios/:id/rebalance-plans')
  @ApiOperation({ summary: 'Generate a rebalance plan (run + orders + risk validation; no execution)' })
  planRebalance(@Param('id') id: string, @Body() dto: PlanRebalanceDto) {
    return this.rebalance.planRebalance(id, { ...dto, requestId: 'internal-basket-plan' })
  }

  @Get('portfolios/:id/runs')
  @ApiOperation({ summary: 'List rebalance runs for a portfolio' })
  listRuns(@Param('id') id: string, @Query() query: LimitQueryDto) {
    return this.rebalance.listRuns(id, query.limit ? Number(query.limit) : 20)
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Rebalance run detail with orders and risk evaluation' })
  runDetail(@Param('runId') runId: string) {
    return this.rebalance.getRun(runId)
  }

  @Post('runs/:runId/execute')
  @ApiOperation({ summary: 'Execute a rebalance run via the configured execution adapter (requires basket.rebalance.execution switch)' })
  executeRun(@Param('runId') runId: string) {
    return this.rebalance.executeRun(runId)
  }

  @Post('orders/:orderId/fills')
  @ApiOperation({ summary: 'Record a fill for a rebalance order (manual execution bookkeeping)' })
  recordFill(@Param('orderId') orderId: string, @Body() dto: RecordFillDto) {
    return this.rebalance.recordFill(orderId, dto)
  }

  @Post('portfolios/:id/reconcile')
  @ApiOperation({ summary: 'Reconcile portfolio cash (ledger), units and NAV' })
  reconcile(@Param('id') id: string, @Body() dto: ReconcilePortfolioDto, @Req() request: InternalRequestLike) {
    return this.reconciliation.reconcilePortfolio(id, dto.requestId ?? 'internal-basket-reconcile', request.internalActorAdminId)
  }

  @Get('reconciliations')
  @ApiOperation({ summary: 'List basket reconciliation runs' })
  listReconciliations(@Query() query: LimitQueryDto) {
    return this.reconciliation.listRuns(query.limit ? Number(query.limit) : 20)
  }

  // ---- 披露 ----
  @Post('disclosures')
  @ApiOperation({ summary: 'Create a risk disclosure (optionally scope to a strategy)' })
  createDisclosure(@Body() dto: CreateDisclosureDto) {
    return this.subscriptions.createDisclosure(dto)
  }

  @Get('disclosures')
  @ApiOperation({ summary: 'List risk disclosures' })
  listDisclosures(@Query('strategyId') strategyId?: string) {
    return this.subscriptions.listDisclosures(strategyId)
  }
}

function parseJsonObject(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}
