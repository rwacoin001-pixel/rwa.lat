import { Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'

export type ListAssetsParams = {
  assetClass?: string
  issuer?: string
  tokenized?: boolean
  featured?: boolean
  search?: string
  sort?: 'rank' | 'market_cap' | 'volume' | 'change_24h' | 'apy' | 'name'
  page?: number
  limit?: number
}

const ASSET_SELECT = `
  a.slug, a.name, a.symbol, a.asset_class, a.logo_url, a.country_code, a.region,
  a.rwa_rank, a.is_tokenized, a.is_verified, a.is_featured,
  a.eligibility_type, a.redemption_type, a.status,
  i.slug AS issuer_slug, i.name AS issuer_name,
  trim_scale(m.price_usd)::text AS price_usd,
  trim_scale(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd))::text AS market_cap_usd,
  trim_scale(m.tokenized_market_cap_usd)::text AS tokenized_market_cap_usd,
  trim_scale(m.volume_24h_usd)::text AS volume_24h_usd,
  trim_scale(m.change_24h_pct)::text AS change_24h_pct,
  trim_scale(m.change_7d_pct)::text AS change_7d_pct,
  trim_scale(m.change_30d_pct)::text AS change_30d_pct,
  trim_scale(m.apy)::text AS apy,
  m.data_timestamp AS data_timestamp,
  trim_scale(s.overall_score)::text AS overall_score,
  s.risk_level AS risk_level
`

const ASSET_FROM = `
  FROM app.rwa_assets a
  LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
  LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
  LEFT JOIN LATERAL (
    SELECT overall_score, risk_level FROM app.rwa_asset_scores sc
    WHERE sc.asset_id = a.id ORDER BY sc.calculated_at DESC LIMIT 1
  ) s ON true
`

const SORT_SQL: Record<string, string> = {
  rank: 'a.rwa_rank ASC NULLS LAST, a.name ASC',
  market_cap: 'COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd) DESC NULLS LAST',
  volume: 'm.volume_24h_usd DESC NULLS LAST',
  change_24h: 'm.change_24h_pct DESC NULLS LAST',
  apy: 'm.apy DESC NULLS LAST',
  name: 'a.name ASC',
}

const RANKING_FIELDS: Record<string, string> = {
  market_cap: 'COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)',
  tvl: 'm.tvl_usd',
  volume: 'm.volume_24h_usd',
  apy: 'm.apy',
  change_24h: 'm.change_24h_pct',
  score: 's.overall_score',
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&')
}

function mapAssetRow(row: Record<string, any>) {
  return {
    slug: row.slug,
    name: row.name,
    symbol: row.symbol,
    assetClass: row.asset_class,
    logoUrl: row.logo_url,
    countryCode: row.country_code,
    region: row.region,
    rank: row.rwa_rank,
    isTokenized: row.is_tokenized,
    isVerified: row.is_verified,
    isFeatured: row.is_featured,
    eligibilityType: row.eligibility_type,
    redemptionType: row.redemption_type,
    status: row.status,
    issuer: row.issuer_slug ? { slug: row.issuer_slug, name: row.issuer_name } : null,
    priceUsd: row.price_usd,
    marketCapUsd: row.market_cap_usd,
    tokenizedMarketCapUsd: row.tokenized_market_cap_usd,
    volume24hUsd: row.volume_24h_usd,
    change24hPct: row.change_24h_pct,
    change7dPct: row.change_7d_pct,
    change30dPct: row.change_30d_pct,
    apy: row.apy,
    dataTimestamp: row.data_timestamp,
    score: row.overall_score !== null && row.overall_score !== undefined ? Number(row.overall_score) : null,
    riskLevel: row.risk_level,
  }
}

/** 公开 RWA 目录读取（规格 A 段 §5；无认证、参数化查询、口径与 rwa_asset_sources 解耦） */
@Injectable()
export class RwaMarketQueryService {
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>()
  private readonly cacheTtlMs = 45_000

  constructor(private readonly ds: DataSource) {}

  clearCache(): void {
    this.cache.clear()
  }

  private async cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.value as T
    const value = await loader()
    this.cache.set(key, { expiresAt: Date.now() + this.cacheTtlMs, value })
    return value
  }

  async listAssets(params: ListAssetsParams) {
    const page = Math.max(Math.trunc(params.page ?? 1), 1)
    const limit = Math.min(Math.max(Math.trunc(params.limit ?? 20), 1), 100)
    const sort = SORT_SQL[params.sort ?? 'rank'] ?? SORT_SQL.rank

    const where: string[] = [`a.status = 'active'`]
    const values: unknown[] = []
    if (params.assetClass) {
      values.push(params.assetClass)
      where.push(`a.asset_class = $${values.length}`)
    }
    if (params.issuer) {
      values.push(params.issuer)
      where.push(`i.slug = $${values.length}`)
    }
    if (params.tokenized !== undefined) {
      values.push(params.tokenized)
      where.push(`a.is_tokenized = $${values.length}`)
    }
    if (params.featured !== undefined) {
      values.push(params.featured)
      where.push(`a.is_featured = $${values.length}`)
    }
    if (params.search && params.search.trim()) {
      values.push(`%${escapeLike(params.search.trim())}%`)
      where.push(`(a.name ILIKE $${values.length} OR a.symbol ILIKE $${values.length} OR a.slug ILIKE $${values.length})`)
    }
    const whereSql = where.join(' AND ')
    const cacheKey = `assets:${JSON.stringify(params)}`

    return this.cached(cacheKey, async () => {
      const countRows = (await this.ds.query(
        `SELECT COUNT(*)::int AS total ${ASSET_FROM} WHERE ${whereSql}`,
        values,
      )) as Array<{ total: number }>
      const items = (await this.ds.query(
        `SELECT ${ASSET_SELECT} ${ASSET_FROM}
         WHERE ${whereSql}
         ORDER BY ${sort}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, (page - 1) * limit],
      )) as Array<Record<string, any>>
      return {
        items: items.map(mapAssetRow),
        total: countRows[0]?.total ?? 0,
        page,
        limit,
      }
    })
  }

  async getAssetBySlug(slug: string) {
    const rows = (await this.ds.query(
      `SELECT ${ASSET_SELECT}, a.description, a.website_url ${ASSET_FROM} WHERE a.slug = $1 LIMIT 1`,
      [slug],
    )) as Array<Record<string, any>>
    const asset = rows[0]
    if (!asset) {
      throw new NotFoundException({ code: 'RWA_ASSET_NOT_FOUND', message: 'RWA asset was not found.' })
    }
    const [sources, contracts, scoreRows, aiRows] = await Promise.all([
      this.ds.query(
        `SELECT provider, external_id AS "externalId", external_slug AS "externalSlug", source_url AS "sourceUrl",
                last_successful_sync_at AS "lastSyncedAt", sync_status AS "syncStatus"
         FROM app.rwa_asset_sources WHERE asset_id = (SELECT id FROM app.rwa_assets WHERE slug = $1)
         ORDER BY provider`,
        [slug],
      ),
      this.ds.query(
        `SELECT c.contract_address AS "contractAddress", c.token_symbol AS "tokenSymbol", c.decimals,
                c.token_standard AS "tokenStandard", c.verified, c.transfer_restricted AS "transferRestricted",
                c.whitelist_required AS "whitelistRequired", n.slug AS "networkSlug", n.name AS "networkName"
         FROM app.rwa_asset_contracts c
         JOIN app.rwa_networks n ON n.id = c.network_id
         JOIN app.rwa_assets a ON a.id = c.asset_id
         WHERE a.slug = $1
         ORDER BY n.slug`,
        [slug],
      ),
      this.ds.query(
        `SELECT trim_scale(sc.yield_score)::text AS "yieldScore", trim_scale(sc.liquidity_score)::text AS "liquidityScore",
                trim_scale(sc.issuer_score)::text AS "issuerScore", trim_scale(sc.collateral_score)::text AS "collateralScore",
                trim_scale(sc.redemption_score)::text AS "redemptionScore", trim_scale(sc.contract_risk_score)::text AS "contractRiskScore",
                trim_scale(sc.concentration_score)::text AS "concentrationScore", trim_scale(sc.market_risk_score)::text AS "marketRiskScore",
                trim_scale(sc.data_quality_score)::text AS "dataQualityScore", trim_scale(sc.overall_score)::text AS "overallScore",
                sc.risk_level AS "riskLevel", sc.score_version AS "scoreVersion", sc.calculated_at AS "calculatedAt"
         FROM app.rwa_asset_scores sc
         JOIN app.rwa_assets a ON a.id = sc.asset_id
         WHERE a.slug = $1 ORDER BY sc.calculated_at DESC LIMIT 1`,
        [slug],
      ),
      this.ds.query(
        `SELECT ai.summary, ai.bull_case AS "bullCase", ai.bear_case AS "bearCase", ai.risk_summary AS "riskSummary",
                ai.liquidity_analysis AS "liquidityAnalysis", ai.issuer_analysis AS "issuerAnalysis",
                ai.redemption_analysis AS "redemptionAnalysis", ai.contract_analysis AS "contractAnalysis",
                ai.structured_signals AS "structuredSignals", ai.model, ai.generated_at AS "generatedAt"
         FROM app.rwa_ai_analysis ai
         JOIN app.rwa_assets a ON a.id = ai.asset_id
         WHERE a.slug = $1 ORDER BY ai.generated_at DESC LIMIT 1`,
        [slug],
      ),
    ])
    return {
      ...mapAssetRow(asset),
      description: asset.description,
      websiteUrl: asset.website_url,
      sources,
      contracts,
      score: scoreRows[0] ?? null,
      aiAnalysis: aiRows[0] ?? null,
    }
  }

  async getAssetHistory(slug: string, days = 90) {
    const boundedDays = Math.min(Math.max(Math.trunc(days), 7), 365)
    const rows = (await this.ds.query(
      `SELECT h.date, trim_scale(h.price_usd)::text AS "priceUsd",
              trim_scale(h.market_cap_usd)::text AS "marketCapUsd",
              trim_scale(h.volume_24h_usd)::text AS "volumeUsd"
       FROM app.rwa_asset_metric_history h
       JOIN app.rwa_assets a ON a.id = h.asset_id
       WHERE a.slug = $1 AND h.date >= CURRENT_DATE - $2::int
       ORDER BY h.date ASC`,
      [slug, boundedDays],
    )) as Array<Record<string, any>>
    return { slug, days: boundedDays, points: rows }
  }

  async listIssuers() {
    return this.cached('issuers', async () => {
      const rows = await this.ds.query(
        `SELECT i.slug, i.name, i.logo_url AS "logoUrl", i.website_url AS "websiteUrl",
                i.token_count AS "tokenCount", i.verified,
                COUNT(a.id)::int AS "assetCount",
                trim_scale(SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)))::text AS "totalMarketCapUsd"
         FROM app.rwa_issuers i
         LEFT JOIN app.rwa_assets a ON a.issuer_id = i.id AND a.status = 'active'
         LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
         GROUP BY i.id
         ORDER BY SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)) DESC NULLS LAST, i.name ASC
         LIMIT 200`,
      )
      return { items: rows }
    })
  }

  async getIssuerBySlug(slug: string) {
    const rows = (await this.ds.query(
      `SELECT i.slug, i.name, i.logo_url AS "logoUrl", i.website_url AS "websiteUrl",
              i.token_count AS "tokenCount", i.verified, i.description,
              trim_scale(SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)))::text AS "totalMarketCapUsd"
       FROM app.rwa_issuers i
       LEFT JOIN app.rwa_assets a ON a.issuer_id = i.id AND a.status = 'active'
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       WHERE i.slug = $1
       GROUP BY i.id`,
      [slug],
    )) as Array<Record<string, any>>
    if (!rows[0]) {
      throw new NotFoundException({ code: 'RWA_ISSUER_NOT_FOUND', message: 'RWA issuer was not found.' })
    }
    const assets = await this.listAssets({ issuer: slug, limit: 100, sort: 'market_cap' })
    return { ...rows[0], assets: assets.items }
  }

  async listNetworks() {
    return this.cached('networks', async () => {
      const rows = await this.ds.query(
        `SELECT slug, name, chain_id AS "chainId", native_symbol AS "nativeSymbol",
                explorer_url AS "explorerUrl", logo_url AS "logoUrl", active
         FROM app.rwa_networks WHERE active = true ORDER BY name ASC`,
      )
      return { items: rows }
    })
  }

  async listCategories() {
    return this.cached('categories', async () => {
      const rows = await this.ds.query(
        `SELECT a.asset_class AS "assetClass", COUNT(*)::int AS "assetCount",
                trim_scale(SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)))::text AS "totalMarketCapUsd",
                trim_scale(SUM(COALESCE(m.volume_24h_usd, 0)))::text AS "totalVolume24hUsd",
                trim_scale(AVG(m.change_30d_pct))::text AS "avgChange30dPct"
         FROM app.rwa_assets a
         LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
         WHERE a.status = 'active'
         GROUP BY a.asset_class
         ORDER BY SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)) DESC NULLS LAST`,
      )
      return { items: rows }
    })
  }

  async listRankings(metric = 'market_cap', limit = 10) {
    const field = RANKING_FIELDS[metric] ?? RANKING_FIELDS.market_cap
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 50)
    return this.cached(`rankings:${metric}:${boundedLimit}`, async () => {
      const rows = (await this.ds.query(
        `SELECT ${ASSET_SELECT} ${ASSET_FROM}
         WHERE a.status = 'active' AND ${field} IS NOT NULL
         ORDER BY ${field} DESC NULLS LAST
         LIMIT $1`,
        [boundedLimit],
      )) as Array<Record<string, any>>
      return { metric, items: rows.map(mapAssetRow).map((item, index) => ({ ...item, position: index + 1 })) }
    })
  }

  async getOverview() {
    return this.cached('overview', async () => {
      const [counts] = (await this.ds.query(
        `SELECT
           COUNT(*) FILTER (WHERE a.status = 'active')::int AS "assetCount",
           COUNT(*) FILTER (WHERE a.status = 'active' AND a.is_tokenized)::int AS "tokenizedAssetCount",
           COUNT(*) FILTER (WHERE a.status = 'active' AND m.price_usd IS NOT NULL)::int AS "pricedAssetCount",
           trim_scale(SUM(COALESCE(m.market_cap_usd, m.tokenized_market_cap_usd)))::text AS "totalMarketCapUsd",
           trim_scale(SUM(m.tvl_usd))::text AS "totalTvlUsd",
           trim_scale(SUM(m.volume_24h_usd))::text AS "totalVolume24hUsd",
           MAX(m.data_timestamp) AS "latestDataTimestamp"
         FROM app.rwa_assets a
         LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id`,
      )) as Array<Record<string, any>>
      const [issuerCount] = (await this.ds.query(
        `SELECT COUNT(*)::int AS "issuerCount", COUNT(*) FILTER (WHERE token_count > 0)::int AS "activeIssuerCount" FROM app.rwa_issuers`,
      )) as Array<Record<string, any>>
      const categories = await this.listCategories()
      return {
        ...counts,
        ...issuerCount,
        categoryDistribution: categories.items,
      }
    })
  }
}
