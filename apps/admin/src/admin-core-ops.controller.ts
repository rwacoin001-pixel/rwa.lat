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
  @Get('referral/settings') @RequireAdminPermissions('platform.manage')
  referralSettings(@Req() r:AdminRequest) { return this.core.get(adminId(r),'/referral/settings') }
  @Get('referral/overview') @RequireAdminPermissions('platform.manage')
  referralOverview(@Req() r:AdminRequest,@Query() q:QueryMap) { return this.core.get(adminId(r),'/referral/overview',q) }
  @Get('referral/reconciliation') @RequireAdminPermissions('platform.manage')
  referralReconciliation(@Req() r:AdminRequest) { return this.core.get(adminId(r),'/referral/reconciliation') }
  @Post('referral/settings/save') @RequireAdminPermissions('platform.manage')
  referralSave(@Req() r:AdminRequest,@Body() body:Record<string,unknown>) { return this.core.post(adminId(r),'/referral/settings/save',body) }
  @Post('referral/settings/rollback') @RequireAdminPermissions('platform.manage')
  referralRollback(@Req() r:AdminRequest,@Body() body:Record<string,unknown>) { return this.core.post(adminId(r),'/referral/settings/rollback',body) }
  @Get('document-templates') @RequireAdminPermissions('platform.manage')
  documentTemplates(@Req() request:AdminRequest){return this.core.get(adminId(request),'/document-templates')}
  @Post('document-templates/company') @RequireAdminPermissions('platform.manage')
  documentCompany(@Req() request:AdminRequest,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),'/document-templates/company',body)}
  @Get('document-templates/issued') @RequireAdminPermissions('platform.manage')
  issuedDocuments(@Req() request:AdminRequest,@Query() query:QueryMap){return this.core.get(adminId(request),'/document-templates/issued',query)}
  @Post('document-templates/tax-records') @RequireAdminPermissions('platform.manage')
  issueTaxDocument(@Req() request:AdminRequest,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),'/document-templates/tax-records',body)}
  @Get('document-templates/:kind/versions') @RequireAdminPermissions('platform.manage')
  documentVersions(@Req() request:AdminRequest,@Param('kind') kind:string){return this.core.get(adminId(request),`/document-templates/${encodeURIComponent(kind)}/versions`)}
  @Post('document-templates/:kind/save') @RequireAdminPermissions('platform.manage')
  saveDocumentTemplate(@Req() request:AdminRequest,@Param('kind') kind:string,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),`/document-templates/${encodeURIComponent(kind)}/save`,body)}
  @Post('document-templates/:kind/reset') @RequireAdminPermissions('platform.manage')
  resetDocumentTemplate(@Req() request:AdminRequest,@Param('kind') kind:string,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),`/document-templates/${encodeURIComponent(kind)}/reset`,body)}
  @Post('document-templates/:kind/restore') @RequireAdminPermissions('platform.manage')
  restoreDocumentTemplate(@Req() request:AdminRequest,@Param('kind') kind:string,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),`/document-templates/${encodeURIComponent(kind)}/restore`,body)}
  @Get('account-closures') @RequireAdminPermissions('users.account_closure.manage')
  closures(@Req() request:AdminRequest){return this.core.get(adminId(request),'/account-closures')}
  @Get('account-closures/:id') @RequireAdminPermissions('users.account_closure.manage')
  closure(@Req() request:AdminRequest,@Param('id') id:string){return this.core.get(adminId(request),`/account-closures/${encodeURIComponent(id)}`)}
  @Post('account-closures/:id/review') @RequireAdminPermissions('users.account_closure.manage')
  reviewClosure(@Req() request:AdminRequest,@Param('id') id:string,@Body() body:Record<string,unknown>){return this.core.post(adminId(request),`/account-closures/${encodeURIComponent(id)}/review`,body)}

  @Get('content/articles') @RequireAdminPermissions('platform.manage')
  articles(@Req() request: AdminRequest) { return this.core.get(adminId(request), '/content/articles') }
  @Post('content/articles') @RequireAdminPermissions('platform.manage')
  createArticle(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) { return this.core.post(adminId(request), '/content/articles', body) }
  @Post('content/articles/:id/save') @RequireAdminPermissions('platform.manage')
  saveArticle(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.core.put(adminId(request), `/content/articles/${encodeURIComponent(id)}`, body) }
  @Post('content/articles/:id/publish') @RequireAdminPermissions('platform.manage')
  publishArticle(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.core.post(adminId(request), `/content/articles/${encodeURIComponent(id)}/publish`, body) }
  @Post('content/articles/:id/archive') @RequireAdminPermissions('platform.manage')
  archiveArticle(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.core.post(adminId(request), `/content/articles/${encodeURIComponent(id)}/archive`, body) }

  @Get('manual-settlements')
  @RequireAdminPermissions('orders.settlement.review')
  manualSettlements(@Req() request: AdminRequest) {
    return this.core.get(adminId(request), '/manual-settlements')
  }

  @Post('manual-settlements/orders/:id')
  @RequireAdminPermissions('orders.settlement.post')
  settleOrder(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), `/manual-settlements/orders/${encodeURIComponent(id)}`, body)
  }

  @Get('manual-settlements/orders/:id')
  @RequireAdminPermissions('orders.settlement.post')
  orderSettlementInfo(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.core.get(adminId(request), `/manual-settlements/orders/${encodeURIComponent(id)}`)
  }

  @Get('manual-settlements/redemptions/:id')
  @RequireAdminPermissions('orders.settlement.post')
  redemptionSettlementInfo(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.core.get(adminId(request), `/manual-settlements/redemptions/${encodeURIComponent(id)}`)
  }

  @Post('manual-settlements/redemptions/:id')
  @RequireAdminPermissions('orders.settlement.post')
  settleRedemption(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), `/manual-settlements/redemptions/${encodeURIComponent(id)}`, body)
  }

  @Post('manual-settlements/:id/review')
  @RequireAdminPermissions('orders.settlement.review')
  reviewSettlement(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), `/manual-settlements/${encodeURIComponent(id)}/review`, body)
  }

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
  @Get('community/publications')
  @RequireAdminPermissions('community.content.review')
  communityPublications(@Req() request: AdminRequest) { return this.core.get(adminId(request), '/community/publications') }

  @Post('community/publications/moderate')
  @RequireAdminPermissions('community.content.review')
  moderateCommunityPublication(@Req() request: AdminRequest, @Body() body: Record<string, unknown>) { return this.core.post(adminId(request), '/community/publications/moderate', body) }

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

  @Get('notifications/channels')
  @RequireAdminPermissions('notifications.manage')
  notificationChannels(@Req() request: AdminRequest) {
    return this.core.get(adminId(request), '/notifications/channels')
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

  @Get('kyc/:id/checks')
  @RequireAdminPermissions('compliance.manage')
  kycChecks(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.core.get(adminId(request), `/kyc/${encodeURIComponent(id)}/checks`)
  }

  @Post('kyc/:id/decision')
  @RequireAdminPermissions('compliance.manage')
  kycDecision(@Req() request: AdminRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.core.post(adminId(request), `/kyc/${encodeURIComponent(id)}/decision`, body)
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
