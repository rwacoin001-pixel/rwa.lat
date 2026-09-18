import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminConsoleService } from './admin-console.service'

function parseLimit(value: string | undefined, fallback = 100): number | undefined {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function parsePage(value: string | undefined): number {
  const n = value ? Number(value) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : 1
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

/**
 * 管理台 × 核心运营数据域（只读列表）：
 * 由 admin-api 经服务通道（服务令牌 + x-actor-admin-id）转发；console 侧的 RBAC 在管理 API 执行。
 * 权限键（注释即契约）：'console.view'（代签 actor 直通）。
 */
@ApiTags('admin-console')
@ApiBearerAuth()
@UseGuards(AdminSessionGuard)
@Controller('admin')
export class AdminConsoleController {
  constructor(
    private readonly svc: AdminConsoleService,
    private readonly rbac: AdminRbacService,
  ) {}

  private authorize(admin: AuthenticatedAdmin) {
    return this.rbac.assertPermission(admin.id, 'console.view')
  }

  @Get('orders')
  @ApiOperation({ summary: 'List orders across users (admin console)' })
  async orders(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listOrders({ state, limit: parseLimit(limit) })
  }

  @Get('kyc')
  @ApiOperation({ summary: 'List KYC cases (admin console)' })
  async kyc(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listKycCases({ state, limit: parseLimit(limit) })
  }

  @Get('risk-flags')
  @ApiOperation({ summary: 'List open/resolved risk flags (admin console)' })
  async riskFlags(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listRiskFlags({ state, limit: parseLimit(limit) })
  }

  @Get('eligibility')
  @ApiOperation({ summary: 'List eligibility decisions (admin console)' })
  async eligibility(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listEligibility({ limit: parseLimit(limit) })
  }

  @Get('yields')
  @ApiOperation({ summary: 'List yield batches with credit aggregates (admin console)' })
  async yields(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listYieldBatches({ state, limit: parseLimit(limit) })
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List prediction market settlements (admin console)' })
  async settlements(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listSettlements({ limit: parseLimit(limit) })
  }

  @Get('assets')
  @ApiOperation({ summary: 'Browse the RWA asset catalog (admin console)' })
  async assets(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query('assetClass') assetClass?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('tokenized') tokenized?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    await this.authorize(admin)
    return this.svc.listAssets({
      assetClass: assetClass?.trim() || undefined,
      search: search?.trim() || undefined,
      sort: (sort as 'rank' | 'market_cap' | 'volume' | 'change_24h' | 'apy' | 'name' | undefined) || undefined,
      tokenized: parseBool(tokenized),
      page: parsePage(page),
      limit: parseLimit(pageSize, 20),
    })
  }

  @Get('ai-analysis')
  @ApiOperation({ summary: 'List recent AI analyses for catalog assets (admin console)' })
  async aiAnalysis(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listAiAnalysis({ limit: parseLimit(limit) })
  }

  @Get('polymarket/stats')
  @ApiOperation({ summary: 'Polymarket mapping counts and sync watermarks (admin console)' })
  async polymarketStats(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.authorize(admin)
    return this.svc.polymarketStats()
  }

  @Get('networks')
  @ApiOperation({ summary: 'List catalog networks (admin console)' })
  async networks(@CurrentAdmin() admin: AuthenticatedAdmin) {
    await this.authorize(admin)
    return this.svc.listNetworks()
  }

  @Get('collections')
  @ApiOperation({ summary: 'Deposit crediting overview (admin console collections)' })
  async collections(@CurrentAdmin() admin: AuthenticatedAdmin, @Query('state') state?: string, @Query('limit') limit?: string) {
    await this.authorize(admin)
    return this.svc.listCollections({ state, limit: parseLimit(limit) })
  }
}
