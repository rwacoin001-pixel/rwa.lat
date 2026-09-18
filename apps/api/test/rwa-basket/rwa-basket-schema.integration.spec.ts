import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('rwa basket schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  it('creates the 22 rwa/basket tables', async () => {
    const rows = (await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'app'
       AND (tablename LIKE 'rwa_%' OR tablename LIKE 'basket_%'
            OR tablename IN ('risk_disclosures', 'user_risk_acknowledgements'))
       ORDER BY tablename`,
    )) as Array<{ tablename: string }>
    const names = rows.map((row) => row.tablename)
    const expected = [
      'rwa_assets',
      'rwa_issuers',
      'rwa_networks',
      'rwa_asset_contracts',
      'rwa_asset_sources',
      'rwa_asset_metrics',
      'rwa_asset_metric_history',
      'rwa_sync_runs',
      'rwa_asset_scores',
      'rwa_ai_analysis',
      'basket_strategies',
      'basket_strategy_versions',
      'basket_strategy_assets',
      'basket_portfolios',
      'basket_holdings',
      'basket_nav_snapshots',
      'basket_subscriptions',
      'basket_redemptions',
      'basket_rebalance_runs',
      'basket_rebalance_orders',
      'risk_disclosures',
      'user_risk_acknowledgements',
    ]
    for (const name of expected) expect(names).toContain(name)
    expect(names).toHaveLength(22)
  })

  it('enforces asset class check, contract uniqueness and single metric row per asset', async () => {
    const [issuer] = (await dataSource.query(
      `INSERT INTO app.rwa_issuers (id, name, slug) VALUES ($1, 'Backed', 'backed-test') RETURNING id`,
      [randomUUID()],
    )) as Array<{ id: string }>
    const [network] = (await dataSource.query(
      `INSERT INTO app.rwa_networks (id, name, slug) VALUES ($1, 'Ethereum', 'ethereum-test') RETURNING id`,
      [randomUUID()],
    )) as Array<{ id: string }>
    const [asset] = (await dataSource.query(
      `INSERT INTO app.rwa_assets (id, slug, name, asset_class, issuer_id)
       VALUES ($1, 'buidl-test', 'BUIDL', 'treasury', $2) RETURNING id`,
      [randomUUID(), issuer.id],
    )) as Array<{ id: string }>

    await expect(
      dataSource.query(`INSERT INTO app.rwa_assets (id, slug, name, asset_class) VALUES ($1, 'bad-class', 'X', 'bogus')`, [randomUUID()]),
    ).rejects.toMatchObject({ code: '23514' })

    await dataSource.query(
      `INSERT INTO app.rwa_asset_contracts (id, asset_id, network_id, contract_address, transfer_restricted)
       VALUES ($1, $2, $3, '0xabc', true)`,
      [randomUUID(), asset.id, network.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.rwa_asset_contracts (id, asset_id, network_id, contract_address)
         VALUES ($1, $2, $3, '0xabc')`,
        [randomUUID(), asset.id, network.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })

    await dataSource.query(`INSERT INTO app.rwa_asset_metrics (id, asset_id, price_usd) VALUES ($1, $2, 1.23)`, [randomUUID(), asset.id])
    await expect(
      dataSource.query(`INSERT INTO app.rwa_asset_metrics (id, asset_id) VALUES ($1, $2)`, [randomUUID(), asset.id]),
    ).rejects.toMatchObject({ code: '23505' })

    await dataSource.query(
      `INSERT INTO app.rwa_asset_metric_history (id, asset_id, date, price_usd)
       VALUES ($1, $2, '2026-09-18', 1.23)`,
      [randomUUID(), asset.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.rwa_asset_metric_history (id, asset_id, date) VALUES ($1, $2, '2026-09-18')`,
        [randomUUID(), asset.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('validates strategy → version → portfolio → holding → nav chain with numeric(36,18)', async () => {
    const [asset] = (await dataSource.query(`SELECT id FROM app.rwa_assets LIMIT 1`)) as Array<{ id: string }>
    const [strategy] = (await dataSource.query(
      `INSERT INTO app.basket_strategies (id, slug, name) VALUES ($1, 'ai-rwa-core-test', 'AI RWA Core') RETURNING id`,
      [randomUUID()],
    )) as Array<{ id: string }>
    const [version] = (await dataSource.query(
      `INSERT INTO app.basket_strategy_versions (id, strategy_id, version) VALUES ($1, $2, 1) RETURNING id`,
      [randomUUID(), strategy.id],
    )) as Array<{ id: string }>
    await expect(
      dataSource.query(`INSERT INTO app.basket_strategy_versions (id, strategy_id, version) VALUES ($1, $2, 1)`, [randomUUID(), strategy.id]),
    ).rejects.toMatchObject({ code: '23505' })

    await dataSource.query(
      `INSERT INTO app.basket_strategy_assets (id, strategy_version_id, asset_id, target_weight_pct) VALUES ($1, $2, $3, 15.0)`,
      [randomUUID(), version.id, asset.id],
    )
    const [portfolio] = (await dataSource.query(
      `INSERT INTO app.basket_portfolios (id, strategy_id, strategy_version_id, name)
       VALUES ($1, $2, $3, 'Core Portfolio') RETURNING id`,
      [randomUUID(), strategy.id, version.id],
    )) as Array<{ id: string }>
    await dataSource.query(
      `INSERT INTO app.basket_holdings (id, portfolio_id, asset_id, quantity) VALUES ($1, $2, $3, 100)`,
      [randomUUID(), portfolio.id, asset.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.basket_holdings (id, portfolio_id, asset_id, quantity) VALUES ($1, $2, $3, 50)`,
        [randomUUID(), portfolio.id, asset.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })

    await dataSource.query(
      `INSERT INTO app.basket_nav_snapshots (id, portfolio_id, net_asset_value_usd, total_units, nav_per_unit)
       VALUES ($1, $2, 1050, 1000, 1.05)`,
      [randomUUID(), portfolio.id],
    )
    const [nav] = (await dataSource.query(
      `SELECT nav_per_unit FROM app.basket_nav_snapshots WHERE portfolio_id = $1`,
      [portfolio.id],
    )) as Array<{ nav_per_unit: string }>
    expect(nav.nav_per_unit).toBe('1.050000000000000000')
  })

  it('basket subscriptions tie to users with idempotency key uniqueness', async () => {
    const [user] = (await dataSource.query(`INSERT INTO app.users (id) VALUES ($1) RETURNING id`, [randomUUID()])) as Array<{ id: string }>
    const [portfolio] = (await dataSource.query(`SELECT id FROM app.basket_portfolios LIMIT 1`)) as Array<{ id: string }>

    await dataSource.query(
      `INSERT INTO app.basket_subscriptions (id, user_id, portfolio_id, amount_usd, idempotency_key)
       VALUES ($1, $2, $3, 1000, 'idem-sub-1')`,
      [randomUUID(), user.id, portfolio.id],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.basket_subscriptions (id, user_id, portfolio_id, amount_usd, idempotency_key)
         VALUES ($1, $2, $3, 500, 'idem-sub-1')`,
        [randomUUID(), user.id, portfolio.id],
      ),
    ).rejects.toMatchObject({ code: '23505' })

    await dataSource.query(
      `INSERT INTO app.risk_disclosures (id, version, title, content) VALUES ($1, 1, '风险披露 v1', '...')`,
      [randomUUID()],
    )
    const [disclosure] = (await dataSource.query(`SELECT id, version FROM app.risk_disclosures LIMIT 1`)) as Array<{ id: string; version: number }>
    await dataSource.query(
      `INSERT INTO app.user_risk_acknowledgements (id, user_id, disclosure_id, version) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), user.id, disclosure.id, disclosure.version],
    )
    await expect(
      dataSource.query(
        `INSERT INTO app.user_risk_acknowledgements (id, user_id, disclosure_id, version) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), user.id, disclosure.id, disclosure.version],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
