import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminPermissionGuard, RequireAdminPermissions } from './admin-permission.guard'
import type { AdminRequest } from './admin-session.guard'
import { AdminCoreOpsService } from './admin-core-ops.service'

function adminId(request: AdminRequest): string {
  if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
  return request.admin.id
}

type QueryMap = Record<string, string | undefined>

/**
 * 核心运营域转发（管理台页面 → 核心 API /v1/admin/*）：
 * 账本（对账/调整单）、审计、审批、工单、作业队列、通知、预测市场同步。
 * 权限在本服务校验（管理库 RBAC）；核心侧以 x-actor-admin-id 记录真实操作人。
 */
@ApiTags('admin-core-ops')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminPermissionGuard)
export class AdminCoreOpsController {
  constructor(private readonly core: AdminCoreOpsService) {}

  // ---- 账本：对账 + 调整单 ----

  @Get('ledger/reconciliations')
  @RequireAdminPermissions('ledger.reconciliation.manage')
  @ApiOperation({ summary: 'List custody reconciliation runs (core admin/ledger)' })
  reconciliations(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/ledger/reconciliations', query)
  }

  @Get('ledger/adjustments')
  @RequireAdminPermissions('ledger.adjustments.manage')
  @ApiOperation({ summary: 'List ledger adjustment requests (core admin/ledger)' })
  adjustments(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/ledger/adjustments', query)
  }

  @Post('ledger/adjustments/:id/approve')
  @RequireAdminPermissions('ledger.adjustments.manage')
  @ApiOperation({ summary: 'Approve a ledger adjustment (core admin/ledger)' })
  approveAdjustment(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.put(adminId(request), `/ledger/adjustments/${encodeURIComponent(id)}/approve`, body)
  }

  @Post('ledger/adjustments/:id/reject')
  @RequireAdminPermissions('ledger.adjustments.manage')
  @ApiOperation({ summary: 'Reject a ledger adjustment (core admin/ledger)' })
  rejectAdjustment(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.put(adminId(request), `/ledger/adjustments/${encodeURIComponent(id)}/reject`, body)
  }

  @Post('ledger/adjustments/:id/post')
  @RequireAdminPermissions('ledger.adjustments.post')
  @ApiOperation({ summary: 'Post an approved ledger adjustment (core admin/ledger)' })
  postAdjustment(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.core.post(adminId(request), `/ledger/adjustments/${encodeURIComponent(id)}/post`)
  }

  // ---- 审计 ----

  @Get('audit')
  @RequireAdminPermissions('audit.read')
  @ApiOperation({ summary: 'Export audit log entries (core admin/audit)' })
  audit(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/audit', query)
  }

  // ---- 审批中心 ----

  @Get('approvals')
  @RequireAdminPermissions('approvals.manage')
  @ApiOperation({ summary: 'List administrator approval requests (core admin/approvals)' })
  approvals(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/approvals', query)
  }

  @Post('approvals')
  @RequireAdminPermissions('approvals.manage')
  @ApiOperation({ summary: 'Create an approval request (core admin/approvals)' })
  createApproval(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), '/approvals', body)
  }

  @Post('approvals/:id/decide')
  @RequireAdminPermissions('approvals.manage')
  @ApiOperation({ summary: 'Approve an approval request (core admin/approvals)' })
  decideApproval(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.put(adminId(request), `/approvals/${encodeURIComponent(id)}/decide`, body)
  }

  @Post('approvals/:id/reject')
  @RequireAdminPermissions('approvals.manage')
  @ApiOperation({ summary: 'Reject an approval request (core admin/approvals)' })
  rejectApproval(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.put(adminId(request), `/approvals/${encodeURIComponent(id)}/reject`, body)
  }

  // ---- 客服工单 ----

  @Get('support/tickets')
  @RequireAdminPermissions('support.tickets.manage')
  @ApiOperation({ summary: 'List support tickets (core admin/tickets)' })
  tickets(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/tickets', query)
  }

  @Get('support/tickets/:id/timeline')
  @RequireAdminPermissions('support.tickets.manage')
  @ApiOperation({ summary: 'Ticket timeline with messages (core admin/tickets)' })
  ticketTimeline(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.core.get(adminId(request), `/tickets/${encodeURIComponent(id)}/timeline`)
  }

  @Post('support/tickets/:id/respond')
  @RequireAdminPermissions('support.tickets.manage')
  @ApiOperation({ summary: 'Respond to a support ticket (core admin/tickets)' })
  respondTicket(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), `/tickets/${encodeURIComponent(id)}/respond`, body)
  }

  // ---- 作业队列 ----

  @Get('job-queue/jobs')
  @RequireAdminPermissions('operations.jobs.manage')
  @ApiOperation({ summary: 'List job-queue jobs by state (core admin/job-queue)' })
  jobs(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/job-queue/jobs', query)
  }

  @Get('job-queue/jobs/dead')
  @RequireAdminPermissions('operations.jobs.manage')
  @ApiOperation({ summary: 'List dead jobs for a queue (core admin/job-queue)' })
  deadJobs(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/job-queue/jobs/dead', query)
  }

  @Get('job-queue/callbacks/unprocessed')
  @RequireAdminPermissions('operations.jobs.manage')
  @ApiOperation({ summary: 'List unprocessed partner callbacks (core admin/job-queue)' })
  unprocessedCallbacks(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/job-queue/callbacks/unprocessed', query)
  }

  @Post('job-queue/jobs/:id/replay')
  @RequireAdminPermissions('operations.jobs.manage')
  @ApiOperation({ summary: 'Replay a dead job (core admin/job-queue)' })
  replayJob(@Req() request: AdminRequest, @Param('id') id: string, @Query() query: QueryMap) {
    return this.core.put(adminId(request), `/job-queue/jobs/${encodeURIComponent(id)}/replay`, undefined, query)
  }

  // ---- 通知 ----

  @Get('notifications')
  @RequireAdminPermissions('notifications.manage')
  @ApiOperation({ summary: 'List recent notifications across users (core admin/notifications)' })
  notifications(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/notifications', query)
  }

  @Post('notifications')
  @RequireAdminPermissions('notifications.manage')
  @ApiOperation({ summary: 'Create a notification for a user (core admin/notifications)' })
  createNotification(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), '/notifications', body)
  }

  // ---- 预测市场 ----

  @Post('polymarket/sync')
  @RequireAdminPermissions('polymarket.manage')
  @ApiOperation({ summary: 'Sync Polymarket markets (core admin/polymarket)' })
  syncPolymarket(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), '/polymarket/sync/markets', body)
  }

  // ---- 运营数据域（只读）：订单 / KYC / 风控 / 适当性 / 收益 / 结算 / 资产 / AI / 预测市场 / 网络 / 充值 ----

  @Get('console/orders')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Orders across users (core admin/orders)' })
  consoleOrders(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/orders', query)
  }

  @Get('console/kyc')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'KYC cases (core admin/kyc)' })
  consoleKyc(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/kyc', query)
  }

  @Get('console/risk-flags')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Risk flags (core admin/risk-flags)' })
  consoleRiskFlags(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/risk-flags', query)
  }

  @Get('console/eligibility')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Eligibility decisions (core admin/eligibility)' })
  consoleEligibility(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/eligibility', query)
  }

  @Get('console/yields')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Yield batches (core admin/yields)' })
  consoleYields(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/yields', query)
  }

  @Get('console/settlements')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Prediction settlements (core admin/settlements)' })
  consoleSettlements(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/settlements', query)
  }

  @Get('console/assets')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'RWA catalog browse (core admin/assets)' })
  consoleAssets(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/assets', query)
  }

  @Get('console/ai-analysis')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Recent AI analyses (core admin/ai-analysis)' })
  consoleAiAnalysis(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/ai-analysis', query)
  }

  @Get('console/polymarket/stats')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Polymarket mapping + watermark stats (core admin/polymarket/stats)' })
  consolePolymarketStats(@Req() request: AdminRequest) {
    return this.core.get(adminId(request), '/polymarket/stats')
  }

  @Get('console/networks')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Catalog networks (core admin/networks)' })
  consoleNetworks(@Req() request: AdminRequest) {
    return this.core.get(adminId(request), '/networks')
  }

  @Get('console/collections')
  @RequireAdminPermissions('core.console.view')
  @ApiOperation({ summary: 'Deposit crediting overview (core admin/collections)' })
  consoleCollections(@Req() request: AdminRequest, @Query() query: QueryMap) {
    return this.core.get(adminId(request), '/collections', query)
  }
}
