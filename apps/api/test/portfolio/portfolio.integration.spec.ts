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

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('API-010 portfolio integration (PG)', () => {
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
    await ds.query(`DELETE FROM app.positions WHERE user_id = $1`, [USER])
    await ds.query(`TRUNCATE TABLE app.position_snapshots, app.redemptions RESTART IDENTITY CASCADE`)
  })

  it('listPositions does not turn a cash ledger balance into a position', async () => {
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
    expect(await svc.listPositions(USER)).toEqual([])
  })

  it('does not present expired or wrong-asset quotes as current position prices', async () => {
    const quotedProduct = '88888888-7777-4777-8777-777777777777'
    await ds.query(
      `INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
       VALUES ($1, 'ac_test_00000001', 1, 'Quote freshness test', 'USDT', 6, 'published', now())`,
      [quotedProduct],
    )
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
       VALUES ($1, $2, 'long', 'USDT', 6, 1000000, 1000000)`,
      [USER, quotedProduct],
    )
    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, captured_at, valid_until)
       VALUES (gen_random_uuid(), $1, 'USDT', 9000000, 'USD', 'expired-test', now() - interval '2 hours', now() - interval '1 hour')`,
      [quotedProduct],
    )
    const service = new PortfolioService(
      ds.getRepository(PositionSnapshot),
      ds.getRepository(Redemption),
      new LedgerService(ds),
      new CatalogService(
        ds.getRepository('AssetClass') as never,
        ds.getRepository('Product') as never,
        ds.getRepository('DisclosureFile') as never,
        ds.getRepository('PriceQuote') as never,
        ds.getRepository('PriceSnapshot') as never,
      ),
    )
    const listedPrice = async () => (await service.listPositions(USER)).find((position) => position.productId === quotedProduct)?.unitPriceAtomicAmount
    expect(await listedPrice()).toBe('0')

    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until)
       VALUES (gen_random_uuid(), $1, 'OTHER', 8000000, 'USD', 'wrong-asset-test', now() + interval '2 hours')`,
      [quotedProduct],
    )
    expect(await listedPrice()).toBe('0')

    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until)
       VALUES (gen_random_uuid(), $1, 'USDT', 2000000, 'USD', 'fresh-test', now() + interval '1 hour')`,
      [quotedProduct],
    )
    expect(await listedPrice()).toBe('2000000')
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
    // Holdings come from app.positions; a cash ledger balance alone is not a position (cefb57a).
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
       VALUES ($1, $2, 'long', 'USDT', 6, 1000000, 1000000)`,
      [USER, PRODUCT],
    )
    const snap = await svc.captureSnapshot(USER, PRODUCT)
    expect(snap.source).toBe('snapshot')
    expect(snap.quantityAtomicAmount).toBe('1000000')
    const [{ snapshot_batch_id }] = await ds.query(
      `SELECT snapshot_batch_id FROM app.position_snapshots WHERE user_id = $1 AND product_id = $2 ORDER BY captured_at DESC LIMIT 1`,
      [USER, PRODUCT],
    )
    expect(snapshot_batch_id).toBeNull()

    const history = await svc.history(USER, PRODUCT)
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].totalValueAtomicAmount).toBe('100')
    expect(history[0].currencyDecimals).toBe(6)
    expect(await svc.history(USER)).toEqual([])
  })

  it('does not persist a single-product snapshot for a zero position', async () => {
    await ds.query(
      `UPDATE app.ledger_account_balances b
          SET current_atomic_balance = 0
         FROM app.ledger_accounts a
        WHERE b.account_id = a.id AND a.user_id = $1 AND a.purpose = 'available'`,
      [USER],
    )
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass' as never) as never,
      ds.getRepository('Product' as never) as never,
      ds.getRepository('DisclosureFile' as never) as never,
      ds.getRepository('PriceQuote' as never) as never,
      ds.getRepository('PriceSnapshot' as never) as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)

    await expect(svc.captureSnapshot(USER, PRODUCT)).rejects.toMatchObject({
      status: 409,
      response: { code: 'PORTFOLIO_POSITION_EMPTY' },
    })
    const [{ count }] = await ds.query(`SELECT COUNT(*)::int AS count FROM app.position_snapshots WHERE user_id = $1`, [USER])
    expect(count).toBe(0)
  })

  it('captures all market values in one atomic portfolio snapshot batch', async () => {
    const secondProduct = '99999999-8888-8888-8888-888888888888'
    await ds.query(
      `INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
       VALUES ($1, 'ac_test_00000001', 1, 'Two decimal asset', 'RWA2', 2, 'published', now())`,
      [secondProduct],
    )
    await ds.query(
      `INSERT INTO app.price_quotes (id, product_id, asset_code, unit_price_atomic_amount, unit_price_decimals, currency, source, valid_until)
       VALUES (gen_random_uuid(), $1, 'RWA2', 12345, 4, 'USDT', 'seed', now() + interval '1 hour')`,
      [secondProduct],
    )
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
       VALUES ($1, $2, 'long', 'USDT', 6, 1000000, 100000), ($1, $3, 'long', 'RWA2', 2, 200, 2000000)`,
      [USER, PRODUCT, secondProduct],
    )
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass' as never) as never,
      ds.getRepository('Product' as never) as never,
      ds.getRepository('DisclosureFile' as never) as never,
      ds.getRepository('PriceQuote' as never) as never,
      ds.getRepository('PriceSnapshot' as never) as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)

    const batchId = '88888888-5555-5555-8555-555555555555'
    const batch = await svc.capturePortfolioSnapshot(USER, batchId)
    const retry = await svc.capturePortfolioSnapshot(USER, batchId)
    expect(retry.snapshotBatchId).toBe(batch.snapshotBatchId)
    expect(retry.snapshotCount).toBe(batch.snapshotCount)
    expect(batch.snapshotCount).toBe(2)
    const [{ batch_count, distinct_captured_at }] = await ds.query(
      `SELECT COUNT(*)::int AS batch_count, COUNT(DISTINCT captured_at)::int AS distinct_captured_at
         FROM app.position_snapshots WHERE user_id = $1 AND snapshot_batch_id = $2`,
      [USER, batch.snapshotBatchId],
    )
    expect(batch_count).toBe(2)
    expect(distinct_captured_at).toBe(1)
    expect(retry.capturedAt).toEqual(batch.capturedAt)
    const [history] = await svc.history(USER)
    expect(history.totalValueAtomicAmount).toBe('2469100')
    expect(history.currency).toBe('USDT')
    expect(history.currencyDecimals).toBe(6)
  })

  it('does not persist a portfolio snapshot when a holding changes during price loading', async () => {
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
       VALUES ($1, $2, 'long', 'USDT', 6, 1000000, 1000000)`,
      [USER, PRODUCT],
    )
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass' as never) as never,
      ds.getRepository('Product' as never) as never,
      ds.getRepository('DisclosureFile' as never) as never,
      ds.getRepository('PriceQuote' as never) as never,
      ds.getRepository('PriceSnapshot' as never) as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)
    const readQuote = catalog.getLatestQuote.bind(catalog)
    jest.spyOn(catalog, 'getLatestQuote').mockImplementation(async (productId: string) => {
      const quote = await readQuote(productId)
      await ds.query(
        `UPDATE app.positions SET quantity_atomic_amount = quantity_atomic_amount + 1
          WHERE user_id = $1 AND product_id = $2 AND outcome_key = 'long'`,
        [USER, PRODUCT],
      )
      return quote
    })

    await expect(svc.capturePortfolioSnapshot(USER)).rejects.toMatchObject({
      status: 409,
      response: { code: 'PORTFOLIO_POSITIONS_CHANGED' },
    })
    const [{ count }] = await ds.query(
      `SELECT COUNT(*)::int AS count FROM app.position_snapshots WHERE user_id = $1 AND snapshot_batch_id IS NOT NULL`,
      [USER],
    )
    expect(count).toBe(0)
  })

  it('history calculates snapshot market value and normalizes quote scales before aggregation', async () => {
    const secondProduct = '88888888-8888-8888-8888-888888888888'
    const capturedAt = new Date('2026-09-25T12:00:00.000Z')
    await ds.query(
      `INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
       VALUES ($1, 'ac_test_00000001', 1, 'Two decimal asset', 'RWA2', 2, 'published', now())`,
      [secondProduct],
    )
    await ds.query(
      `INSERT INTO app.position_snapshots
         (user_id, snapshot_batch_id, product_id, asset_code, asset_decimals, quantity_atomic_amount,
          unit_price_atomic_amount, unit_price_decimals, currency, valued_at, captured_at)
       VALUES
         ($1, $2, $3, 'USDT', 6, 1000000, 123, 2, 'USD', $4, $4),
         ($1, $2, $5, 'RWA2', 2, 200, 12345, 4, 'USDT', $4, $4)`,
      [USER, 'aaaaaaaa-8888-8888-8888-888888888888', PRODUCT, capturedAt, secondProduct],
    )
    ledger = new LedgerService(ds)
    catalog = new CatalogService(
      ds.getRepository('AssetClass' as never) as never,
      ds.getRepository('Product' as never) as never,
      ds.getRepository('DisclosureFile' as never) as never,
      ds.getRepository('PriceQuote' as never) as never,
      ds.getRepository('PriceSnapshot' as never) as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), ledger, catalog)

    const [point] = await svc.history(USER)
    expect(point.currency).toBe('USDT')
    expect(point.currencyDecimals).toBe(6)
    // $1.23 (123 cents) + $2.4690 (24690 ten-thousandths) = $3.6990.
    expect(point.totalValueAtomicAmount).toBe('3699000')
  })

  it('does not include legacy snapshots without a persisted quote scale', async () => {
    await ds.query(
      `INSERT INTO app.position_snapshots
         (user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount,
          unit_price_atomic_amount, unit_price_decimals, currency, valued_at, captured_at)
       VALUES ($1, $2, 'USDT', 6, 1000000, 123, NULL, 'USD', now(), now())`,
      [USER, PRODUCT],
    )
    const history = await svc.history(USER)
    expect(history).toEqual([])
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
    // Redemption requires a product position; a cash ledger balance is not a holding.
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount)
       VALUES ($1, $2, 'USDT', 6, 1000)
       ON CONFLICT (user_id, product_id, outcome_key) DO UPDATE SET quantity_atomic_amount = 1000, state = 'active'`,
      [USER, PRODUCT],
    )
    await ds.query(`UPDATE app.price_quotes SET unit_price_atomic_amount = 1000000 WHERE product_id = $1`, [PRODUCT])
    const r = await svc.requestRedemption({
      user_id: USER,
      product_id: PRODUCT,
      quantity_atomic_amount: '500',
      request_id: 'req-int-1',
    })
    expect(r.state).toBe('requested')
    const intent = { user_id: USER, product_id: PRODUCT, quantity_atomic_amount: '500', request_id: 'req-int-1' }
    const replays = await Promise.all([svc.requestRedemption(intent), svc.requestRedemption(intent)])
    expect(replays.map((item) => item.id)).toEqual([r.id, r.id])
    await expect(svc.requestRedemption({ ...intent, quantity_atomic_amount: '501' })).rejects.toMatchObject({ status: 409 })
    const competing = await Promise.allSettled([
      svc.requestRedemption({ ...intent, request_id: 'competing-a', quantity_atomic_amount: '400' }),
      svc.requestRedemption({ ...intent, request_id: 'competing-b', quantity_atomic_amount: '400' }),
    ])
    expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(competing.filter((result) => result.status === 'rejected')).toHaveLength(1)


    const canceled = await svc.cancelRedemption(r.id, USER)
    expect(canceled.state).toBe('canceled')
    // Only the winning 400-unit request remains reserved; canceled units are reusable.
    const replacement = await svc.requestRedemption({ ...intent, request_id: 'after-cancel', quantity_atomic_amount: '600' })
    expect(replacement.quantityAtomicAmount).toBe('600')
    await expect(svc.requestRedemption({ ...intent, request_id: 'after-full-reservation', quantity_atomic_amount: '1' }))
      .rejects.toMatchObject({ status: 409 })
  })

  async function seedLongHolding() {
    const catalog = new CatalogService(
      ds.getRepository('AssetClass') as never, ds.getRepository('Product') as never,
      ds.getRepository('DisclosureFile') as never, ds.getRepository('PriceQuote') as never,
      ds.getRepository('PriceSnapshot') as never,
    )
    svc = new PortfolioService(ds.getRepository(PositionSnapshot), ds.getRepository(Redemption), new LedgerService(ds), catalog)
    await ds.query(
      `INSERT INTO app.positions (user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount)
       VALUES ($1, $2, 'USDT', 6, 1000)`, [USER, PRODUCT],
    )
    await ds.query(`UPDATE app.price_quotes SET unit_price_atomic_amount = 1000000 WHERE product_id = $1`, [PRODUCT])
  }

  it('serializes concurrent first submissions of one request ID into one database record', async () => {
    await seedLongHolding()
    const intent = { user_id: USER, product_id: PRODUCT, quantity_atomic_amount: '700', request_id: 'concurrent-new-key' }
    const results = await Promise.all([svc.requestRedemption(intent), svc.requestRedemption(intent)])
    expect(results[0].id).toBe(results[1].id)
    const [{ count }] = await ds.query(`SELECT COUNT(*)::int AS count FROM app.redemptions WHERE request_id = $1`, [intent.request_id])
    expect(count).toBe(1)
    const [{ reserved }] = await ds.query(
      `SELECT SUM(quantity_atomic_amount)::text AS reserved FROM app.redemptions WHERE user_id = $1`, [USER],
    )
    expect(reserved).toBe('700')
  })

  it('waits for an in-flight completion row lock and cannot cancel the committed completed state', async () => {
    await seedLongHolding()
    const redemption = await svc.requestRedemption({ user_id: USER, product_id: PRODUCT, quantity_atomic_amount: '500', request_id: 'cancel-complete-race' })
    const completing = ds.createQueryRunner()
    await completing.connect()
    await completing.startTransaction()
    let cancellation: Promise<{ result?: unknown; error?: unknown }> | undefined
    try {
      const [{ pid }] = await completing.query(`SELECT pg_backend_pid() AS pid`)
      await completing.query(`SELECT id FROM app.redemptions WHERE id = $1 FOR UPDATE`, [redemption.id])
      await completing.query(`UPDATE app.redemptions SET state = 'completed', executed_at = now() WHERE id = $1`, [redemption.id])
      let settled = false
      cancellation = svc.cancelRedemption(redemption.id, USER).then(
        (result) => { settled = true; return { result } },
        (error: unknown) => { settled = true; return { error } },
      )
      // Observe the actual PostgreSQL waiter instead of relying on a timing-only assertion.
      let blocked = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const [{ waiting }] = await ds.query(
          `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))) AS waiting`, [pid],
        )
        if (waiting) { blocked = true; break }
        if (settled) break
        await ds.query(`SELECT pg_sleep(0.02)`)
      }
      expect(blocked).toBe(true)
      expect(settled).toBe(false)
      await completing.commitTransaction()
      const outcome = await cancellation
      expect(outcome.error).toMatchObject({ status: 409, response: { code: 'PORTFOLIO_REDEMPTION_STATE_INVALID' } })
      const [{ state, canceled_at, executed_at }] = await ds.query(
        `SELECT state, canceled_at, executed_at FROM app.redemptions WHERE id = $1`, [redemption.id],
      )
      expect(state).toBe('completed')
      expect(canceled_at).toBeNull()
      expect(executed_at).not.toBeNull()
    } finally {
      if (completing.isTransactionActive) await completing.rollbackTransaction()
      await completing.release()
      if (cancellation) await cancellation
    }
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
