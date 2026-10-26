import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { readPortfolioSummary } from '../../src/portfolio/portfolio-summary'

// Use a disposable database only. CREATE SCHEMA (without IF NOT EXISTS) refuses
// an existing application schema; this suite never runs application migrations.
const url = process.env.PORTFOLIO_SUMMARY_TEST_DATABASE_URL
const describeDatabase = url ? describe : describe.skip
const USER = '44444444-4444-4444-4444-444444444444'
const OTHER = '55555555-5555-5555-5555-555555555555'

describeDatabase('Portfolio summary SQL (isolated PostgreSQL)', () => {
  let db: DataSource
  let day: Date
  let available: string
  let ownedSchema = false

  beforeAll(async () => {
    db = new DataSource({ type: 'postgres', url })
    await db.initialize()
    await db.query('CREATE SCHEMA app')
    ownedSchema = true
    await db.query(`
      CREATE TABLE app.ledger_accounts (
        id uuid PRIMARY KEY, user_id uuid, owner_type text, purpose text,
        asset_code text, asset_decimals smallint, state text, normal_side text
      );
      CREATE TABLE app.ledger_account_balances (account_id uuid PRIMARY KEY, current_atomic_balance numeric(78,0));
      CREATE TABLE app.ledger_transactions (
        id uuid PRIMARY KEY, transaction_type text, reference_type text,
        reference_id uuid, reverses_transaction_id uuid, effective_at timestamptz
      );
      CREATE TABLE app.ledger_entries (
        id uuid PRIMARY KEY, transaction_id uuid, account_id uuid, side text, atomic_amount numeric(78,0), created_at timestamptz
      );
      CREATE TABLE app.prediction_bets (
        id uuid PRIMARY KEY, user_id uuid, stake_atomic numeric(78,0), status text, settled_at timestamptz
      );
    `)
  })

  afterAll(async () => {
    if (db?.isInitialized) {
      if (ownedSchema) await db.query('DROP SCHEMA app CASCADE')
      await db.destroy()
    }
  })

  async function account(purpose = 'available', user = USER, asset = 'USDT', normalSide = 'credit') {
    const id = randomUUID()
    await db.query(`INSERT INTO app.ledger_accounts VALUES ($1,$2,'user',$3,$4,6,'active',$5)`, [id, user, purpose, asset, normalSide])
    await db.query(`INSERT INTO app.ledger_account_balances VALUES ($1,0)`, [id])
    return id
  }

  async function post(delta: bigint, type: string, options: {
    account?: string; at?: Date; reference?: string; referenceId?: string; reverses?: string; effectiveAt?: Date
  } = {}) {
    const id = randomUUID()
    const entry = randomUUID()
    const accountId = options.account ?? available
    const at = options.at ?? new Date(day.getTime() + 1)
    const [{ normal_side: normal }] = await db.query('SELECT normal_side FROM app.ledger_accounts WHERE id=$1', [accountId])
    const side = delta >= 0n ? normal : normal === 'credit' ? 'debit' : 'credit'
    await db.query(`INSERT INTO app.ledger_transactions VALUES ($1,$2,$3,$4,$5,$6)`, [id, type, options.reference ?? type, options.referenceId ?? randomUUID(), options.reverses ?? null, options.effectiveAt ?? at])
    await db.query(`INSERT INTO app.ledger_entries VALUES ($1,$2,$3,$4,$5,$6)`, [entry, id, accountId, side, (delta < 0n ? -delta : delta).toString(), at])
    await db.query(`UPDATE app.ledger_account_balances SET current_atomic_balance=current_atomic_balance+$2 WHERE account_id=$1`, [accountId, delta.toString()])
    return id
  }

  async function bet(status: 'placed' | 'won' | 'lost' | 'void', options: {
    stake?: bigint; payout?: bigint; settledAt?: Date; stakeAt?: Date; user?: string; account?: string
  } = {}) {
    const id = randomUUID()
    const stake = options.stake ?? 10000000n
    const settledAt = options.settledAt ?? day
    const stakeAt = options.stakeAt ?? new Date(day.getTime() - 3600000)
    await db.query('INSERT INTO app.prediction_bets VALUES ($1,$2,$3,$4,$5)',
      [id, options.user ?? USER, stake.toString(), status, status === 'placed' ? null : settledAt])
    await post(-stake, 'prediction_stake', { account: options.account, at: stakeAt, reference: 'prediction_bet', referenceId: id })
    if (options.payout) await post(options.payout, status === 'void' ? 'prediction_void_refund' : 'prediction_payout', {
      account: options.account, at: settledAt, reference: 'prediction_bet', referenceId: id,
    })
    return id
  }

  beforeEach(async () => {
    await db.query(`TRUNCATE app.ledger_accounts, app.ledger_account_balances, app.ledger_transactions,
      app.ledger_entries, app.prediction_bets`)
    const [{ start }] = await db.query(`SELECT date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore' AS start`)
    day = start
    available = await account()
    await post(100000000n, 'deposit', { at: new Date(day.getTime() - 3600000) })
  })

  it.each([
    ['quant_daily_settlement', 310000n, '0.31'],
    ['quant_daily_settlement', -310000n, '-0.31'],
    ['referral_reward', 5000000n, '5.00'],
    ['yield_accrual', 1100000n, '1.10'],
  ])('counts signed %s income %s', async (type, delta, pct) => {
    await post(delta, type)
    expect((await readPortfolioSummary(db.manager, USER)).today).toEqual({
      changeAtomic: delta.toString(), changePct: pct, since: day.toISOString(), basis: 'ledger',
    })
  })

  it('returns null for an empty wallet', async () => {
    expect(await readPortfolioSummary(db.manager, OTHER)).toMatchObject({ totalAtomic: '0', today: null })
  })

  it('excludes deposits, withdrawals and transfers together', async () => {
    await post(50000000n, 'deposit')
    await post(-10000000n, 'withdrawal_settlement')
    await post(20000000n, 'internal_transfer')
    expect(await readPortfolioSummary(db.manager, USER)).toMatchObject({ totalAtomic: '160000000', today: null })
  })

  it.each([
    ['withdrawal_lock', -1000000n], ['withdrawal_refund', 1000000n],
    ['order_lock', -1000000n], ['order_release', 1000000n],
    ['basket_subscription', -40000000n], ['basket_redemption', 40000000n],
    ['basket_rebalance', 1000000n], ['quant_subscription', -40000000n],
    ['quant_redemption', 40000000n], ['investment', -40000000n],
    ['settlement', 40000000n], ['fee', -1000000n], ['adjustment', 1000000n],
    ['prediction_void_refund', 10000000n],
  ])('excludes non-income %s', async (type, delta) => {
    await post(delta, type)
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
  })

  it('retains zero-net income rather than returning null', async () => {
    await post(310000n, 'quant_daily_settlement')
    await post(-310000n, 'quant_daily_settlement')
    expect((await readPortfolioSummary(db.manager, USER)).today).toMatchObject({ changeAtomic: '0', changePct: '0.00' })
  })

  it('reports a lost bet as minus the full stake, despite no payout ledger entry', async () => {
    await bet('lost')
    expect((await readPortfolioSummary(db.manager, USER)).today).toMatchObject({ changeAtomic: '-10000000', changePct: '-10.00' })
  })

  it('reports a won bet as the actual net payout minus its full stake', async () => {
    await bet('won', { payout: 19000000n })
    expect((await readPortfolioSummary(db.manager, USER)).today).toMatchObject({ changeAtomic: '9000000', changePct: '9.00' })
  })

  it('includes a zero-payout settled win as a realised loss', async () => {
    await bet('won')
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('-10000000')
  })

  it('includes a break-even settled prediction as zero income', async () => {
    await bet('won', { payout: 10000000n })
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('0')
  })

  it('does not count a stake placed today before settlement', async () => {
    await bet('placed', { stakeAt: day })
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
  })

  it('excludes void principal refunds and their placement fees', async () => {
    await bet('void', { payout: 9900000n })
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
  })

  it('links each payout to its own stake without multiplying legs', async () => {
    await bet('won', { stake: 10000000n, payout: 19000000n })
    await bet('lost', { stake: 5000000n })
    await bet('placed', { stake: 2000000n, stakeAt: day })
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('4000000')
  })

  it('never counts an orphan payout or a mismatched stake as profit', async () => {
    const id = await bet('won', { payout: 19000000n })
    await db.query('UPDATE app.prediction_bets SET stake_atomic=20000000 WHERE id=$1', [id])
    await post(50000000n, 'prediction_payout', { reference: 'prediction_bet' })
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
  })

  it('excludes predictions settled yesterday or in the future', async () => {
    await bet('won', { payout: 19000000n, settledAt: new Date(day.getTime() - 1) })
    await bet('lost', { settledAt: new Date(day.getTime() + 86400000) })
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
  })

  it('excludes yesterday in Singapore and future income; includes midnight exactly', async () => {
    await post(999999n, 'referral_reward', { at: new Date(day.getTime() - 1) })
    await post(999999n, 'yield_accrual', { at: new Date(day.getTime() + 86400000) })
    expect((await readPortfolioSummary(db.manager, USER)).today).toBeNull()
    await post(310000n, 'quant_daily_settlement', { at: day })
    const result = await readPortfolioSummary(db.manager, USER)
    expect(result.today?.changeAtomic).toBe('310000')
    expect(result.today?.since).toBe(day.toISOString())
    expect(day.getUTCHours()).toBe(16)
  })

  it('uses the posting clock even if the effective date is yesterday', async () => {
    await post(310000n, 'quant_daily_settlement', { effectiveAt: new Date(day.getTime() - 1000) })
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('310000')
  })

  it('uses all five wallet purposes for total and keeps non-income internal moves out', async () => {
    for (const purpose of ['locked', 'pending', 'invested_cost', 'reward_payable']) {
      await post(-10000000n, 'withdrawal_lock')
      await post(10000000n, 'withdrawal_lock', { account: await account(purpose) })
    }
    expect(await readPortfolioSummary(db.manager, USER)).toMatchObject({ totalAtomic: '100000000', today: null })
  })

  it('undoes only included income types through reversals', async () => {
    const yesterday = new Date(day.getTime() - 1000)
    const deposit = await post(10000000n, 'deposit', { at: yesterday })
    const earning = await post(1000000n, 'yield_accrual', { at: yesterday })
    await post(-10000000n, 'reversal', { reverses: deposit })
    await post(-1000000n, 'reversal', { reverses: earning })
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('-1000000')
  })

  it('counts a same-day income and reversal as zero', async () => {
    const earning = await post(1000000n, 'referral_reward')
    await post(-1000000n, 'reversal', { reverses: earning })
    expect((await readPortfolioSummary(db.manager, USER)).today?.changeAtomic).toBe('0')
  })

  it('respects normal_side, user and currency filters', async () => {
    await post(310000n, 'yield_accrual', { account: await account('pending', USER, 'USDT', 'debit') })
    const otherAccount = await account('available', OTHER)
    await post(99999999n, 'yield_accrual', { account: otherAccount })
    await bet('won', { user: OTHER, account: otherAccount, payout: 19000000n })
    await post(99999999n, 'yield_accrual', { account: await account('available', USER, 'BTC') })
    const result = await readPortfolioSummary(db.manager, USER)
    expect(result.totalAtomic).toBe('100310000')
    expect(result.today?.changeAtomic).toBe('310000')
  })

  it('preserves amounts above Number.MAX_SAFE_INTEGER in SQL and percentage arithmetic', async () => {
    await post(100000000000000000000000000n, 'deposit')
    await post(310000000000000000000001n, 'quant_daily_settlement')
    expect((await readPortfolioSummary(db.manager, USER)).today).toMatchObject({
      changeAtomic: '310000000000000000000001', changePct: '0.31',
    })
  })

  it('returns null percentage with a zero base while retaining income', async () => {
    await post(1000000n, 'referral_reward', { account: await account('available', OTHER) })
    expect((await readPortfolioSummary(db.manager, OTHER)).today).toMatchObject({ changeAtomic: '1000000', changePct: null })
  })

  it('uses total minus income as the percentage base even with new deposits', async () => {
    await post(50000000n, 'deposit')
    await post(3820000n, 'quant_daily_settlement')
    expect((await readPortfolioSummary(db.manager, USER)).today).toMatchObject({ changeAtomic: '3820000', changePct: '2.55' })
  })
})
