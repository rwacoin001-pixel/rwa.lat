import { ConflictException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { RWA_SYNC_LOCK_KEY } from '../../src/rwa-market/rwa-market.constants'
import { RwaMarketSyncService } from '../../src/rwa-market/rwa-market.sync.service'
import type {
  NormalizedIssuer,
  NormalizedMarketMetric,
  NormalizedRwaAsset,
  ProviderHealth,
  RwaDataProvider,
  SyncAssetsOptions,
  SyncIssuersOptions,
} from '../../src/rwa-market/providers/rwa-data-provider'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

class FakeRwaProvider implements RwaDataProvider {
  readonly providerName = 'fake'

  async syncAssets(_options?: SyncAssetsOptions): Promise<NormalizedRwaAsset[]> {
    return [
      {
        externalId: '9001', externalSlug: 't-gold', name: 'Test Gold', symbol: 'TGOLD',
        assetClass: 'commodity', rawAssetType: 'commodity', description: 'Tokenized test gold.',
        websiteUrl: 'https://example.com/gold', logoUrl: null, rank: 1, isTokenized: true,
        issuerName: 'Test Backed Assets',
      },
      {
        externalId: '9002', externalSlug: 't-nvidia', name: 'Test Nvidia', symbol: 'TNVDA',
        assetClass: 'equity', rawAssetType: 'stock', description: null,
        websiteUrl: null, logoUrl: null, rank: 2, isTokenized: true,
        issuerName: 'Test Backed Assets',
      },
      {
        externalId: '9003', externalSlug: 't-tbill', name: 'Test T-Bill', symbol: 'TTBL',
        assetClass: 'treasury', rawAssetType: 'treasury', description: null,
        websiteUrl: null, logoUrl: null, rank: 3, isTokenized: false,
        issuerName: 'Test Paxos',
      },
    ]
  }

  async syncIssuers(_options?: SyncIssuersOptions): Promise<NormalizedIssuer[]> {
    return [
      { externalId: 'i1', name: 'Test Backed Assets', slug: 'test-backed-assets', websiteUrl: 'https://backed.example', logoUrl: null, tokenCount: 2 },
      { externalId: 'i2', name: 'Test Paxos', slug: 'test-paxos', websiteUrl: null, logoUrl: null, tokenCount: 1 },
    ]
  }

  async syncMetrics(_options?: SyncAssetsOptions): Promise<NormalizedMarketMetric[]> {
    return [
      {
        externalId: '9001', priceUsd: '4381.230000000000', tokenizedMarketCapUsd: '1000000.000000000000',
        tokenizedVolume24hUsd: '50000.000000000000', dataTimestamp: new Date('2026-09-18T08:00:00Z'), tokens: [],
      },
      {
        externalId: '9002', priceUsd: '120.500000000000', tokenizedMarketCapUsd: '500000.000000000000',
        tokenizedVolume24hUsd: '10000.000000000000', dataTimestamp: new Date('2026-09-18T08:00:00Z'), tokens: [],
      },
    ]
  }

  async getAsset(_externalId: string): Promise<NormalizedRwaAsset | null> {
    return null
  }

  async healthCheck(): Promise<ProviderHealth> {
    return { provider: this.providerName, ok: true, checkedAt: new Date() }
  }
}

describeDatabase('rwa market sync (integration)', () => {
  let ds: DataSource
  let service: RwaMarketSyncService

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.rwa_assets WHERE slug LIKE 't-%'`)
    await ds.query(`DELETE FROM app.rwa_issuers WHERE slug IN ('test-backed-assets', 'test-paxos')`)
    await ds.query(`DELETE FROM app.rwa_sync_runs WHERE provider = 'fake'`)
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    service = new RwaMarketSyncService(new FakeRwaProvider(), ds)
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await cleanup()
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await cleanup()
  })

  it('syncs issuers then assets with issuer linkage, idempotently', async () => {
    const issuerRun = await service.run('issuers')
    expect(issuerRun.status).toBe('success')
    expect(issuerRun.itemsUpserted).toBe(2)

    const assetRun = await service.run('assets')
    expect(assetRun.status).toBe('success')
    expect(assetRun.itemsUpserted).toBe(3)

    const rows = (await ds.query(
      `SELECT a.slug, a.asset_class, a.is_tokenized, i.slug AS issuer_slug
       FROM app.rwa_assets a LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       WHERE a.slug LIKE 't-%' ORDER BY a.slug`,
    )) as Array<{ slug: string; asset_class: string; is_tokenized: boolean; issuer_slug: string | null }>
    expect(rows).toHaveLength(3)
    expect(rows.find((row) => row.slug === 't-gold')).toMatchObject({ asset_class: 'commodity', is_tokenized: true, issuer_slug: 'test-backed-assets' })
    expect(rows.find((row) => row.slug === 't-nvidia')).toMatchObject({ asset_class: 'equity', issuer_slug: 'test-backed-assets' })
    expect(rows.find((row) => row.slug === 't-tbill')).toMatchObject({ asset_class: 'treasury', issuer_slug: 'test-paxos' })

    const sources = (await ds.query(
      `SELECT COUNT(*)::int AS count FROM app.rwa_asset_sources WHERE provider = 'fake'`,
    )) as Array<{ count: number }>
    expect(sources[0].count).toBe(3)

    // 幂等：重复全量同步不产生重复行
    await service.run('issuers')
    await service.run('assets')
    const [assetsAfter] = (await ds.query(`SELECT COUNT(*)::int AS count FROM app.rwa_assets WHERE slug LIKE 't-%'`)) as Array<{ count: number }>
    const [sourcesAfter] = (await ds.query(`SELECT COUNT(*)::int AS count FROM app.rwa_asset_sources WHERE provider = 'fake'`)) as Array<{ count: number }>
    const [issuersAfter] = (await ds.query(`SELECT COUNT(*)::int AS count FROM app.rwa_issuers WHERE slug IN ('test-backed-assets', 'test-paxos')`)) as Array<{ count: number }>
    expect(assetsAfter.count).toBe(3)
    expect(sourcesAfter.count).toBe(3)
    expect(issuersAfter.count).toBe(2)
  })

  it('syncs metrics into current + daily history and computes snapshot changes', async () => {
    await service.run('issuers')
    await service.run('assets')
    const metricsRun = await service.run('metrics')
    expect(metricsRun.status).toBe('success')
    expect(metricsRun.itemsUpserted).toBe(2)

    const current = (await ds.query(
      `SELECT m.price_usd::text AS price, m.tokenized_market_cap_usd::text AS mcap, m.source
       FROM app.rwa_asset_metrics m JOIN app.rwa_assets a ON a.id = m.asset_id WHERE a.slug = 't-gold'`,
    )) as Array<{ price: string; mcap: string; source: string }>
    expect(Number(current[0].price)).toBeCloseTo(4381.23, 6)
    expect(Number(current[0].mcap)).toBeCloseTo(1000000, 6)
    expect(current[0].source).toBe('fake')

    const history = (await ds.query(
      `SELECT COUNT(*)::int AS count FROM app.rwa_asset_metric_history h
       JOIN app.rwa_assets a ON a.id = h.asset_id WHERE a.slug LIKE 't-%'`,
    )) as Array<{ count: number }>
    expect(history[0].count).toBe(2)

    // 造 7 天前 / 昨天 历史价，快照回填涨跌幅
    await ds.query(
      `INSERT INTO app.rwa_asset_metric_history (asset_id, date, price_usd)
       SELECT id, CURRENT_DATE - 7, 4000.000000000000 FROM app.rwa_assets WHERE slug = 't-gold'
       ON CONFLICT (asset_id, date) DO UPDATE SET price_usd = EXCLUDED.price_usd`,
    )
    await ds.query(
      `INSERT INTO app.rwa_asset_metric_history (asset_id, date, price_usd)
       SELECT id, CURRENT_DATE - 1, 4300.000000000000 FROM app.rwa_assets WHERE slug = 't-gold'
       ON CONFLICT (asset_id, date) DO UPDATE SET price_usd = EXCLUDED.price_usd`,
    )
    const snapshotRun = await service.run('snapshot')
    expect(snapshotRun.status).toBe('success')

    const changes = (await ds.query(
      `SELECT m.change_24h_pct::text AS d1, m.change_7d_pct::text AS d7
       FROM app.rwa_asset_metrics m JOIN app.rwa_assets a ON a.id = m.asset_id WHERE a.slug = 't-gold'`,
    )) as Array<{ d1: string; d7: string }>
    expect(Number(changes[0].d7)).toBeCloseTo(9.53075, 2)
    expect(Number(changes[0].d1)).toBeCloseTo(1.88953, 2)
  })

  it('records sync runs and rejects concurrent runs via advisory lock', async () => {
    const locker = ds.createQueryRunner()
    await locker.connect()
    await locker.query('SELECT pg_advisory_lock($1)', [RWA_SYNC_LOCK_KEY])
    try {
      await expect(service.run('issuers')).rejects.toBeInstanceOf(ConflictException)
    } finally {
      await locker.query('SELECT pg_advisory_unlock($1)', [RWA_SYNC_LOCK_KEY])
      await locker.release()
    }

    const rejectedRuns = (await ds.query(
      `SELECT COUNT(*)::int AS count FROM app.rwa_sync_runs WHERE provider = 'fake'`,
    )) as Array<{ count: number }>
    expect(rejectedRuns[0].count).toBe(0)

    await service.run('issuers')
    const listed = await service.listRuns(10)
    const runs = (listed as { runs: Array<Record<string, unknown>> }).runs
    const fakeRuns = runs.filter((run) => run.provider === 'fake')
    expect(fakeRuns).toHaveLength(1)
    expect(fakeRuns[0]).toMatchObject({ kind: 'issuers', status: 'success', itemsUpserted: 2 })
  })
})
