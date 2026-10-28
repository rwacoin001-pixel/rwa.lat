import { ConflictException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { ComplianceService } from '../../src/compliance/compliance.service'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { LedgerService } from '../../src/ledger/ledger.service'
import { OperationalCapabilityService } from '../../src/operations/operational-capability.service'
import { QuantSettlementService } from '../../src/quant/quant-settlement.service'
import { QuantService } from '../../src/quant/quant.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip
const allowAll = { assertEnabled: async () => undefined, isEnabled: async () => true } as unknown as OperationalCapabilityService
let SLUG = 'koala-test'

/** Koala Quant acceptance: subscribe, enter/approve/post two days (a win, then a loss), redeem, and check the ledger stays whole. */
describeDatabase('koala quant full flow', () => {
  let ds: DataSource
  let quant: QuantService
  let settlements: QuantSettlementService
  let userId: string
  let productId: string
  const adminA = randomUUID()
  const adminB = randomUUID()

  const balanceOf = async (where: string, params: unknown[]) => {
    const [row] = (await ds.query(
      `SELECT COALESCE(b.current_atomic_balance, 0)::text AS balance FROM app.ledger_accounts a LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id WHERE ${where}`,
      params,
    )) as Array<{ balance: string }>
    return BigInt(row?.balance ?? '0')
  }
  const userBalance = () => balanceOf(`a.owner_type = 'user' AND a.user_id = $1 AND a.purpose = 'available'`, [userId])
  const platform = (suffix: string, purpose: string) => balanceOf(`a.owner_type = 'platform' AND a.owner_reference = $1 AND a.purpose = $2`, [`quant:${productId}${suffix}`, purpose])

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.user_risk_acknowledgements WHERE disclosure_id IN (SELECT id FROM app.risk_disclosures WHERE product_type = 'quant')`)
    await ds.query(`DELETE FROM app.risk_disclosures WHERE product_type = 'quant'`)
    // Financial sources and lifetime first-subscription eligibility are immutable.
    // Use a fresh product for each case instead of deleting settled subscription history.
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    const ledger = new LedgerService(ds)
    quant = new QuantService(ds, ledger, allowAll, { requireInvestmentEligibility: async () => {} } as unknown as ComplianceService)
    settlements = new QuantSettlementService(ds, ledger, quant, { create: async () => ({}) } as never)
  })

  afterAll(async () => {
    if (ds?.isInitialized) {
      await cleanup()
      await ds.destroy()
    }
  })

  beforeEach(async () => {
    await cleanup()
    SLUG=`koala-test-${randomUUID().slice(0,8)}`
    userId = randomUUID()
    await ds.query(`INSERT INTO app.users (id) VALUES ($1)`, [userId])
    const [user] = (await ds.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side) VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
      [userId],
    )) as Array<{ id: string }>
    await ds.query(`INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative) VALUES ('platform', 'koala-faucet', 'settlement', 'USDT', 6, 'debit', true) ON CONFLICT DO NOTHING`)
    const [faucet] = (await ds.query(`SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = 'koala-faucet' AND purpose = 'settlement'`)) as Array<{ id: string }>
    const fundTx = randomUUID()
    await ds.query(`INSERT INTO app.ledger_transactions (id, transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at) VALUES ($1, 'deposit', $2, 'koala-seed', 'test_faucet', $3, 'service', now())`, [fundTx, `koala-seed:${fundTx}`, faucet.id])
    await ds.query(`INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount) VALUES ($1, $2, 'credit', 1000000000), ($1, $3, 'debit', 1000000000)`, [fundTx, user.id, faucet.id])

    const [product] = (await ds.query(
      `INSERT INTO app.quant_products (slug, name, status, first_trade_date, min_subscription_atomic, min_redemption_atomic) VALUES ($1, 'Koala test', 'active', '2026-01-01', 1000000, 1000000) RETURNING id`,
      [SLUG],
    )) as Array<{ id: string }>
    productId = product.id
  })

  it('pays profits daily, shrinks principal on a loss, redeems with a fee and keeps the books balanced', async () => {
    const start = await userBalance()
    const sub = await quant.subscribe(userId, SLUG, '500', 'sub-key-0001', 'req-1')
    expect((sub.order as { status: string }).status).toBe('settled')
    expect(await userBalance()).toBe(start - 500_000_000n)
    expect(await platform('', 'basket_settlement')).toBe(500_000_000n)
    // idempotent retry
    expect((await quant.subscribe(userId, SLUG, '500', 'sub-key-0001', 'req-1')).duplicate).toBe(true)
    expect(await userBalance()).toBe(start - 500_000_000n)

    // let the lot start on the first trade date so two past days can be settled
    await ds.query(`UPDATE app.quant_lots SET effective_date = '2026-01-01' WHERE product_id = $1`, [productId])

    // day 1: +1.00%
    const day1 = await settlements.enter(SLUG, { tradeDate: '2026-01-01', grossReturnPct: '1.00' }, adminA)
    // one administrator may enter and confirm; the two steps stay separate actions
    const posted1 = (await settlements.approve(day1.id, adminA, false, 'req-b')) as { status: string }
    expect(posted1.status).toBe('posted')
    const afterDay1 = await userBalance()
    expect(afterDay1 - (start - 500_000_000n)).toBeGreaterThan(0n)
    expect(afterDay1 - (start - 500_000_000n)).toBeLessThanOrEqual(5_000_000n)
    expect(await platform('', 'basket_settlement')).toBe(500_000_000n)
    // posting twice changes nothing
    expect(((await settlements.post(day1.id, adminB, 'req-c')) as { duplicate?: boolean }).duplicate).toBe(true)
    expect(await userBalance()).toBe(afterDay1)

    // days must go in order and cannot be skipped
    await expect(settlements.enter(SLUG, { tradeDate: '2026-01-03', grossReturnPct: '0.5' }, adminA)).rejects.toBeInstanceOf(ConflictException)

    // day 2: -2.00% with a redemption of everything queued for that day
    const [order] = (await ds.query(`INSERT INTO app.quant_orders (product_id, user_id, kind, amount_atomic, status, effective_date, idempotency_key) VALUES ($1, $2, 'redemption', NULL, 'pending', '2026-01-02', 'redeem-key-01') RETURNING id`, [productId, userId])) as Array<{ id: string }>
    const day2 = await settlements.enter(SLUG, { tradeDate: '2026-01-02', grossReturnPct: '-2.00' }, adminA)
    await settlements.approve(day2.id, adminB, false, 'req-d')
    const [redeemed] = (await ds.query(`SELECT status, principal_atomic::text AS principal, fee_atomic::text AS fee, payout_atomic::text AS payout FROM app.quant_orders WHERE id = $1`, [order.id])) as Array<{ status: string; principal: string; fee: string; payout: string }>
    expect(redeemed.status).toBe('settled')
    expect(BigInt(redeemed.principal)).toBeLessThan(500_000_000n)
    expect(BigInt(redeemed.payout)).toBe(BigInt(redeemed.principal) - BigInt(redeemed.fee))
    expect(BigInt(redeemed.fee)).toBeGreaterThan(0n) // held under 7 days

    // everything is back out of the pool, and no money appeared or vanished
    expect(await platform('', 'basket_settlement')).toBe(0n)
    const [lots] = (await ds.query(`SELECT COALESCE(SUM(principal_atomic), 0)::text AS principal FROM app.quant_lots WHERE product_id = $1`, [productId])) as Array<{ principal: string }>
    expect(lots.principal).toBe('0')
    const fees = await platform(':fee', 'fee_revenue')
    const treasury = await platform(':treasury', 'reward_payable')
    const end = await userBalance()
    expect(end + fees + treasury + (await platform('', 'basket_settlement'))).toBe(start)

    // public numbers come from every settled day, with honest coverage
    const detail = await quant.getProduct(SLUG)
    expect(detail.performance.days).toBe(2)
    expect(detail.performance.last7d.coveredDays).toBe(2)
    expect(detail.performance.maxDrawdownPct).toBeLessThan(0)
    const dates = await quant.previewSubscription(SLUG)
    expect(dates.effectiveDate > dates.tradeDate).toBe(true)

    const admin = await settlements.adminProduct(SLUG)
    expect(admin.ledger.poolMatchesLots).toBe(true)
    expect(admin.last_settled_date).toBe('2026-01-02')
  })
  it('queues a redemption once and leaves it pending while the principal has not started earning', async () => {
    await quant.subscribe(userId, SLUG, '100', 'sub-key-0002', 'req-1')
    const queued = await quant.redeem(userId, SLUG, { all: true }, 'red-key-0002', 'req-2')
    expect((queued.order as { status: string }).status).toBe('pending')
    await expect(quant.redeem(userId, SLUG, { all: true }, 'red-key-0003', 'req-3')).rejects.toBeInstanceOf(ConflictException)
    await expect(quant.subscribe(userId, SLUG, '0.5', 'sub-key-0003', 'req-4')).rejects.toThrow()

    // an empty day (the lot starts in the future) still settles, and the redemption is not touched
    const day = await settlements.enter(SLUG, { tradeDate: '2026-01-01', grossReturnPct: '0.4' }, adminA)
    await settlements.approve(day.id, adminB, false, 'req-5')
    const [order] = (await ds.query(`SELECT status FROM app.quant_orders WHERE user_id = $1 AND kind = 'redemption'`, [userId])) as Array<{ status: string }>
    expect(order.status).toBe('pending')
    expect(await platform('', 'basket_settlement')).toBe(100_000_000n)
  })
  it('asks for the latest risk disclosure before the first subscription and again after a new version', async () => {
    const first = await settlements.createDisclosure({ title: 'Koala risk disclosure', content: 'Principal can fall. Past results do not predict future ones.' }, adminA)
    expect(first.version).toBe(1)
    await expect(quant.subscribe(userId, SLUG, '50', 'disc-key-0001', 'req-1')).rejects.toMatchObject({ response: { code: 'QUANT_DISCLOSURE_ACK_REQUIRED' } })
    await ds.query(`INSERT INTO app.user_risk_acknowledgements (user_id, disclosure_id, version) VALUES ($1, $2, 1)`, [userId, first.id])
    expect(((await quant.subscribe(userId, SLUG, '50', 'disc-key-0002', 'req-2')).order as { status: string }).status).toBe('settled')

    const second = await settlements.createDisclosure({ title: 'Koala risk disclosure', content: 'Updated text. Principal can fall. Fees apply.' }, adminA)
    expect(second.version).toBe(2)
    await expect(quant.subscribe(userId, SLUG, '50', 'disc-key-0003', 'req-3')).rejects.toMatchObject({ response: { code: 'QUANT_DISCLOSURE_ACK_REQUIRED' } })
    const list = (await settlements.listDisclosures()) as Array<{ version: number; acknowledgements: number }>
    expect(list.map((row) => row.version)).toEqual([2, 1])
    expect(list[1].acknowledgements).toBe(1)
  })
})
