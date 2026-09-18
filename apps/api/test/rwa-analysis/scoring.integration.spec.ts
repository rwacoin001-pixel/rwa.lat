import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { SCORE_VERSION, ScoringService } from '../../src/rwa-analysis/scoring.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('scoring integration (deterministic on seeded data)', () => {
  let ds: DataSource
  let scoring: ScoringService
  let issuerId: string
  let treasuryId: string
  let creditId: string
  let equityId: string

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.rwa_assets WHERE slug LIKE 't3-%'`)
    await ds.query(`DELETE FROM app.rwa_issuers WHERE slug = 't3-issuer'`)
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    scoring = new ScoringService(ds)
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await cleanup()
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await cleanup()
    issuerId = (
      (await ds.query(
        `INSERT INTO app.rwa_issuers (name, slug, verified, website_url, token_count)
         VALUES ('T3 Issuer', 't3-issuer', true, 'https://t3.example', 100) RETURNING id`,
      )) as Array<{ id: string }>
    )[0].id

    const seed = async (slug: string, name: string, assetClass: string, tokenized: boolean, rank: number, redemptionType?: string) => {
      return (
        (await ds.query(
          `INSERT INTO app.rwa_assets (slug, name, asset_class, is_tokenized, rwa_rank, redemption_type)
           VALUES ($1::varchar(160), $2, $3, $4, $5, COALESCE($6, 'unknown')) RETURNING id`,
          [slug, name, assetClass, tokenized, rank, redemptionType ?? null],
        )) as Array<{ id: string }>
      )[0].id
    }
    treasuryId = await seed('t3-treasury', 'T3 Treasury', 'treasury', true, 1, 'instant')
    creditId = await seed('t3-credit', 'T3 Credit', 'private_credit', false, 2, 'restricted')
    equityId = await seed('t3-equity', 'T3 Equity', 'equity', false, 3)
    await ds.query(`UPDATE app.rwa_assets SET issuer_id = $2 WHERE id = $1`, [treasuryId, issuerId])

    const metric = async (
      assetId: string,
      opts: { price: string; mcap?: string; volume?: string | null; apy?: string | null; c24?: string | null; c7?: string | null; c30?: string | null },
    ) => {
      await ds.query(
        `INSERT INTO app.rwa_asset_metrics
           (asset_id, price_usd, tokenized_market_cap_usd, volume_24h_usd, apy, change_24h_pct, change_7d_pct, change_30d_pct, data_timestamp, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), 'test')`,
        [assetId, opts.price, opts.mcap ?? null, opts.volume ?? null, opts.apy ?? null, opts.c24 ?? null, opts.c7 ?? null, opts.c30 ?? null],
      )
    }
    await metric(treasuryId, { price: '100', mcap: '5000000', volume: '15000000', apy: '4.5', c24: '0.5', c7: '0.5', c30: '0.5' })
    await metric(creditId, { price: '10', mcap: '1000000', volume: '50000', apy: '9.5', c24: '2', c30: '20' })
    await metric(equityId, { price: '20', mcap: '2000000' })
  })

  it('computes expected scores and risk levels for crafted assets', async () => {
    const result = await scoring.runBatch(100)
    expect(result.scored).toBeGreaterThanOrEqual(3)

    const rows = (await ds.query(
      `SELECT a.slug, s.yield_score::text AS y, s.liquidity_score::text AS l, s.issuer_score::text AS i,
              s.collateral_score::text AS c, s.redemption_score::text AS r, s.contract_risk_score::text AS ct,
              s.market_risk_score::text AS m, s.data_quality_score::text AS d,
              s.overall_score::text AS overall, s.risk_level, s.concentration_score
       FROM app.rwa_asset_scores s JOIN app.rwa_assets a ON a.id = s.asset_id
       WHERE a.slug LIKE 't3-%' ORDER BY a.slug`,
    )) as Array<Record<string, any>>
    const bySlug = new Map(rows.map((row) => [row.slug, row]))

    const treasury = bySlug.get('t3-treasury')!
    expect(Number(treasury.y)).toBe(82)
    expect(Number(treasury.l)).toBe(75)
    expect(Number(treasury.i)).toBe(90)
    expect(Number(treasury.c)).toBe(92)
    expect(Number(treasury.r)).toBe(95)
    expect(Number(treasury.ct)).toBe(60)
    expect(Number(treasury.m)).toBe(95)
    expect(Number(treasury.d)).toBe(100)
    expect(Number(treasury.overall)).toBeCloseTo(85.48, 2)
    expect(treasury.risk_level).toBe('low')
    expect(treasury.concentration_score).toBeNull()

    const credit = bySlug.get('t3-credit')!
    expect(Number(credit.overall)).toBeCloseTo(54.7, 2)
    expect(credit.risk_level).toBe('high')

    const equity = bySlug.get('t3-equity')!
    expect(Number(equity.overall)).toBeCloseTo(50.9, 2)
    expect(equity.risk_level).toBe('high')
  })

  it('is idempotent, skips fresh rows, and upserts after staleness', async () => {
    await scoring.runBatch(100)
    const snapshotQuery = `SELECT s.asset_id, s.calculated_at FROM app.rwa_asset_scores s
       JOIN app.rwa_assets a ON a.id = s.asset_id WHERE a.slug LIKE 't3-%' ORDER BY s.asset_id`
    const before = await ds.query(snapshotQuery)
    await scoring.runBatch(100)
    const unchanged = await ds.query(snapshotQuery)
    expect(JSON.stringify(unchanged)).toBe(JSON.stringify(before)) // 12h 内已算过 → 时间戳不变

    await ds.query(
      `UPDATE app.rwa_asset_scores SET calculated_at = now() - interval '13 hours'
       WHERE asset_id IN (SELECT id FROM app.rwa_assets WHERE slug LIKE 't3-%')`,
    )
    const third = await scoring.runBatch(100)
    expect(third.scored).toBeGreaterThanOrEqual(3)

    const counts = (await ds.query(
      `SELECT COUNT(*)::int AS count FROM app.rwa_asset_scores s
       JOIN app.rwa_assets a ON a.id = s.asset_id
       WHERE a.slug LIKE 't3-%' AND s.score_version = $1`,
      [SCORE_VERSION],
    )) as Array<{ count: number }>
    expect(counts[0].count).toBe(3) // 每资产每版本一行（upsert 生效）
  })

  it('exposes latest score and slug-based batch lookup', async () => {
    await scoring.runBatch(100)
    const latest = await scoring.getLatestForAsset(treasuryId)
    expect(latest).not.toBeNull()
    expect(Number(latest.overallScore)).toBeCloseTo(85.48, 2)

    const batch = await scoring.getScoresBySlugs(['t3-treasury', 't3-credit'])
    expect(batch).toHaveLength(2)
    expect(batch.map((row) => row.slug).sort()).toEqual(['t3-credit', 't3-treasury'])
  })
})
