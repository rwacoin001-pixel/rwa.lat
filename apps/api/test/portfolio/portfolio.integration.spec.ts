import { DataSource, type EntitySchema } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { PositionSnapshot } from '../../src/portfolio/portfolio.entities'
import { Redemption } from '../../src/portfolio/portfolio.entities'
import { PortfolioService } from '../../src/portfolio/portfolio.service'
import { LedgerService } from '../../src/ledger/ledger.service'
import { CatalogService } from '../../src/catalog/catalog.service'
import { PortfolioError } from '../../src/portfolio/portfolio.errors'

const USER = '66666666-6666-6666-6666-666666666666'
const PRODUCT = '77777777-7777-7777-7777-777777777777'

describe('API-010 portfolio integration (PG)', () => {
  let ds: DataSource
  let svc: PortfolioService
  let ledger: LedgerService
  let catalog: CatalogService

  beforeAll(async () => {
    const opts = buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })
    const configuredEntities = (opts.entities ?? []) as Array<string | Function | EntitySchema>
    ds = new DataSource({ ...opts, entities: [...configuredEntities, PositionSnapshot, Redemption] })
    await ds.initialize()
    await ds.query(`DROP SCHEMA IF EXISTS app CASCADE`)
    await ds.query(`DROP TABLE IF EXISTS public.schema_migrations`)
    await ds.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy()
  })

  beforeEach(async () => {
    await ds.query(
      `INSERT INTO app.users (id, status, locale, created_at, updated_at)
       VALUES ($1, 'active', 'en', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await ds.query(
      `INSERT INTO app.asset_classes (id, display_name, state, created_at)
       VALUES ('ac_test_00000001', 'Test AC', 'active', now())
       ON CONFLICT (id) DO NOTHING`,
    )
    await ds.query(
      `INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
       VALUES ($1, 'ac_test_00000001', 1, 'Test RWA', 'USDT', 6, 'published', now())
       ON CONFLICT (id) DO NOTHING`,
      [PRODUCT],
    )
    await ds.query(
      `INSERT INTO app.ledger_accounts (id, owner_type, user_id, purpose, asset_code, asset_decimals, normal_side, state)
       VALUES ('aaaaaaaa-6666-6666-6666-666666666666', 'user', $1, 'available', 'USDT', 6, 'debit', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [USER],
    )
    await ds.query(
      `INSERT INTO app.ledger_account_balances (account_id, current_atomic_balance)
       VALUES ('aaaaaaaa-6666-6666-6666-666666666666', 1000000) ON CONFLICT (account_id) DO UPDATE SET current_atomic_balance = 1000000`,
    )
    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until)
       VALUES (gen_random_uuid(), $1, 'USDT', 100, 'USD', 'seed', now() + interval '1 hour')`,
      [PRODUCT],
    )
    await ds.query(`TRUNCATE TABLE app.position_snapshots, app.redemptions RESTART IDENTITY CASCADE`)
  })

  it('listPositions returns ledger-projected balance', async () => {
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass' as never) as never,
      ds.getRepository('Product' as never) as never,
      ds.getRepository('DisclosureFile' as never) as never,
      ds.getRepository('PriceQuote' as never) as never,
      ds.getRepository('PriceSnapshot' as never) as never,
    )
    svc = new PortfolioService(
      ds.getRepository(PositionSnapshot),
      ds.getRepository(Redemption),
      ledger,
      catalog,
    )
    const positions = await svc.listPositions(USER)
    expect(positions.length).toBeGreaterThanOrEqual(1)
    expect(positions[0].source).toBe('immutable-ledger-projection')
  })

  it('captureSnapshot persists a position snapshot', async () => {
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass') as never,
      ds.getRepository('Product') as never,
      ds.getRepository('DisclosureFile') as never,
      ds.getRepository('PriceQuote') as never,
      ds.getRepository('PriceSnapshot') as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)
    const snap = await svc.captureSnapshot(USER, PRODUCT)
    expect(snap.source).toBe('snapshot')
    expect(snap.quantityAtomicAmount).toBe('1000000')

    const history = await svc.history(USER, PRODUCT)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(BigInt(history[0].totalValueAtomicAmount)).toBe(BigInt(100) * BigInt(1000000))
  })

  it('requestRedemption -> cancel lifecycle', async () => {
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass') as never,
      ds.getRepository('Product') as never,
      ds.getRepository('DisclosureFile') as never,
      ds.getRepository('PriceQuote') as never,
      ds.getRepository('PriceSnapshot') as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)
    const r = await svc.requestRedemption({
      user_id: USER,
      product_id: PRODUCT,
      quantity_atomic_amount: '500',
      request_id: 'req-int-1',
    })
    expect(r.state).toBe('requested')

    const canceled = await svc.cancelRedemption(r.id, USER)
    expect(canceled.state).toBe('canceled')
  })

  it('requestRedemption unknown product throws', async () => {
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass') as never,
      ds.getRepository('Product') as never,
      ds.getRepository('DisclosureFile') as never,
      ds.getRepository('PriceQuote') as never,
      ds.getRepository('PriceSnapshot') as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)
    await expect(
      svc.requestRedemption({ user_id: USER, product_id: 'deadbeef-dead-dead-dead-deaddeaddead', quantity_atomic_amount: '1', request_id: 'req-int-2' }),
    ).rejects.toBeInstanceOf(PortfolioError)
  })
})
