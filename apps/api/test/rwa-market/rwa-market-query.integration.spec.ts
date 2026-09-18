import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { RwaMarketQueryService } from '../../src/rwa-market/rwa-market.query.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('rwa market public query (integration)', () => {
  let ds: DataSource
  let query: RwaMarketQueryService
  let issuerId: string

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.rwa_assets WHERE slug LIKE 't2-%'`)
    await ds.query(`DELETE FROM app.rwa_issuers WHERE slug = 't2-issuer'`)
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    query = new RwaMarketQueryService(ds)
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await cleanup()
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await cleanup()
    query.clearCache()
    issuerId = randomUUID()
    await ds.query(
      `INSERT INTO app.rwa_issuers (id, name, slug, token_count, verified) VALUES ($1, 'T2 Issuer', 't2-issuer', 3, true)`,
      [issuerId],
    )
    const seedAsset = async (slug: string, name: string, assetClass: string, rank: number) => {
      const [row] = (await ds.query(
        `INSERT INTO app.rwa_assets (slug, name, symbol, asset_class, issuer_id, rwa_rank, is_tokenized)
         VALUES ($1::varchar(160), $2, UPPER($1::varchar(160)), $3, $4, $5, true) RETURNING id`,
        [slug, name, assetClass, issuerId, rank],
      )) as Array<{ id: string }>
      return row.id
    }
    const alpha = await seedAsset('t2-alpha', 'T2 Alpha Fund', 'treasury', 10)
    const beta = await seedAsset('t2-beta', 'T2 Beta Equity', 'equity', 5)
    const gamma = await seedAsset('t2-gamma', 'T2 Gamma Gold', 'commodity', 1)

    await ds.query(
      `INSERT INTO app.rwa_asset_metrics (asset_id, price_usd, tokenized_market_cap_usd, volume_24h_usd, change_30d_pct, data_timestamp, source)
       VALUES
         ($1, 100.50, 5000000, 120000, 3.5, now(), 'test'),
         ($2, 20.25, 20000000, 80000, -1.2, now(), 'test'),
         ($3, 4381.23, 1000000, 50000, 9.1, now(), 'test')`,
      [alpha, beta, gamma],
    )
    await ds.query(
      `INSERT INTO app.rwa_asset_metric_history (asset_id, date, price_usd, market_cap_usd)
       SELECT id, CURRENT_DATE - offs, 100.50 - offs, 5000000 - offs * 1000
       FROM app.rwa_assets, generate_series(1, 10) AS offs WHERE slug = 't2-alpha'`,
    )
  })

  it('lists assets with filters, search, sort and pagination', async () => {
    const all = await query.listAssets({ issuer: 't2-issuer' })
    expect(all.total).toBe(3)
    expect(all.items).toHaveLength(3)

    const treasuries = await query.listAssets({ assetClass: 'treasury', issuer: 't2-issuer' })
    expect(treasuries.total).toBe(1)
    expect(treasuries.items[0].slug).toBe('t2-alpha')

    const searched = await query.listAssets({ search: 'beta', issuer: 't2-issuer' })
    expect(searched.total).toBe(1)
    expect(searched.items[0].slug).toBe('t2-beta')

    const byIssuer = await query.listAssets({ issuer: 't2-issuer' })
    expect(byIssuer.total).toBe(3)

    const sorted = await query.listAssets({ sort: 'market_cap', issuer: 't2-issuer' })
    expect(sorted.items[0].slug).toBe('t2-beta') // 20,000,000 最高

    const paged = await query.listAssets({ issuer: 't2-issuer', limit: 2, page: 2, sort: 'rank' })
    expect(paged.total).toBe(3)
    expect(paged.items).toHaveLength(1) // rank 升序: gamma(1) < beta(5) < alpha(10)，第 2 页=alpha
    expect(paged.items[0].slug).toBe('t2-alpha')
  })

  it('returns asset detail with issuer and metrics', async () => {
    const detail = await query.getAssetBySlug('t2-alpha')
    expect(detail.slug).toBe('t2-alpha')
    expect(detail.issuer?.slug).toBe('t2-issuer')
    expect(Number(detail.priceUsd)).toBeCloseTo(100.5, 6)
    expect(detail.sources).toEqual([])

    await expect(query.getAssetBySlug('t2-missing')).rejects.toThrow()
  })

  it('returns daily history series', async () => {
    const series = await query.getAssetHistory('t2-alpha', 30)
    expect(series.points).toHaveLength(10)
    expect(series.points[0].date).toBeDefined()
    expect(Number(series.points[0].priceUsd)).toBeGreaterThan(0)
  })

  it('lists issuers, rankings, categories and overview aggregates', async () => {
    const issuers = await query.listIssuers()
    const t2 = (issuers.items as Array<Record<string, any>>).find((item) => item.slug === 't2-issuer')
    expect(t2).toBeDefined()
    expect(t2!.assetCount).toBe(3)
    expect(Number(t2!.totalMarketCapUsd)).toBeCloseTo(26000000, 0)

    const issuerDetail = await query.getIssuerBySlug('t2-issuer')
    expect(issuerDetail.assets).toHaveLength(3)

    const rankings = await query.listRankings('market_cap', 50)
    const betaRank = (rankings.items as Array<Record<string, any>>).find((item) => item.slug === 't2-beta')
    const alphaRank = (rankings.items as Array<Record<string, any>>).find((item) => item.slug === 't2-alpha')
    expect(betaRank).toBeDefined()
    expect(alphaRank).toBeDefined()
    expect(betaRank!.position).toBeLessThan(alphaRank!.position) // 20M > 1M
    expect(betaRank!.rank).toBe(5) // rwa_rank 原值保留

    const categories = await query.listCategories()
    const treasury = (categories.items as Array<Record<string, any>>).find((row) => row.assetClass === 'treasury')
    expect(treasury?.assetCount).toBeGreaterThanOrEqual(1)

    const overview = (await query.getOverview()) as unknown as Record<string, any>
    expect(overview.assetCount).toBeGreaterThanOrEqual(3)
    expect(Number(overview.totalMarketCapUsd)).toBeGreaterThanOrEqual(26000000)
    expect(Array.isArray(overview.categoryDistribution)).toBe(true)
  })
})
