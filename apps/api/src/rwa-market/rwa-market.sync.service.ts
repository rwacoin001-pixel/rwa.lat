import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import {
  RWA_DATA_PROVIDER,
  RWA_MARKET_SYNC_QUEUE,
  RWA_SYNC_LOCK_KEY,
  type RwaSyncKind,
} from './rwa-market.constants'
import type { NormalizedRwaAsset, NormalizedTokenRef, RwaDataProvider } from './providers/rwa-data-provider'
import { slugify } from './normalizers/rwa.normalizer'

export const RWA_MARKET_ERROR_CODES = {
  SYNC_IN_PROGRESS: 'RWA_SYNC_IN_PROGRESS',
  SYNC_FAILED: 'RWA_SYNC_FAILED',
} as const

export type SyncRunSummary = {
  runId: string
  provider: string
  kind: RwaSyncKind
  status: 'success' | 'partial' | 'failed'
  itemsTotal: number
  itemsUpserted: number
  itemsFailed: number
  durationMs: number
}

export type SyncOptions = {
  /** 限制本次拉取条目数（运维手动同步用；定时全量不传） */
  maxItems?: number
}

const CHUNK_SIZE = 200

/** 静态网络种子（合约/多链支持就绪；当前 CMC RWA 资产数据不含链信息） */
const NETWORK_SEEDS: Array<{ name: string; slug: string; chainId: string | null; nativeSymbol: string | null; explorerUrl: string | null }> = [
  { name: 'Ethereum', slug: 'ethereum', chainId: '1', nativeSymbol: 'ETH', explorerUrl: 'https://etherscan.io' },
  { name: 'Tron', slug: 'tron', chainId: '728126428', nativeSymbol: 'TRX', explorerUrl: 'https://tronscan.org' },
  { name: 'BNB Chain', slug: 'bnb-chain', chainId: '56', nativeSymbol: 'BNB', explorerUrl: 'https://bscscan.com' },
  { name: 'Polygon', slug: 'polygon', chainId: '137', nativeSymbol: 'POL', explorerUrl: 'https://polygonscan.com' },
  { name: 'Arbitrum One', slug: 'arbitrum', chainId: '42161', nativeSymbol: 'ETH', explorerUrl: 'https://arbiscan.io' },
  { name: 'Optimism', slug: 'optimism', chainId: '10', nativeSymbol: 'ETH', explorerUrl: 'https://optimistic.etherscan.io' },
  { name: 'Base', slug: 'base', chainId: '8453', nativeSymbol: 'ETH', explorerUrl: 'https://basescan.org' },
  { name: 'Solana', slug: 'solana', chainId: null, nativeSymbol: 'SOL', explorerUrl: 'https://solscan.io' },
  { name: 'Avalanche C-Chain', slug: 'avalanche', chainId: '43114', nativeSymbol: 'AVAX', explorerUrl: 'https://snowtrace.io' },
  { name: 'XRP Ledger', slug: 'xrp-ledger', chainId: null, nativeSymbol: 'XRP', explorerUrl: 'https://xrpscan.com' },
]

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 主发行商 = 市值最大的代币所属发行商（确定性） */
function pickPrimaryToken(tokens: NormalizedTokenRef[]): NormalizedTokenRef | null {
  let best: NormalizedTokenRef | null = null
  let bestCap = -1
  for (const token of tokens) {
    const cap = token.marketCapUsd ? Number(token.marketCapUsd) : -1
    if (cap > bestCap) {
      bestCap = cap
      best = token
    }
  }
  return best
}

/** 按 key 去重（防御上游出现重复键——单条 INSERT…ON CONFLICT 语句内重复键会直接报错） */
function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const value = key(item)
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(item)
  }
  return out
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 500)
}

/**
 * RWA 目录同步服务（规格 §3-4/§76-79）：
 * - 防重入：PG advisory lock（session 级，绑定专用连接）
 * - 全部 upsert 幂等：资产按 slug、来源按 (provider, external_id)、行情按 asset_id、历史按 (asset_id, date)
 * - 每次运行写 rwa_sync_runs（pending→running→success/partial/failed + 计数 + meta）
 */
@Injectable()
export class RwaMarketSyncService {
  private readonly log = new Logger(RwaMarketSyncService.name)

  constructor(
    @Inject(RWA_DATA_PROVIDER) private readonly provider: RwaDataProvider,
    private readonly ds: DataSource,
  ) {}

  /**
   * 执行一次同步（带 advisory lock + 运行记录）。
   * 并发调用直接抛 409 RWA_SYNC_IN_PROGRESS。
   */
  async run(kind: RwaSyncKind, options: SyncOptions = {}): Promise<SyncRunSummary> {
    const startedAt = Date.now()
    const runner = this.ds.createQueryRunner()
    await runner.connect()
    try {
      const [lock] = (await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [RWA_SYNC_LOCK_KEY])) as Array<{ locked: boolean }>
      if (!lock?.locked) {
        throw new ConflictException({
          code: RWA_MARKET_ERROR_CODES.SYNC_IN_PROGRESS,
          message: 'Another RWA sync run is already in progress.',
        })
      }
      try {
        return await this.execute(kind, options, startedAt)
      } finally {
        try {
          await runner.query('SELECT pg_advisory_unlock($1)', [RWA_SYNC_LOCK_KEY])
        } catch (unlockError) {
          this.log.warn(`advisory unlock failed: ${safeError(unlockError)}`)
        }
      }
    } finally {
      await runner.release()
    }
  }

  async listRuns(limit = 20) {
    const bounded = Math.min(Math.max(Math.trunc(limit), 1), 100)
    const runs = await this.ds.query(
      `SELECT id, provider, kind, status, started_at AS "startedAt", finished_at AS "finishedAt",
              items_total AS "itemsTotal", items_upserted AS "itemsUpserted", items_failed AS "itemsFailed",
              error, meta
       FROM app.rwa_sync_runs ORDER BY started_at DESC LIMIT $1`,
      [bounded],
    )
    return { runs, limit: bounded }
  }

  private async execute(kind: RwaSyncKind, options: SyncOptions, startedAt: number): Promise<SyncRunSummary> {
    const [run] = (await this.ds.query(
      `INSERT INTO app.rwa_sync_runs (provider, kind, status, started_at)
       VALUES ($1, $2, 'running', now()) RETURNING id`,
      [this.provider.providerName, kind],
    )) as Array<{ id: string }>

    try {
      let result: { total: number; upserted: number; failed: number; meta?: Record<string, unknown> }
      switch (kind) {
        case 'issuers':
          result = await this.syncIssuers()
          break
        case 'assets':
          result = await this.syncAssets(options)
          break
        case 'metrics':
          result = await this.syncMetrics(options)
          break
        case 'snapshot':
          result = await this.syncSnapshot()
          break
      }
      const status = result.failed > 0 && result.upserted === 0 ? 'failed' : result.failed > 0 ? 'partial' : 'success'
      await this.ds.query(
        `UPDATE app.rwa_sync_runs
         SET status = $2, finished_at = now(), items_total = $3, items_upserted = $4, items_failed = $5, meta = $6::jsonb
         WHERE id = $1`,
        [run.id, status, result.total, result.upserted, result.failed, JSON.stringify(result.meta ?? {})],
      )
      const summary: SyncRunSummary = {
        runId: run.id,
        provider: this.provider.providerName,
        kind,
        status,
        itemsTotal: result.total,
        itemsUpserted: result.upserted,
        itemsFailed: result.failed,
        durationMs: Date.now() - startedAt,
      }
      this.log.log(`RWA sync ${kind} ${status}: ${result.upserted}/${result.total} upserted, ${result.failed} failed (${summary.durationMs}ms)`)
      return summary
    } catch (error) {
      await this.ds.query(
        `UPDATE app.rwa_sync_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1`,
        [run.id, safeError(error)],
      )
      throw error
    }
  }

  // ---- issuers ----
  private async syncIssuers() {
    const issuers = await this.provider.syncIssuers()
    let upserted = 0
    for (const chunkItems of chunk(issuers)) {
      const values: unknown[] = []
      const tuples = chunkItems.map((issuer, index) => {
        const base = index * 5
        values.push(issuer.name, issuer.slug, issuer.websiteUrl, issuer.logoUrl, issuer.tokenCount)
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
      })
      const rows = (await this.ds.query(
        `INSERT INTO app.rwa_issuers (name, slug, website_url, logo_url, token_count)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           website_url = COALESCE(EXCLUDED.website_url, app.rwa_issuers.website_url),
           logo_url = COALESCE(EXCLUDED.logo_url, app.rwa_issuers.logo_url),
           token_count = EXCLUDED.token_count,
           updated_at = now()
         RETURNING id`,
        values,
      )) as Array<{ id: string }>
      upserted += rows.length
    }
    return { total: issuers.length, upserted, failed: Math.max(issuers.length - upserted, 0) }
  }

  // ---- assets ----
  private async syncAssets(options: SyncOptions) {
    await this.seedNetworks()
    const assets = dedupeBy(await this.provider.syncAssets({ maxItems: options.maxItems }), (asset) => asset.externalSlug)
    const issuerRows = (await this.ds.query(`SELECT id, slug FROM app.rwa_issuers`)) as Array<{ id: string; slug: string }>
    const issuerBySlug = new Map(issuerRows.map((row) => [row.slug, row.id]))

    let upserted = 0
    let failed = 0
    const seenExternalIds = new Set<string>()
    for (const chunkItems of chunk(assets)) {
      try {
        const idBySlug = await this.upsertAssetChunk(chunkItems, issuerBySlug)
        await this.upsertSourceChunk(chunkItems, idBySlug, seenExternalIds)
        upserted += chunkItems.length
      } catch (error) {
        failed += chunkItems.length
        this.log.warn(`asset chunk upsert failed (${chunkItems.length} items): ${safeError(error)}`)
      }
    }
    let issuerLinks = 0
    try {
      issuerLinks = await this.enrichIssuerLinks(issuerBySlug)
    } catch (error) {
      this.log.warn(`issuer enrichment failed: ${safeError(error)}`)
    }
    return { total: assets.length, upserted, failed, meta: { issuers: issuerBySlug.size, issuerLinks } }
  }

  /**
   * 发行商关联（规格 §5 目录完整性）：对 issuer_id 仍为空的资产批量拉代币明细
   * （quotes/latest，50 id/批），以市值最大的代币所属发行商为主发行商；
   * 上游新发行人按 slug 就地补建（幂等）。
   */
  private async enrichIssuerLinks(issuerBySlug: Map<string, string>): Promise<number> {
    if (typeof this.provider.getAssetTokens !== 'function') return 0
    const rows = (await this.ds.query(
      `SELECT a.id AS asset_id, s.external_id
       FROM app.rwa_asset_sources s
       JOIN app.rwa_assets a ON a.id = s.asset_id
       WHERE s.provider = $1 AND a.status = 'active' AND a.issuer_id IS NULL
       ORDER BY a.rwa_rank ASC NULLS LAST
       LIMIT 20000`,
      [this.provider.providerName],
    )) as Array<{ asset_id: string; external_id: string }>
    if (!rows.length) return 0
    const assetByExternal = new Map(rows.map((row) => [row.external_id, row.asset_id]))
    const pending: Array<{ assetId: string; issuerId: string }> = []
    for (const batch of chunk(rows.map((row) => row.external_id), 50)) {
      const results = await this.provider.getAssetTokens(batch)
      for (const result of results) {
        const assetId = assetByExternal.get(result.externalId)
        if (!assetId) continue
        const primary = pickPrimaryToken(result.tokens)
        if (!primary?.issuerName) continue
        const issuerId = await this.resolveIssuer(primary.issuerName, issuerBySlug)
        if (issuerId) pending.push({ assetId, issuerId })
      }
    }
    let linked = 0
    for (const part of chunk(pending, 500)) {
      const values: unknown[] = []
      const tuples = part.map((pair) => {
        values.push(pair.assetId, pair.issuerId)
        return `($${values.length - 1}::uuid, $${values.length}::uuid)`
      })
      const updated = (await this.ds.query(
        `UPDATE app.rwa_assets a
         SET issuer_id = v.issuer_id, updated_at = now()
         FROM (VALUES ${tuples.join(', ')}) AS v(asset_id, issuer_id)
         WHERE a.id = v.asset_id AND a.issuer_id IS NULL
         RETURNING a.id`,
        values,
      )) as unknown
      linked += Array.isArray(updated) ? updated.length : 0
    }
    return linked
  }

  private async resolveIssuer(name: string, cache: Map<string, string>): Promise<string | null> {
    const slug = slugify(name)
    if (!slug) return null
    const cached = cache.get(slug)
    if (cached) return cached
    const rows = (await this.ds.query(
      `INSERT INTO app.rwa_issuers (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [name, slug],
    )) as Array<{ id: string }>
    const id = rows[0]?.id ?? null
    if (id) cache.set(slug, id)
    return id
  }

  private async upsertAssetChunk(items: NormalizedRwaAsset[], issuerBySlug: Map<string, string>): Promise<Map<string, string>> {
    const values: unknown[] = []
    const tuples = items.map((asset, index) => {
      const base = index * 10
      values.push(
        asset.externalSlug,
        asset.name,
        asset.symbol,
        asset.assetClass,
        asset.description,
        asset.issuerName ? issuerBySlug.get(slugify(asset.issuerName)) ?? null : null,
        asset.websiteUrl,
        asset.logoUrl,
        asset.rank,
        asset.isTokenized,
      )
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
    })
    const rows = (await this.ds.query(
      `INSERT INTO app.rwa_assets
         (slug, name, symbol, asset_class, description, issuer_id, website_url, logo_url, rwa_rank, is_tokenized)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         symbol = COALESCE(EXCLUDED.symbol, app.rwa_assets.symbol),
         asset_class = EXCLUDED.asset_class,
         description = COALESCE(EXCLUDED.description, app.rwa_assets.description),
         issuer_id = COALESCE(EXCLUDED.issuer_id, app.rwa_assets.issuer_id),
         website_url = COALESCE(EXCLUDED.website_url, app.rwa_assets.website_url),
         logo_url = COALESCE(EXCLUDED.logo_url, app.rwa_assets.logo_url),
         rwa_rank = EXCLUDED.rwa_rank,
         is_tokenized = EXCLUDED.is_tokenized,
         updated_at = now()
       RETURNING id, slug`,
      values,
    )) as Array<{ id: string; slug: string }>
    return new Map(rows.map((row) => [row.slug, row.id]))
  }

  private async upsertSourceChunk(items: NormalizedRwaAsset[], idBySlug: Map<string, string>, seen: Set<string>): Promise<void> {
    const values: unknown[] = []
    const tuples: string[] = []
    for (const asset of items) {
      const assetId = idBySlug.get(asset.externalSlug)
      if (!assetId || seen.has(asset.externalId)) continue
      seen.add(asset.externalId)
      const base = values.length
      values.push(
        assetId,
        this.provider.providerName,
        asset.externalId,
        asset.externalSlug,
        `https://coinmarketcap.com/real-world-assets/${asset.externalSlug}/`,
        JSON.stringify({ rank: asset.rank, assetType: asset.rawAssetType }),
      )
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, now(), now(), 'ok', $${base + 6}::jsonb)`)
    }
    if (!tuples.length) return
    await this.ds.query(
      `INSERT INTO app.rwa_asset_sources
         (asset_id, provider, external_id, external_slug, source_url, last_synced_at, last_successful_sync_at, sync_status, raw_metadata)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (provider, external_id) DO UPDATE SET
         asset_id = EXCLUDED.asset_id,
         external_slug = EXCLUDED.external_slug,
         source_url = EXCLUDED.source_url,
         last_synced_at = now(),
         last_successful_sync_at = now(),
         sync_status = 'ok',
         raw_metadata = EXCLUDED.raw_metadata,
         updated_at = now()`,
      values,
    )
  }

  // ---- metrics ----
  private async syncMetrics(options: SyncOptions) {
    const metrics = dedupeBy(await this.provider.syncMetrics({ maxItems: options.maxItems }), (metric) => metric.externalId)
    if (!metrics.length) return { total: 0, upserted: 0, failed: 0 }

    const externalIds = metrics.map((metric) => metric.externalId)
    const sourceRows = (await this.ds.query(
      `SELECT asset_id, external_id FROM app.rwa_asset_sources
       WHERE provider = $1 AND external_id = ANY($2)`,
      [this.provider.providerName, externalIds],
    )) as Array<{ asset_id: string; external_id: string }>
    const assetByExternalId = new Map(sourceRows.map((row) => [row.external_id, row.asset_id]))

    const matched = dedupeBy(metrics.filter((metric) => assetByExternalId.has(metric.externalId)), (metric) => assetByExternalId.get(metric.externalId) ?? '')
    let upserted = 0
    let failed = metrics.length - matched.length

    for (const chunkItems of chunk(matched)) {
      try {
        await this.upsertMetricChunk(chunkItems, assetByExternalId)
        await this.upsertHistoryChunk(chunkItems, assetByExternalId)
        upserted += chunkItems.length
      } catch (error) {
        failed += chunkItems.length
        this.log.warn(`metric chunk upsert failed (${chunkItems.length} items): ${safeError(error)}`)
      }
    }
    if (upserted > 0) {
      await this.ds.query(
        `UPDATE app.rwa_asset_sources
         SET last_synced_at = now(), last_successful_sync_at = now(), sync_status = 'ok'
         WHERE provider = $1 AND external_id = ANY($2)`,
        [this.provider.providerName, matched.map((metric) => metric.externalId)],
      )
    }
    return { total: metrics.length, upserted, failed }
  }

  private async upsertMetricChunk(
    items: Array<{ externalId: string; priceUsd: string | null; tokenizedMarketCapUsd: string | null; tokenizedVolume24hUsd: string | null; dataTimestamp: Date | null }>,
    assetByExternalId: Map<string, string>,
  ): Promise<void> {
    const values: unknown[] = []
    const tuples: string[] = []
    for (const metric of items) {
      const assetId = assetByExternalId.get(metric.externalId)
      if (!assetId) continue
      const base = values.length
      values.push(assetId, metric.priceUsd, metric.tokenizedMarketCapUsd, metric.tokenizedVolume24hUsd, metric.dataTimestamp, this.provider.providerName)
      tuples.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`)
    }
    if (!tuples.length) return
    await this.ds.query(
      `INSERT INTO app.rwa_asset_metrics
         (asset_id, price_usd, tokenized_market_cap_usd, volume_24h_usd, data_timestamp, source)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (asset_id) DO UPDATE SET
         price_usd = COALESCE(EXCLUDED.price_usd, app.rwa_asset_metrics.price_usd),
         tokenized_market_cap_usd = COALESCE(EXCLUDED.tokenized_market_cap_usd, app.rwa_asset_metrics.tokenized_market_cap_usd),
         volume_24h_usd = COALESCE(EXCLUDED.volume_24h_usd, app.rwa_asset_metrics.volume_24h_usd),
         data_timestamp = COALESCE(EXCLUDED.data_timestamp, app.rwa_asset_metrics.data_timestamp),
         source = EXCLUDED.source,
         updated_at = now()`,
      values,
    )
  }

  private async upsertHistoryChunk(
    items: Array<{ externalId: string; priceUsd: string | null; tokenizedMarketCapUsd: string | null; tokenizedVolume24hUsd: string | null; dataTimestamp: Date | null }>,
    assetByExternalId: Map<string, string>,
  ): Promise<void> {
    const values: unknown[] = []
    const tuples: string[] = []
    for (const metric of items) {
      const assetId = assetByExternalId.get(metric.externalId)
      if (!assetId) continue
      const date = metric.dataTimestamp ?? new Date()
      const base = values.length
      values.push(assetId, date.toISOString().slice(0, 10), metric.priceUsd, metric.tokenizedMarketCapUsd, metric.tokenizedVolume24hUsd)
      tuples.push(`($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5})`)
    }
    if (!tuples.length) return
    await this.ds.query(
      `INSERT INTO app.rwa_asset_metric_history
         (asset_id, date, price_usd, market_cap_usd, volume_24h_usd)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (asset_id, date) DO UPDATE SET
         price_usd = COALESCE(EXCLUDED.price_usd, app.rwa_asset_metric_history.price_usd),
         market_cap_usd = COALESCE(EXCLUDED.market_cap_usd, app.rwa_asset_metric_history.market_cap_usd),
         volume_24h_usd = COALESCE(EXCLUDED.volume_24h_usd, app.rwa_asset_metric_history.volume_24h_usd)`,
      values,
    )
  }

  // ---- snapshot（当日历史 + 1/7/30 日涨跌幅回填）----
  private async syncSnapshot() {
    const inserted = (await this.ds.query(
      `INSERT INTO app.rwa_asset_metric_history (asset_id, date, price_usd, market_cap_usd, volume_24h_usd)
       SELECT asset_id, CURRENT_DATE, price_usd, tokenized_market_cap_usd, volume_24h_usd
       FROM app.rwa_asset_metrics
       WHERE price_usd IS NOT NULL
       ON CONFLICT (asset_id, date) DO UPDATE SET
         price_usd = EXCLUDED.price_usd,
         market_cap_usd = EXCLUDED.market_cap_usd,
         volume_24h_usd = EXCLUDED.volume_24h_usd
       RETURNING asset_id`,
    )) as unknown
    const updated = (await this.ds.query(
      `WITH h1 AS (
         SELECT DISTINCT ON (asset_id) asset_id, price_usd
         FROM app.rwa_asset_metric_history
         WHERE date <= CURRENT_DATE - 1 AND price_usd IS NOT NULL
         ORDER BY asset_id, date DESC
       ), h7 AS (
         SELECT DISTINCT ON (asset_id) asset_id, price_usd
         FROM app.rwa_asset_metric_history
         WHERE date <= CURRENT_DATE - 7 AND price_usd IS NOT NULL
         ORDER BY asset_id, date DESC
       ), h30 AS (
         SELECT DISTINCT ON (asset_id) asset_id, price_usd
         FROM app.rwa_asset_metric_history
         WHERE date <= CURRENT_DATE - 30 AND price_usd IS NOT NULL
         ORDER BY asset_id, date DESC
       ), base AS (
         SELECT asset_id FROM app.rwa_asset_metrics WHERE price_usd IS NOT NULL
       )
       UPDATE app.rwa_asset_metrics m
       SET change_24h_pct = CASE WHEN h1.price_usd > 0 AND m.price_usd IS NOT NULL
             THEN ROUND(((m.price_usd - h1.price_usd) / h1.price_usd) * 100, 8) ELSE m.change_24h_pct END,
           change_7d_pct = CASE WHEN h7.price_usd > 0 AND m.price_usd IS NOT NULL
             THEN ROUND(((m.price_usd - h7.price_usd) / h7.price_usd) * 100, 8) ELSE m.change_7d_pct END,
           change_30d_pct = CASE WHEN h30.price_usd > 0 AND m.price_usd IS NOT NULL
             THEN ROUND(((m.price_usd - h30.price_usd) / h30.price_usd) * 100, 8) ELSE m.change_30d_pct END,
           updated_at = now()
       FROM base b
       LEFT JOIN h1 ON h1.asset_id = b.asset_id
       LEFT JOIN h7 ON h7.asset_id = b.asset_id
       LEFT JOIN h30 ON h30.asset_id = b.asset_id
       WHERE m.asset_id = b.asset_id
       RETURNING m.asset_id`,
    )) as unknown
    const count = Array.isArray(updated) ? updated.length : 0
    const insertedCount = Array.isArray(inserted) && Array.isArray(inserted[0]) ? inserted[0].length : count
    return { total: count, upserted: count, failed: 0, meta: { historyRows: insertedCount, changeRowsUpdated: count } }
  }

  // ---- networks seed ----
  private async seedNetworks(): Promise<void> {
    const values: unknown[] = []
    const tuples = NETWORK_SEEDS.map((network, index) => {
      const base = index * 5
      values.push(network.name, network.slug, network.chainId, network.nativeSymbol, network.explorerUrl)
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    })
    await this.ds.query(
      `INSERT INTO app.rwa_networks (name, slug, chain_id, native_symbol, explorer_url)
       VALUES ${tuples.join(', ')}
       ON CONFLICT (slug) DO NOTHING`,
      values,
    )
  }
}
