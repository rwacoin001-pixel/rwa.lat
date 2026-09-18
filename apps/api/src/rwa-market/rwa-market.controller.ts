import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { AssetHistoryQueryDto, ListRwaAssetsQueryDto, RankingsQueryDto } from './rwa-market.dto'
import { RwaMarketQueryService } from './rwa-market.query.service'

/** 公开 RWA 目录 API（无认证；规格 A 段优先交付——前端改版直接接入） */
@ApiTags('rwa')
@Controller('rwa')
export class RwaMarketController {
  constructor(private readonly query: RwaMarketQueryService) {}

  @Get('assets')
  @ApiOperation({ summary: 'List RWA assets with filters, sort and pagination' })
  listAssets(@Query() query: ListRwaAssetsQueryDto) {
    return this.query.listAssets({
      assetClass: query.assetClass,
      issuer: query.issuer,
      tokenized: query.tokenized,
      featured: query.featured,
      search: query.search,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get('assets/:slug/history')
  @ApiOperation({ summary: 'Daily price/market-cap history for an RWA asset' })
  assetHistory(@Param('slug') slug: string, @Query() query: AssetHistoryQueryDto) {
    return this.query.getAssetHistory(slug, query.days)
  }

  @Get('assets/:slug')
  @ApiOperation({ summary: 'RWA asset detail (issuer, contracts, sources, score, AI analysis)' })
  assetDetail(@Param('slug') slug: string) {
    return this.query.getAssetBySlug(slug)
  }

  @Get('issuers')
  @ApiOperation({ summary: 'List RWA issuers with asset counts and aggregate market cap' })
  listIssuers() {
    return this.query.listIssuers()
  }

  @Get('issuers/:slug')
  @ApiOperation({ summary: 'RWA issuer detail with its asset list' })
  issuerDetail(@Param('slug') slug: string) {
    return this.query.getIssuerBySlug(slug)
  }

  @Get('networks')
  @ApiOperation({ summary: 'List supported networks' })
  listNetworks() {
    return this.query.listNetworks()
  }

  @Get('categories')
  @ApiOperation({ summary: 'Asset-class distribution with aggregate metrics' })
  listCategories() {
    return this.query.listCategories()
  }

  @Get('rankings')
  @ApiOperation({ summary: 'Top RWA assets by metric' })
  listRankings(@Query() query: RankingsQueryDto) {
    return this.query.listRankings(query.metric, query.limit)
  }

  @Get('overview')
  @ApiOperation({ summary: 'RWA market overview (totals, distribution, freshness)' })
  overview() {
    return this.query.getOverview()
  }
}
