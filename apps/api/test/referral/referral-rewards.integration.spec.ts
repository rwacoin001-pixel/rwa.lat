import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { REFERRAL_DEFAULT_SETTINGS } from '../../src/referral/referral-policy'
import { recordReferralRewards } from '../../src/referral/referral-rewards'
import { ReferralClaimService } from '../../src/referral/referral-claim.service'
import { ReferralReadService } from '../../src/referral/referral-read.service'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('referral rewards (PostgreSQL)', () => {
  let db: DataSource
  let claims: ReferralClaimService
  let read: ReferralReadService
  // Chain: A <- B <- C <- D <- E (E was invited by D, D by C, ...). X is unrelated.
  const u: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'X', string> = {} as never
  let product: string
  let fundingAccount: string
  let feeAccount: string

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    claims = new ReferralClaimService(db)
    read = new ReferralReadService(db)
    for (const key of Object.keys({ A: 1, B: 1, C: 1, D: 1, E: 1, X: 1 }) as Array<keyof typeof u>) {
      const [row] = await db.query(`INSERT INTO app.users (status) VALUES ('active') RETURNING id`)
      u[key] = row.id
    }
    const invite = async (inviter: string, invitee: string) => {
      const code = `c${inviter.replace(/-/g, '').slice(0, 10)}`
      await db.query('INSERT INTO app.referral_code_aliases (code, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [code, inviter])
      await db.query('INSERT INTO app.referral_edges (invitee_user_id, inviter_user_id, code) VALUES ($1, $2, $3)', [invitee, inviter, code])
    }
    await invite(u.A, u.B); await invite(u.B, u.C); await invite(u.C, u.D); await invite(u.D, u.E)
    await db.query(`INSERT INTO app.referral_settings (config, fee_effective_at, holding_effective_at, team_effective_at)
      VALUES ($1, now() - interval '1 minute', now() - interval '1 minute', now() - interval '1 minute')`,
    [JSON.stringify({ ...REFERRAL_DEFAULT_SETTINGS, holdingRatesBps: [600, 300, 100], feeRatesBps: [2000, 1000, 500] })])

    await db.query(`INSERT INTO app.asset_classes (id, display_name, state, created_at) VALUES ('ac_referral_test', 'Referral test', 'active', now()) ON CONFLICT DO NOTHING`)
    const [p] = await db.query(`INSERT INTO app.products (id, asset_class_id, version, display_name, asset_code, asset_decimals, state, published_at)
      VALUES (gen_random_uuid(), 'ac_referral_test', 1, 'Referral test product', 'USDT', 6, 'published', now()) RETURNING id`)
    product = p.id
    const [funding] = await db.query(`INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
      VALUES ('platform', 'referral_test_funding', 'settlement', 'USDT', 6, 'debit', true) RETURNING id`)
    fundingAccount = funding.id
    await db.query(`INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
      VALUES ('platform', 'prediction_fee', 'fee_revenue', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`)
    const [fee] = await db.query(`SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = 'prediction_fee' AND purpose = 'fee_revenue'`)
    feeAccount = fee.id
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  /** A filled buy order of `amount` atomic USDT for `user`, plus its rewards, in one transaction. */
  async function purchase(user: string, amount: bigint) {
    return db.transaction(async (m) => {
      const [order] = await m.query(`INSERT INTO app.orders (user_id, product_id, side, requested_atomic_amount, filled_atomic_amount,
          unit_price_atomic_amount, state, idempotency_key, request_id, completed_at)
        VALUES ($1, $2, 'buy', $3, $3, 1000000, 'filled', $4, 'referral-test', now()) RETURNING id`, [user, product, amount.toString(), randomUUID()])
      const created = await recordReferralRewards(m, { kind: 'purchase', sourceType: 'order', sourceId: order.id, sourceUserId: user, baseAtomic: amount })
      return { orderId: order.id as string, created }
    })
  }

  /** A platform prediction fee of `amount` paid by `user` (balanced ledger transaction), plus its rewards. */
  async function predictionFee(user: string, amount: bigint, type: 'prediction_stake' | 'prediction_payout' = 'prediction_stake') {
    return db.transaction(async (m) => {
      const [tx] = await m.query(`INSERT INTO app.ledger_transactions (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, actor_id, effective_at)
        VALUES ($1, $2, 'referral-test', 'prediction_bet', gen_random_uuid(), 'user', $3, now()) RETURNING id`, [type, `test:${randomUUID()}`, user])
      await m.query(`INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount) VALUES ($1, $2, 'debit', $3)`, [tx.id, fundingAccount, amount.toString()])
      const [entry] = await m.query(`INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount) VALUES ($1, $2, 'credit', $3) RETURNING id`,
        [tx.id, feeAccount, amount.toString()])
      const created = await recordReferralRewards(m, {
        kind: 'fee', sourceType: 'prediction_fee', component: type === 'prediction_stake' ? 'prediction_place' : 'prediction_payout',
        sourceId: entry.id, sourceUserId: user, baseAtomic: amount,
      })
      return { entryId: entry.id as string, created }
    })
  }

  const rewardsOf = (user: string) => db.query(`SELECT kind, level, amount_atomic::text AS amount, state FROM app.referral_rewards WHERE user_id = $1 ORDER BY earned_at, level`, [user])

  it('pays a one-time purchase rebate to three ancestors at the configured rates', async () => {
    const { created } = await purchase(u.D, 100_000_000n)  // 100 USDT
    expect(created.map((row) => [row.userId, row.level, row.amountAtomic])).toEqual([
      [u.C, 1, '6000000'], [u.B, 2, '3000000'], [u.A, 3, '1000000'],
    ])
  })

  it('pays fee rebates on prediction fees, never beyond level 3', async () => {
    const { created } = await predictionFee(u.E, 30_000n)  // 0.03 USDT fee
    expect(created.map((row) => [row.userId, row.level, row.amountAtomic])).toEqual([
      [u.D, 1, '6000'], [u.C, 2, '3000'], [u.B, 3, '1500'],
    ])
    expect((await rewardsOf(u.A)).map((row: { kind: string }) => row.kind)).toEqual(['purchase'])
  })

  it('is idempotent per source and ignores users without an inviter', async () => {
    const { orderId } = await purchase(u.D, 10_000_000n)
    const replay = await db.transaction((m) => recordReferralRewards(m, { kind: 'purchase', sourceType: 'order', sourceId: orderId, sourceUserId: u.D, baseAtomic: 10_000_000n }))
    expect(replay).toEqual([])
    expect((await purchase(u.A, 50_000_000n)).created).toEqual([])
    expect((await purchase(u.X, 50_000_000n)).created).toEqual([])
  })

  it('lets the database reject rewards that are not backed by a real source, ancestor and rate', async () => {
    const { orderId } = await purchase(u.X, 20_000_000n)
    const [settings] = await db.query('SELECT max(version) AS version FROM app.referral_settings')
    const insert = (userId: string, level: number, rate: number, base: string, amount: string, source = orderId) => db.query(
      `INSERT INTO app.referral_rewards (user_id, source_user_id, kind, source_type, source_id, level, settings_version, rate_bps, base_atomic, amount_atomic)
       VALUES ($1, $2, 'purchase', 'order', $3, $4, $5, $6, $7, $8)`, [userId, u.X, source, level, settings.version, rate, base, amount])
    // X has no inviter: nobody is an ancestor.
    await expect(insert(u.A, 1, 600, '20000000', '1200000')).rejects.toMatchObject({ code: '23514' })
    const { orderId: dOrder } = await purchase(u.D, 20_000_000n)
    const forD = (userId: string, level: number, rate: number, base: string, amount: string) => db.query(
      `INSERT INTO app.referral_rewards (user_id, source_user_id, kind, source_type, source_id, level, settings_version, rate_bps, base_atomic, amount_atomic)
       VALUES ($1, $2, 'purchase', 'order', $3, $4, $5, $6, $7, $8)`, [userId, u.D, randomUUID(), level, settings.version, rate, base, amount])
    await expect(forD(u.C, 1, 600, '20000000', '1200000')).rejects.toMatchObject({ code: '23514' })        // no such order
    await expect(db.query(`INSERT INTO app.referral_rewards (user_id, source_user_id, kind, source_type, source_id, level, settings_version, rate_bps, base_atomic, amount_atomic)
       VALUES ($1, $2, 'purchase', 'order', $3, 1, $4, 9000, '20000000', '18000000')`, [u.C, u.D, dOrder, settings.version])).rejects.toMatchObject({ code: '23514' })  // wrong rate
    await expect(db.query(`INSERT INTO app.referral_rewards (user_id, source_user_id, kind, source_type, source_id, level, settings_version, rate_bps, base_atomic, amount_atomic)
       VALUES ($1, $2, 'purchase', 'order', $3, 1, $4, 600, '20000000', '1300000')`, [u.C, u.D, dOrder, settings.version])).rejects.toMatchObject({ code: '23514' })  // wrong amount
  })

  it('claims every earned reward into available USDT exactly once', async () => {
    const before = await read.summary(u.C)
    expect(BigInt(before.balances.available)).toBeGreaterThan(0n)
    const result = await claims.claim(u.C, 'claim-c-0001')
    expect(result.amountAtomic).toBe(before.balances.available)
    expect(result.replay).toBe(false)
    const replay = await claims.claim(u.C, 'claim-c-0001')
    expect(replay).toMatchObject({ claimId: result.claimId, amountAtomic: result.amountAtomic, replay: true })
    await expect(claims.claim(u.C, 'claim-c-0002')).rejects.toMatchObject({ response: { code: 'REFERRAL_NOTHING_TO_CLAIM' } })
    await expect(claims.claim(u.C, undefined)).rejects.toMatchObject({ response: { code: 'REFERRAL_CLAIM_KEY_REQUIRED' } })

    const [balance] = await db.query(`SELECT b.current_atomic_balance::text AS amount FROM app.ledger_accounts a JOIN app.ledger_account_balances b ON b.account_id = a.id
      WHERE a.owner_type = 'user' AND a.user_id = $1 AND a.purpose = 'available' AND a.asset_code = 'USDT'`, [u.C])
    expect(balance.amount).toBe(result.amountAtomic)
    const after = await read.summary(u.C)
    expect(after.balances).toEqual({ available: '0', claimed: result.amountAtomic, total: result.amountAtomic })
    expect((await rewardsOf(u.C)).every((row: { state: string }) => row.state === 'claimed')).toBe(true)
    const list = await read.rewards(u.C)
    expect(list.items[0]).toMatchObject({ state: 'claimed', currency: 'USDT', decimals: 6 })
    expect(['purchase', 'fee']).toContain(list.items[0].kind)
  })

  it('keeps the ledger balanced and reward facts immutable', async () => {
    const [sums] = await db.query(`SELECT sum(atomic_amount) FILTER (WHERE side = 'debit')::text AS debit, sum(atomic_amount) FILTER (WHERE side = 'credit')::text AS credit FROM app.ledger_entries`)
    expect(sums.debit).toBe(sums.credit)
    const [reward] = await db.query(`SELECT id FROM app.referral_rewards WHERE user_id = $1 LIMIT 1`, [u.B])
    await expect(db.query(`UPDATE app.referral_rewards SET amount_atomic = amount_atomic + 1 WHERE id = $1`, [reward.id])).rejects.toBeTruthy()
    await expect(db.query(`DELETE FROM app.referral_rewards WHERE id = $1`, [reward.id])).rejects.toBeTruthy()
    const [claim] = await db.query(`SELECT id FROM app.referral_reward_claims LIMIT 1`)
    await expect(db.query(`UPDATE app.referral_reward_claims SET amount_atomic = 1 WHERE id = $1`, [claim.id])).rejects.toBeTruthy()
  })

  it('stops paying a kind when the settings switch it off', async () => {
    await db.query(`INSERT INTO app.referral_settings (config, fee_effective_at, holding_effective_at, team_effective_at)
      VALUES ($1, now(), now(), now())`, [JSON.stringify({ ...REFERRAL_DEFAULT_SETTINGS, feeEnabled: false, holdingEnabled: false })])
    expect((await purchase(u.D, 10_000_000n)).created).toEqual([])
    expect((await predictionFee(u.E, 30_000n, 'prediction_payout')).created).toEqual([])
  })
})
