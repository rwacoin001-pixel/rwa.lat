import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { CoinMarketCapClient } from '../../src/rwa-market/providers/coinmarketcap/coinmarketcap.client'
import { CoinMarketCapRwaProvider } from '../../src/rwa-market/providers/coinmarketcap/coinmarketcap.provider'
import { RwaMarketSyncService } from '../../src/rwa-market/rwa-market.sync.service'

/**
 * 实弹冒烟：真实 CMC RWA API → 测试库（env 门控：CMC_API_KEY + RWA_LIVE_SYNC=1）
 * 目的：证明 Provider → Normalize → Sync → DB 全链在真实数据上闭合。
 */
const enabled =
  !!process.env.TEST_DATABASE_URL && !!process.env.CMC_API_KEY && process.env.RWA_LIVE_SYNC === '1'
const describeLive = enabled ? describe : describe.skip

describeLive('rwa market live CMC sync (integration)', () => {
  let ds: DataSource
  let service: RwaMarketSyncService

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    service = new RwaMarketSyncService(new CoinMarketCapRwaProvider(new CoinMarketCapClient()), ds)
  })

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy()
  })

  it('syncs real issuers, assets, metrics and snapshot from CoinMarketCap', async () => {
    const issuers = await service.run('issuers')
    expect(issuers.status).toBe('success')
    expect(issuers.itemsUpserted).toBeGreaterThanOrEqual(20)

    const assets = await service.run('assets', { maxItems: 40 })
    expect(assets.status).toBe('success')
    expect(assets.itemsUpserted).toBeGreaterThanOrEqual(30)

    const metrics = await service.run('metrics', { maxItems: 40 })
    expect(metrics.status).toBe('success')
    expect(metrics.itemsUpserted).toBeGreaterThanOrEqual(20)

    await service.run('snapshot')

    const gold = (await ds.query(
      `SELECT a.slug, a.asset_class, a.is_tokenized, i.name AS issuer_name,
              trim_scale(m.price_usd)::text AS price
       FROM app.rwa_assets a
       LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id
       WHERE a.slug = 'gold'`,
    )) as Array<Record<string, unknown>>
    expect(gold).toHaveLength(1)
    expect(gold[0].asset_class).toBe('commodity')
    expect(gold[0].issuer_name).toBeTruthy()
    expect(Number(gold[0].price)).toBeGreaterThan(0)

    const totals = (await ds.query(
      `SELECT COUNT(*)::int AS assets,
              COUNT(*) FILTER (WHERE m.price_usd IS NOT NULL)::int AS priced
       FROM app.rwa_assets a LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = a.id`,
    )) as Array<{ assets: number; priced: number }>
    expect(totals[0].assets).toBeGreaterThanOrEqual(40)
    expect(totals[0].priced).toBeGreaterThanOrEqual(20)
  }, 300_000)
})
