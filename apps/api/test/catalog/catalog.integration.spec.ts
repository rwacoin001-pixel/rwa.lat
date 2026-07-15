import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AssetClass } from '../../src/catalog/asset-class.entity'
import { Product } from '../../src/catalog/product.entity'
import { DisclosureFile } from '../../src/catalog/disclosure-file.entity'
import { PriceQuote, PriceSnapshot } from '../../src/catalog/price.entity'
import { CatalogService } from '../../src/catalog/catalog.service'
import { CatalogError, CATALOG_ERROR_CODES } from '../../src/catalog/catalog.errors'

describe('CatalogModule (PG integration)', () => {
  let dataSource: DataSource
  let catalog: CatalogService

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    // 测试隔离：每次完整重建（含 app schema 与 schema_migrations 记录），
    // 避免 DROP SCHEMA 后 TypeORM 误判 DB-001 已应用而跳过 CREATE SCHEMA。
    await dataSource.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await dataSource.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await dataSource.runMigrations({ transaction: 'all' })
  }, 120000)

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  beforeEach(async () => {
    // 每个用例清空 catalog 相关表
    await dataSource.query(
      `TRUNCATE app.price_snapshots, app.price_quotes, app.disclosure_files, app.products, app.asset_classes RESTART IDENTITY CASCADE`,
    )
  })

  it('creates asset class and product, returns published quote before expiration', async () => {
    const assetClassRepo = dataSource.getRepository(AssetClass)
    const productRepo = dataSource.getRepository(Product)
    const quoteRepo = dataSource.getRepository(PriceQuote)

    await assetClassRepo.save(assetClassRepo.create({ id: 'rwa', display_name: 'RWA', state: 'active' }))
    const product = await productRepo.save(
      productRepo.create({
        asset_class_id: 'rwa',
        display_name: 'US Treasury Token',
        asset_code: 'USTB',
        asset_decimals: 6,
        state: 'published',
        published_at: new Date(),
      }),
    )
    await quoteRepo.save(
      quoteRepo.create({
        product_id: product.id,
        asset_code: 'USTB',
        unit_price_atomic_amount: '1010000',
        currency: 'USD',
        source: 'seed',
        valid_until: new Date(Date.now() + 60000),
      }),
    )

    catalog = new CatalogService(
      assetClassRepo as any,
      productRepo as any,
      dataSource.getRepository(DisclosureFile) as any,
      quoteRepo as any,
      dataSource.getRepository(PriceSnapshot) as any,
    )

    const quote = await catalog.requireOrderableQuote(product.id, new Date())
    expect(quote.stale).toBe(false)
    expect(quote.unitPriceAtomicAmount).toBe('1010000')
  })

  it('requireOrderableQuote throws QUOTE_STALE after expiration', async () => {
    const assetClassRepo = dataSource.getRepository(AssetClass)
    const productRepo = dataSource.getRepository(Product)
    const quoteRepo = dataSource.getRepository(PriceQuote)

    await assetClassRepo.save(assetClassRepo.create({ id: 'rwa', display_name: 'RWA', state: 'active' }))
    const product = await productRepo.save(
      productRepo.create({
        asset_class_id: 'rwa',
        display_name: 'US Treasury Token',
        asset_code: 'USTB',
        asset_decimals: 6,
        state: 'published',
        published_at: new Date(),
      }),
    )
    await quoteRepo.save(
      quoteRepo.create({
        product_id: product.id,
        asset_code: 'USTB',
        unit_price_atomic_amount: '1010000',
        currency: 'USD',
        source: 'seed',
        valid_until: new Date(Date.now() - 1000),
        captured_at: new Date(Date.now() - 5000),
      }),
    )

    catalog = new CatalogService(
      assetClassRepo as any,
      productRepo as any,
      dataSource.getRepository(DisclosureFile) as any,
      quoteRepo as any,
      dataSource.getRepository(PriceSnapshot) as any,
    )

    await expect(catalog.requireOrderableQuote(product.id, new Date())).rejects.toMatchObject({
      code: CATALOG_ERROR_CODES.QUOTE_STALE,
    })
  })

  it('listDisclosures returns only active disclosures for product', async () => {
    const assetClassRepo = dataSource.getRepository(AssetClass)
    const productRepo = dataSource.getRepository(Product)
    const discRepo = dataSource.getRepository(DisclosureFile)

    await assetClassRepo.save(assetClassRepo.create({ id: 'rwa', display_name: 'RWA', state: 'active' }))
    const product = await productRepo.save(
      productRepo.create({
        asset_class_id: 'rwa',
        display_name: 'US Treasury Token',
        asset_code: 'USTB',
        asset_decimals: 6,
        state: 'published',
        published_at: new Date(),
      }),
    )
    await discRepo.save(
      discRepo.create({
        product_id: product.id,
        kind: 'prospectus',
        locale: 'en',
        title: 'Prospectus',
        storage_ref: 's3://x',
        content_hash: Buffer.from('abc'),
        state: 'active',
      }),
    )

    catalog = new CatalogService(
      dataSource.getRepository(AssetClass) as any,
      productRepo as any,
      discRepo as any,
      dataSource.getRepository(PriceQuote) as any,
      dataSource.getRepository(PriceSnapshot) as any,
    )
    const disclosures = await catalog.listDisclosures(product.id)
    expect(disclosures).toHaveLength(1)
    expect(disclosures[0].title).toBe('Prospectus')
  })
})
