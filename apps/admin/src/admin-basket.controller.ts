import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminBasketService } from './admin-basket.service'

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
 * Basket 运营通道（管理台 /basket 页）：
 * 策略与版本、目标配置生成、组合与 NAV、漂移/调仓计划、执行与成交回填、对账、风险披露。
 * 全部经由核心 API 内部通道（ADMIN_SERVICE_TOKEN），每个动作携带操作管理员 id 以便审计。
 */
@ApiTags('admin-basket')
@ApiBearerAuth()
@Controller('admin/basket')
@UseGuards(AdminPermissionGuard)
export class AdminBasketController {
  constructor(private readonly basket: AdminBasketService) {}

  // ---- 策略 ----

  @Get('strategies')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'List basket strategies with versions' })
  strategies(@Req() request: AdminRequest) {
    return this.basket.strategies(adminId(request))
  }

  @Get('strategies/:slug')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Strategy detail with active version and target allocation' })
  strategyDetail(@Req() request: AdminRequest, @Param('slug') slug: string) {
    return this.basket.strategyDetail(adminId(request), slug)
  }

  @Post('strategies')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Create a basket strategy' })
  createStrategy(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.basket.createStrategy(adminId(request), body)
  }

  @Post('strategies/:id/versions')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Create a new draft strategy version' })
  createVersion(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.createVersion(adminId(request), id, body)
  }

  @Post('strategies/:id/versions/:versionId/allocation')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Generate the target allocation for a strategy version (scoring-driven)' })
  generateAllocation(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.basket.generateAllocation(adminId(request), id, versionId, body)
  }

  @Post('strategies/:id/activate')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Activate a strategy version (retires the previous active version)' })
  activateVersion(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.activateVersion(adminId(request), id, body)
  }

  @Get('candidate-facets')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Candidate asset facets for the allocation picker (classes / price coverage / scores)' })
  candidateFacets(@Req() request: AdminRequest, @Query('minScore') minScore?: string) {
    return this.basket.candidateFacets(adminId(request), { minScore: minScore ? numeric(minScore, 60) : undefined })
  }

  // ---- 组合 ----

  @Get('portfolios')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'List basket portfolios with NAV aggregates' })
  portfolios(@Req() request: AdminRequest, @Query('includeClosed') includeClosed?: string) {
    return this.basket.portfolios(adminId(request), { includeClosed })
  }

  @Post('portfolios')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Create a basket portfolio from an active strategy version' })
  createPortfolio(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.basket.createPortfolio(adminId(request), body)
  }

  @Get('portfolios/:id')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Portfolio detail with holdings, latest NAV and target weights' })
  portfolio(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.basket.portfolio(adminId(request), id)
  }

  @Post('portfolios/:id/status')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Update portfolio lifecycle status' })
  setStatus(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.setPortfolioStatus(adminId(request), id, body)
  }

  @Post('portfolios/:id/nav')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Recompute NAV and write a NAV snapshot' })
  computeNav(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.computeNav(adminId(request), id, body)
  }

  @Get('portfolios/:id/drift')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Detect drift between actual holdings and target allocation' })
  drift(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.basket.drift(adminId(request), id)
  }

  @Get('portfolios/:id/risk')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Evaluate portfolio risk checks' })
  risk(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.basket.risk(adminId(request), id)
  }

  @Post('portfolios/:id/rebalance-plans')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Generate a rebalance plan (orders) for the portfolio' })
  planRebalance(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.planRebalance(adminId(request), id, body)
  }

  @Get('portfolios/:id/runs')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'List rebalance runs for a portfolio' })
  runs(@Req() request: AdminRequest, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.basket.runs(adminId(request), id, { limit: limit ? numeric(limit, 50) : undefined })
  }

  @Get('runs/:runId')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Rebalance run detail with orders and risk evaluation' })
  run(@Req() request: AdminRequest, @Param('runId') runId: string) {
    return this.basket.run(adminId(request), runId)
  }

  @Post('runs/:runId/execute')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Execute a planned rebalance run through the configured adapter (manual/paper)' })
  executeRun(@Req() request: AdminRequest, @Param('runId') runId: string, @Body() body: Record<string, unknown>) {
    return this.basket.executeRun(adminId(request), runId, body)
  }

  @Post('orders/:orderId/fills')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Record an executed fill for a rebalance order' })
  recordFill(@Req() request: AdminRequest, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.basket.recordFill(adminId(request), orderId, body)
  }

  @Post('portfolios/:id/reconcile')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Run cash/units/NAV reconciliation for the portfolio' })
  reconcile(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.basket.reconcile(adminId(request), id, body)
  }

  @Get('reconciliations')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'List recent basket reconciliation runs' })
  reconciliations(@Req() request: AdminRequest, @Query('limit') limit?: string) {
    return this.basket.reconciliations(adminId(request), { limit: limit ? numeric(limit, 50) : undefined })
  }

  // ---- 风险披露 ----

  @Get('disclosures')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'List basket risk disclosures' })
  disclosures(@Req() request: AdminRequest, @Query('strategyId') strategyId?: string) {
    return this.basket.disclosures(adminId(request), { strategyId })
  }

  @Post('disclosures')
  @RequireAdminPermissions('basket.operations.manage')
  @ApiOperation({ summary: 'Create a basket risk disclosure version' })
  createDisclosure(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.basket.createDisclosure(adminId(request), body)
  }
}
