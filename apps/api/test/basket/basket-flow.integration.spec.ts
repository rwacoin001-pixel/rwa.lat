import { ConflictException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { LedgerService } from '../../src/ledger/ledger.service'
import { OperationalCapabilityService } from '../../src/operations/operational-capability.service'
import { ScoringService } from '../../src/rwa-analysis/scoring.service'
import { BasketNavService } from '../../src/basket/basket.nav.service'
import { BasketOpsWorker } from '../../src/basket/basket.ops.worker'
import { PaperExecutionAdapter } from '../../src/basket/execution/basket-execution.adapter'
import { BasketPortfolioService } from '../../src/basket/portfolio.service'
import { BasketRebalanceService } from '../../src/basket/rebalance.service'
import { BasketReconciliationService } from '../../src/basket/reconciliation.service'
import { BasketRiskService } from '../../src/basket/risk.service'
import { BasketStrategyService } from '../../src/basket/strategy.service'
import { BasketSubscriptionService } from '../../src/basket/subscription.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

/** 测试环境放行所有开关（生产由 Render env + operational_switches 行控制，默认关闭） */
const allowAll = { assertEnabled: async () => undefined, isEnabled: async () => true } as unknown as OperationalCapabilityService

const STRATEGY_SLUG = 't5-core'

describeDatabase('basket full flow (phase 8-15 acceptance)', () => {
  let ds: DataSource
  let ledger: LedgerService
  let strategies: BasketStrategyService
  let portfolios: BasketPortfolioService
  let nav: BasketNavService
  let risk: BasketRiskService
  let subscriptions: BasketSubscriptionService
  let rebalance: BasketRebalanceService
  let reconciliation: BasketReconciliationService
  let scoring: ScoringService
  let userId: string
  let userAccountId: string
  let portfolioId: string
  let strategyId: string

  const cleanup = async () => {
    const portfolioIds = `(SELECT id FROM app.basket_portfolios WHERE name LIKE 'T5 %')`
    await ds.query(`DELETE FROM app.reconciliation_cases WHERE reconciliation_run_id IN (SELECT id FROM app.reconciliation_runs WHERE provider = 'basket')`)
    await ds.query(`DELETE FROM app.reconciliation_runs WHERE provider = 'basket'`)
    await ds.query(`DELETE FROM app.basket_rebalance_orders WHERE rebalance_run_id IN (SELECT id FROM app.basket_rebalance_runs WHERE portfolio_id IN ${portfolioIds})`)
    await ds.query(`DELETE FROM app.basket_rebalance_runs WHERE portfolio_id IN ${portfolioIds}`)
    await ds.query(`DELETE FROM app.basket_nav_snapshots WHERE portfolio_id IN ${portfolioIds}`)
    await ds.query(`DELETE FROM app.basket_holdings WHERE portfolio_id IN ${portfolioIds}`)
    await ds.query(`DELETE FROM app.basket_redemptions WHERE portfolio_id IN ${portfolioIds}`)
    await ds.query(`DELETE FROM app.basket_subscriptions WHERE portfolio_id IN ${portfolioIds}`)
    await ds.query(`DELETE FROM app.basket_portfolios WHERE name LIKE 'T5 %'`)
    await ds.query(`DELETE FROM app.user_risk_acknowledgements WHERE disclosure_id IN (SELECT id FROM app.risk_disclosures WHERE strategy_id IN (SELECT id FROM app.basket_strategies WHERE slug = $1))`, [STRATEGY_SLUG])
    await ds.query(`DELETE FROM app.user_risk_acknowledgements WHERE disclosure_id IN (SELECT id FROM app.risk_disclosures WHERE strategy_id IS NULL AND title LIKE 'T5%')`)
    await ds.query(`DELETE FROM app.risk_disclosures WHERE strategy_id IN (SELECT id FROM app.basket_strategies WHERE slug = $1)`, [STRATEGY_SLUG])
    await ds.query(`DELETE FROM app.risk_disclosures WHERE strategy_id IS NULL AND title LIKE 'T5%'`)
    await ds.query(`DELETE FROM app.basket_strategy_assets WHERE strategy_version_id IN (SELECT id FROM app.basket_strategy_versions WHERE strategy_id IN (SELECT id FROM app.basket_strategies WHERE slug = $1))`, [STRATEGY_SLUG])
    await ds.query(`DELETE FROM app.basket_strategy_versions WHERE strategy_id IN (SELECT id FROM app.basket_strategies WHERE slug = $1)`, [STRATEGY_SLUG])
    await ds.query(`DELETE FROM app.basket_strategies WHERE slug = $1`, [STRATEGY_SLUG])
    await ds.query(`DELETE FROM app.rwa_assets WHERE slug LIKE 't5-%'`)
    await ds.query(`DELETE FROM app.rwa_issuers WHERE slug = 't5-issuer'`)
  }

  const ledgerBalance = async (accountId: string): Promise<string> => {
    const [row] = (await ds.query(`SELECT COALESCE(current_atomic_balance, 0)::text AS balance FROM app.ledger_account_balances WHERE account_id = $1`, [accountId])) as Array<{ balance: string }>
    return row?.balance ?? '0'
  }

  const accountIdByReference = async (reference: string, purpose: string): Promise<string> => {
    const [row] = (await ds.query(
      `SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = $1 AND purpose = $2 AND asset_code = 'USDT'`,
      [reference, purpose],
    )) as Array<{ id: string }>
    return row.id
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    ledger = new LedgerService(ds)
    strategies = new BasketStrategyService(ds)
    portfolios = new BasketPortfolioService(ds, strategies)
    nav = new BasketNavService(ds)
    risk = new BasketRiskService(ds)
    subscriptions = new BasketSubscriptionService(ds, ledger, allowAll, portfolios, nav, risk)
    rebalance = new BasketRebalanceService(ds, nav, risk, allowAll, ledger, new PaperExecutionAdapter())
    reconciliation = new BasketReconciliationService(ds)
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

    // 用户 + 账本可用账户 + 测试注资（10,000 USDT）
    userId = randomUUID()
    await ds.query(`INSERT INTO app.users (id) VALUES ($1)`, [userId])
    userAccountId = (
      (await ds.query(
        `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
         VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
        [userId],
      )) as Array<{ id: string }>
    )[0].id
    await ds.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
       VALUES ('platform', 't5-faucet', 'settlement', 'USDT', 6, 'debit', true)
       ON CONFLICT DO NOTHING`,
    )
    const faucetId = (
      (await ds.query(
        `SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = 't5-faucet' AND purpose = 'settlement'`,
      )) as Array<{ id: string }>
    )[0].id
    const fundTx = randomUUID()
    const fundAmount = '10000000000' // 10,000 USDT (6dp)
    await ds.query(
      `INSERT INTO app.ledger_transactions (id, transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
       VALUES ($1, 'deposit', $2, 't5-seed', 'test_faucet', $3, 'service', now())`,
      [fundTx, `t5-seed:${fundTx}`, faucetId],
    )
    await ds.query(
      `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
       VALUES ($1, $2, 'credit', $4), ($1, $3, 'debit', $4)`,
      [fundTx, userAccountId, faucetId, fundAmount],
    )

    // 资产 + 行情 + 发行商
    const issuerId = (
      (await ds.query(
        `INSERT INTO app.rwa_issuers (name, slug, verified, website_url, token_count)
         VALUES ('T5 Issuer', 't5-issuer', true, 'https://t5.example', 5) RETURNING id`,
      )) as Array<{ id: string }>
    )[0].id
    const seedAsset = async (slug: string, name: string, assetClass: string, redemptionType: string) => {
      const assetId = (
        (await ds.query(
          `INSERT INTO app.rwa_assets (slug, name, asset_class, is_tokenized, redemption_type, issuer_id, status)
           VALUES ($1::varchar(160), $2, $3, false, $4, $5, 'active') RETURNING id`,
          [slug, name, assetClass, redemptionType, issuerId],
        )) as Array<{ id: string }>
      )[0].id
      return assetId
    }
    const a = await seedAsset('t5-a', 'T5 Treasury Bill', 'treasury', 'instant')
    const b = await seedAsset('t5-b', 'T5 Money Market', 'money_market', 'daily')
    const c = await seedAsset('t5-c', 'T5 Stable Value', 'stable_value', 'instant')
    const seedMetric = async (assetId: string, price: string, mcap: string, volume: string, apy: string, c24: string, c7: string, c30: string) => {
      await ds.query(
        `INSERT INTO app.rwa_asset_metrics (asset_id, price_usd, tokenized_market_cap_usd, volume_24h_usd, apy, change_24h_pct, change_7d_pct, change_30d_pct, data_timestamp, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), 'test')`,
        [assetId, price, mcap, volume, apy, c24, c7, c30],
      )
    }
    await seedMetric(a, '100.50', '100000000', '50000000', '4.5', '0.5', '1', '2')
    await seedMetric(b, '50.25', '60000000', '30000000', '5', '0.2', '1', '1.5')
    await seedMetric(c, '25.10', '30000000', '10000000', '3', '0.1', '0.5', '0.8')
    await scoring.runBatch(1000)

    // 策略 → 版本 → 目标配置 → 激活 → 组合
    const strategy = await strategies.createStrategy({ name: 'T5 Core Basket', slug: STRATEGY_SLUG, minimumSubscriptionUsd: '10' })
    strategyId = strategy.id as string
    const version = await strategies.createVersion(strategyId, {})
    const allocation = await strategies.generateTargetAllocation(version.id as string, {
      assetClasses: ['treasury', 'money_market', 'stable_value'],
      maxAssets: 3,
      cashBufferPct: 5,
    })
    expect(allocation.assets).toHaveLength(3)
    await strategies.activateVersion(strategyId, version.id as string)
    const portfolio = await portfolios.createPortfolio({ strategyId, name: 'T5 Basket One', status: 'pilot' })
    portfolioId = portfolio.id as string
  })

  it('runs the full acceptance chain: allocation → NAV → subscribe → rebalance → fills → redeem → reconcile', async () => {
    // 1) 目标配置：权重合计 95（含 5% 现金缓冲），单资产 ≤ 35%
    const detail = await strategies.getStrategyDetail(STRATEGY_SLUG)
    expect(detail.activeVersion).not.toBeNull()
    const targets = detail.targetAllocation as Array<Record<string, any>>
    expect(targets).toHaveLength(3)
    const weightSum = targets.reduce((sum, row) => sum + Number(row.targetWeightPct), 0)
    expect(weightSum).toBeCloseTo(95, 3)
    for (const row of targets) expect(Number(row.targetWeightPct)).toBeLessThanOrEqual(35)

    // 2) 组合建立（持仓种子 3 行）
    const holdings0 = await portfolios.listHoldings(portfolioId)
    expect(holdings0).toHaveLength(3)
    for (const holding of holdings0) expect(Number(holding.quantity)).toBe(0)

    // 3) 初始 NAV（起价 1）
    const nav0 = await nav.computeNav(portfolioId)
    expect(Number(nav0.navPerUnit)).toBe(1)

    // 4) 披露门槛：未确认 → 拒绝；确认 → 放行
    const disclosure = await subscriptions.createDisclosure({ title: 'T5 Basket Risk Disclosure', content: 'Basket strategies involve market, liquidity and issuer risks. NAV can fall.', strategyId })
    await expect(subscriptions.subscribe(userId, portfolioId, { amountUsd: '1000' }, 't5-sub-1', 't5-req-1')).rejects.toMatchObject({
      response: { code: 'BASKET_DISCLOSURE_ACK_REQUIRED' },
    })
    const ack = await subscriptions.acknowledgeDisclosure(userId, disclosure!.id as string, {})
    expect(ack.acknowledged).toBe(true)

    // 5) 申购 1000 USDT → 发 1000 份（NAV=1）→ 账本移动
    const sub = await subscriptions.subscribe(userId, portfolioId, { amountUsd: '1000' }, 't5-sub-1', 't5-req-1')
    expect(sub.duplicate).toBe(false)
    expect(Number((sub.subscription as Record<string, any>).unitsIssued)).toBeCloseTo(1000, 6)
    const pf1 = await portfolios.getPortfolio(portfolioId)
    expect(Number(pf1.totalUnits)).toBeCloseTo(1000, 6)
    expect(Number(pf1.cashBalanceUsd)).toBeCloseTo(1000, 6)
    expect(await ledgerBalance(userAccountId)).toBe('9000000000') // 10,000 - 1,000
    const basketAccountId = await accountIdByReference(`basket:${portfolioId}`, 'basket_settlement')
    expect(await ledgerBalance(basketAccountId)).toBe('1000000000')

    // 6) 幂等：同 key 重放不重复记账
    const subAgain = await subscriptions.subscribe(userId, portfolioId, { amountUsd: '1000' }, 't5-sub-1', 't5-req-1b')
    expect(subAgain.duplicate).toBe(true)
    const [subCount] = (await ds.query(`SELECT COUNT(*)::int AS count FROM app.basket_subscriptions WHERE portfolio_id = $1`, [portfolioId])) as Array<{ count: number }>
    expect(subCount.count).toBe(1)
    expect(Number((await portfolios.getPortfolio(portfolioId)).totalUnits)).toBeCloseTo(1000, 6)

    // 7) 调仓计划（3 笔买入；风险验证入库）
    const plan = (await rebalance.planRebalance(portfolioId, { trigger: 'manual' })) as Record<string, any>
    expect(plan.skipped).toBe(false)
    const orders = plan.orders as Array<Record<string, any>>
    expect(orders).toHaveLength(3)
    for (const order of orders) expect(order.side).toBe('buy')
    expect((plan.risk as Record<string, any>).status).not.toBe('block')

    // 8) 执行（paper 适配器）→ 全部成交 → run 完成
    const exec = await rebalance.executeRun(plan.runId as string)
    expect(exec.executed).toBe(3)
    const run = await rebalance.getRun(plan.runId as string)
    expect(run.status).toBe('completed')

    // 9) 持仓 + NAV 复核（NAV ≈ 1；现金与账本一致；投资账户 = 已投部分）
    const holdings1 = await portfolios.listHoldings(portfolioId)
    for (const holding of holdings1) expect(Number(holding.quantity)).toBeGreaterThan(0)
    const pf2 = await portfolios.getPortfolio(portfolioId)
    expect(Number(pf2.navPerUnit)).toBeGreaterThan(0.97)
    expect(Number(pf2.navPerUnit)).toBeLessThan(1.03)
    const cash2 = Number(pf2.cashBalanceUsd)
    expect(Number(await ledgerBalance(basketAccountId)) / 1e6).toBeCloseTo(cash2, 6)
    const investedAccountId = await accountIdByReference(`basket:${portfolioId}:invested`, 'invested_cost')
    expect(Number(await ledgerBalance(investedAccountId)) / 1e6).toBeCloseTo(1000 - cash2, 6)

    // 10) 漂移检测：成交后漂移接近 0
    const drift = await rebalance.detectDrift(portfolioId)
    expect(drift.maxAbsDriftPct).toBeLessThanOrEqual(1)
    expect(drift.needsRebalance).toBe(false)

    // 11) 已成交订单回填幂等
    const firstOrder = (run.orders as Array<Record<string, any>>)[0]
    const dupFill = await rebalance.recordFill(firstOrder.id as string, { executedQuantity: '1', averageFillPrice: '1' })
    expect(dupFill.duplicate).toBe(true)

    // 12) 赎回 40 份 → USDT 回用户可用账户
    const red = await subscriptions.redeem(userId, portfolioId, { units: '40' }, 't5-red-1', 't5-req-2')
    expect(red.duplicate).toBe(false)
    const pf3 = await portfolios.getPortfolio(portfolioId)
    expect(Number(pf3.totalUnits)).toBeCloseTo(960, 6)
    const userBalance = Number(await ledgerBalance(userAccountId))
    expect(userBalance).toBeGreaterThan(9_000_000_000 + 39_900_000)
    expect(userBalance).toBeLessThan(9_000_000_000 + 40_100_000)
    expect(Number(await ledgerBalance(basketAccountId)) / 1e6).toBeCloseTo(Number(pf3.cashBalanceUsd), 6)

    // 13) 超量赎回拒绝
    await expect(subscriptions.redeem(userId, portfolioId, { units: '99999' }, 't5-red-2', 't5-req-3')).rejects.toMatchObject({
      response: { code: 'BASKET_INSUFFICIENT_UNITS' },
    })

    // 14) 对账：现金/份数/NAV 三检通过
    const recon = await reconciliation.reconcilePortfolio(portfolioId, 't5-recon')
    expect(recon.state).toBe('matched')
    expect((recon.checks as Record<string, any>).cash.ok).toBe(true)
    expect((recon.checks as Record<string, any>).units.ok).toBe(true)
    expect((recon.checks as Record<string, any>).nav.ok).toBe(true)

    // 15) 用户持有份数 = 1000 - 40
    expect(Number(await portfolios.getUserUnits(portfolioId, userId))).toBeCloseTo(960, 6)
  })

  it('ops worker refreshes NAV and scans drift for the portfolio', async () => {
    const worker = new BasketOpsWorker({} as never, nav, rebalance, ds, { get: () => undefined } as never)
    const computed = await worker.runNavBatch(portfolioId)
    expect(computed).toBe(1)
    const planned = await worker.runDriftScan(portfolioId)
    expect(planned).toBe(0) // manual 模式不自动计划；无持仓时也无漂移
  })

  it('blocks subscriptions when the operational switch is disabled', async () => {
    const blockedOps = {
      assertEnabled: async () => {
        throw new ConflictException({ code: 'OPERATIONAL_SWITCH_DISABLED', message: 'Basket subscriptions are currently disabled.' })
      },
      isEnabled: async () => false,
    } as unknown as OperationalCapabilityService
    const service = new BasketSubscriptionService(ds, ledger, blockedOps, portfolios, nav, risk)
    await expect(service.subscribe(userId, portfolioId, { amountUsd: '100' }, 't5-switch-1', 't5-req-switch')).rejects.toMatchObject({
      response: { code: 'OPERATIONAL_SWITCH_DISABLED' },
    })
  })
})
