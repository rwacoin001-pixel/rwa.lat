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

type Preview = Awaited<ReturnType<QuantSettlementService['preview']>>
type Recorded = {
  status: string; netReturnPct: string; indexBefore: string; indexAfter: string; usersCount: number; principalAtomic: string; paidAtomic: string
  principalLossAtomic: string; mgmtFeeAtomic: string; perfFeeAtomic: string; redemptionPrincipalAtomic: string; redemptionFeeAtomic: string
}

/** The admin preview must show exactly what approve + post then records, and must write nothing. */
describeDatabase('koala quant settlement preview', () => {
  let ds: DataSource
  let quant: QuantService
  let settlements: QuantSettlementService
  let slug: string
  let productId: string
  const users: string[] = []
  const admin = randomUUID()

  const fundUser = async () => {
    const userId = randomUUID()
    await ds.query(`INSERT INTO app.users (id) VALUES ($1)`, [userId])
    const [account] = (await ds.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side) VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
      [userId],
    )) as Array<{ id: string }>
    await ds.query(`INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative) VALUES ('platform', 'koala-faucet', 'settlement', 'USDT', 6, 'debit', true) ON CONFLICT DO NOTHING`)
    const [faucet] = (await ds.query(`SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = 'koala-faucet' AND purpose = 'settlement'`)) as Array<{ id: string }>
    const tx = randomUUID()
    await ds.query(`INSERT INTO app.ledger_transactions (id, transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at) VALUES ($1, 'deposit', $2, 'koala-seed', 'test_faucet', $3, 'service', now())`, [tx, `koala-seed:${tx}`, faucet.id])
    await ds.query(`INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount) VALUES ($1, $2, 'credit', 1000000000), ($1, $3, 'debit', 1000000000)`, [tx, account.id, faucet.id])
    return userId
  }

  /** Everything a preview could conceivably write to. */
  const footprint = async () => {
    const [row] = (await ds.query(
      `SELECT (SELECT COUNT(*) FROM app.ledger_transactions)::int AS tx, (SELECT COUNT(*) FROM app.ledger_entries)::int AS entries,
              (SELECT COUNT(*) FROM app.ledger_accounts)::int AS accounts, (SELECT COUNT(*) FROM app.audit_logs)::int AS audits,
              (SELECT COUNT(*) FROM app.quant_payouts)::int AS payouts,
              (SELECT string_agg(id::text || principal_atomic::text, ',' ORDER BY id) FROM app.quant_lots WHERE product_id = $1) AS lots,
              (SELECT string_agg(id::text || status, ',' ORDER BY id) FROM app.quant_orders WHERE product_id = $1) AS orders,
              (SELECT string_agg(id::text || status, ',' ORDER BY id) FROM app.quant_daily_settlements WHERE product_id = $1) AS days,
              (SELECT index_value::text || hwm_index::text || COALESCE(last_settled_date::text, '') FROM app.quant_products WHERE id = $1) AS product`,
      [productId],
    )) as Array<Record<string, unknown>>
    return row
  }

  const recorded = async (id: string) => {
    const [row] = (await ds.query(
      `SELECT status, trim_scale(net_return_pct)::text AS "netReturnPct", trim_scale(index_before)::text AS "indexBefore", trim_scale(index_after)::text AS "indexAfter",
              users_count AS "usersCount", principal_atomic::text AS "principalAtomic", paid_atomic::text AS "paidAtomic", principal_loss_atomic::text AS "principalLossAtomic",
              mgmt_fee_atomic::text AS "mgmtFeeAtomic", perf_fee_atomic::text AS "perfFeeAtomic", redemption_principal_atomic::text AS "redemptionPrincipalAtomic",
              redemption_fee_atomic::text AS "redemptionFeeAtomic"
       FROM app.quant_daily_settlements WHERE id = $1`,
      [id],
    )) as Recorded[]
    return row
  }

  /** Enter a day, preview it (checking nothing changed), approve it, and compare the preview with what was recorded. */
  const settleAndCompare = async (tradeDate: string, grossReturnPct: string, now: Date) => {
    const entry = await settlements.enter(slug, { tradeDate, grossReturnPct }, admin)
    const before = await footprint()
    const preview = await settlements.preview(entry.id, now)
    expect(await footprint()).toEqual(before)
    const pendingBefore = (await ds.query(`SELECT id FROM app.quant_orders WHERE product_id = $1 AND kind = 'redemption' AND status = 'pending'`, [productId])) as Array<{ id: string }>

    await settlements.approve(entry.id, admin, false, `req-${tradeDate}`)
    const row = await recorded(entry.id)
    expect(row.status).toBe('posted')
    expect(preview.tradeDate).toBe(tradeDate)
    expect(preview.netReturnPct).toBe(row.netReturnPct)
    expect(preview.indexBefore).toBe(row.indexBefore)
    expect(preview.indexAfter).toBe(row.indexAfter)
    expect(preview.holders).toBe(row.usersCount)
    expect(preview.principalAtomic).toBe(row.principalAtomic)
    expect(preview.payoutAtomic).toBe(row.paidAtomic)
    expect(preview.lossAtomic).toBe(row.principalLossAtomic)
    expect(preview.feesAtomic).toBe((BigInt(row.mgmtFeeAtomic) + BigInt(row.perfFeeAtomic)).toString())
    expect(preview.redemptions.principalAtomic).toBe(row.redemptionPrincipalAtomic)
    expect(preview.redemptions.feeAtomic).toBe(row.redemptionFeeAtomic)
    const settled = (await ds.query(
      `SELECT COUNT(*)::int AS n FROM app.quant_orders WHERE id = ANY($1::uuid[]) AND status = 'settled'`,
      [pendingBefore.map((o) => o.id)],
    )) as Array<{ n: number }>
    expect(preview.redemptions.count).toBe(settled[0].n)
    // per-user rows: as many as the preview said, summing to its payout
    const [payouts] = (await ds.query(`SELECT COUNT(*)::int AS n, COALESCE(SUM(paid_atomic), 0)::text AS paid FROM app.quant_payouts WHERE settlement_id = $1`, [entry.id])) as Array<{ n: number; paid: string }>
    expect(payouts.n).toBe(preview.holders)
    expect(payouts.paid).toBe(preview.payoutAtomic)
    return preview
  }

  const check = (preview: Preview, code: string) => preview.checks.find((c) => c.code === code)

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    await ds.runMigrations({ transaction: 'all' })
    const ledger = new LedgerService(ds)
    quant = new QuantService(ds, ledger, allowAll, { requireInvestmentEligibility: async () => {} } as unknown as ComplianceService)
    settlements = new QuantSettlementService(ds, ledger, quant, { create: async () => ({}) } as never)

    slug = `koala-preview-${randomUUID().slice(0, 8)}`
    const [product] = (await ds.query(
      `INSERT INTO app.quant_products (slug, name, status, first_trade_date, min_subscription_atomic, min_redemption_atomic) VALUES ($1, 'Koala preview', 'active', '2026-01-01', 1000000, 1000000) RETURNING id`,
      [slug],
    )) as Array<{ id: string }>
    productId = product.id
    users.push(await fundUser(), await fundUser())
    await quant.subscribe(users[0], slug, '500', `prev-sub-${randomUUID()}`, 'req-s1')
    await quant.subscribe(users[1], slug, '123.456789', `prev-sub-${randomUUID()}`, 'req-s2')
    await quant.subscribe(users[1], slug, '40', `prev-sub-${randomUUID()}`, 'req-s3')
    await ds.query(`UPDATE app.quant_lots SET effective_date = '2026-01-01' WHERE product_id = $1`, [productId])
  })

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy()
  })

  it('matches approve + post on a gain day, a loss day and a day with a redemption', async () => {
    // day 1: gain, previewed the next morning (11:00 Singapore = 03:00Z), before the 15:00 cutoff
    const gain = await settleAndCompare('2026-01-01', '0.85', new Date('2026-01-02T03:00:00Z'))
    expect(BigInt(gain.payoutAtomic)).toBeGreaterThan(0n)
    expect(gain.lossAtomic).toBe('0')
    expect(BigInt(gain.feesAtomic)).toBeGreaterThan(0n)
    expect(gain.holders).toBe(2)
    expect(gain.history).toMatchObject({ days: [], mean: null, min: null, max: null, outsideRange: false, largeMove: false })
    expect(gain.checks.map((c) => c.code)).toEqual(['already_settled', 'trade_date_order', 'cutoff', 'large_move', 'ledger_funded'])
    expect(gain.checks.every((c) => c.ok)).toBe(true)

    // day 2: loss, previewed after the cutoff (16:00 Singapore)
    const loss = await settleAndCompare('2026-01-02', '-1.5', new Date('2026-01-03T08:00:00Z'))
    expect(loss.payoutAtomic).toBe('0')
    expect(BigInt(loss.lossAtomic)).toBeGreaterThan(0n)
    expect(check(loss, 'cutoff')?.ok).toBe(false)
    expect(loss.history.days).toEqual([{ tradeDate: '2026-01-01', netReturnPct: gain.netReturnPct }])
    expect(loss.history.outsideRange).toBe(true)

    // day 3: a queued full redemption for user 2 is paid out of what is left after the day
    await ds.query(
      `INSERT INTO app.quant_orders (product_id, user_id, kind, amount_atomic, status, effective_date, idempotency_key) VALUES ($1, $2, 'redemption', NULL, 'pending', '2026-01-03', $3)`,
      [productId, users[1], `prev-red-${randomUUID()}`],
    )
    const redeem = await settleAndCompare('2026-01-03', '0.2', new Date('2026-01-04T01:00:00Z'))
    expect(redeem.redemptions.count).toBe(1)
    expect(BigInt(redeem.redemptions.principalAtomic)).toBeGreaterThan(0n)
    expect(BigInt(redeem.redemptions.feeAtomic)).toBeGreaterThan(0n)
    expect(redeem.history.days.map((d) => d.tradeDate)).toEqual(['2026-01-02', '2026-01-01'])
    expect(redeem.history.min).toBe(loss.netReturnPct)
    expect(redeem.history.max).toBe(gain.netReturnPct)
    expect(redeem.history.outsideRange).toBe(false)
    expect(check(redeem, 'ledger_funded')?.ok).toBe(true)
    const [lots] = (await ds.query(`SELECT COALESCE(SUM(principal_atomic), 0)::text AS p FROM app.quant_lots WHERE product_id = $1 AND user_id = $2`, [productId, users[1]])) as Array<{ p: string }>
    expect(lots.p).toBe('0')
  })

  it('flags a large move, and refuses a posted entry', async () => {
    const entry = await settlements.enter(slug, { tradeDate: '2026-01-04', grossReturnPct: '7' }, admin)
    const preview = await settlements.preview(entry.id, new Date('2026-01-05T02:00:00Z'))
    expect(preview.history.largeMove).toBe(true)
    expect(check(preview, 'large_move')?.ok).toBe(false)
    expect(preview.history.days).toHaveLength(3)
    await settlements.voidDraft(entry.id, admin)
    await expect(settlements.preview(entry.id)).rejects.toBeInstanceOf(ConflictException)
    const [posted] = (await ds.query(`SELECT id FROM app.quant_daily_settlements WHERE product_id = $1 AND status = 'posted' LIMIT 1`, [productId])) as Array<{ id: string }>
    await expect(settlements.preview(posted.id)).rejects.toMatchObject({ response: { code: 'QUANT_NOT_PREVIEWABLE' } })
  })
})
