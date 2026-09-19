import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { OperationalCapabilityService } from '../../src/operations/operational-capability.service'
import { PolymarketService } from '../../src/polymarket/polymarket.service'
import { PredictionService, parseDecimal18, formatDecimal18 } from '../../src/prediction/prediction.service'

jest.setTimeout(180_000)

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

/** 测试环境放行所有开关（生产由环境变量 + operational_switches 行控制） */
const allowAll = {
  assertEnabled: async () => undefined,
  isEnabled: async () => true,
} as unknown as OperationalCapabilityService

const TAG = `t-pred-${Date.now()}`

describeDatabase('prediction internal market (route A) — betting + settlement', () => {
  let ds: DataSource
  let prediction: PredictionService
  let faucetId: string
  let userId: string
  let userId2: string
  let marketId: string
  let yesTokenId: string
  let noTokenId: string

  const polymarket = {
    getOrderBook: async (tokenId: string) => ({
      tokenId,
      conditionId: null,
      hash: 'test-book',
      bids: [{ price: '0.60', size: '500' }],
      asks: [{ price: '0.62', size: '500' }],
      tickSize: '0.01',
      minOrderSize: '1',
      lastTradePrice: '0.60',
      negRisk: false,
      asOf: new Date(),
      stale: false,
    }),
  } as unknown as PolymarketService

  const availableBalance = async (uid: string): Promise<bigint> => {
    const [row] = await ds.query(
      `SELECT COALESCE(b.current_atomic_balance, 0)::text AS amount
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.owner_type = 'user' AND a.user_id = $1 AND a.purpose = 'available' AND a.asset_code = 'USDT'`,
      [uid],
    )
    return BigInt(row?.amount ?? '0')
  }

  const fundUser = async (uid: string, atomic: string) => {
    const tx = randomUUID()
    await ds.query(
      `INSERT INTO app.ledger_transactions (id, transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
       VALUES ($1, 'deposit', $2, 't-pred-seed', 'test_faucet', $3, 'service', now())`,
      [tx, `${TAG}-fund:${tx}`, faucetId],
    )
    const [account] = await ds.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING RETURNING id`,
      [uid],
    )
    const accountId = account?.id ?? (
      await ds.query(
        `SELECT id FROM app.ledger_accounts WHERE owner_type = 'user' AND user_id = $1 AND purpose = 'available' AND asset_code = 'USDT'`,
        [uid],
      )
    )[0].id
    await ds.query(
      `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
       VALUES ($1, $2, 'credit', $4), ($1, $3, 'debit', $4)`,
      [tx, accountId, faucetId, atomic],
    )
  }

  const cleanup = async () => {
    await ds.query(`DELETE FROM app.prediction_settlement_runs WHERE market_mapping_id IN (SELECT id FROM app.polymarket_market_mappings WHERE slug LIKE '${TAG}%')`)
    await ds.query(`DELETE FROM app.prediction_bets WHERE market_mapping_id IN (SELECT id FROM app.polymarket_market_mappings WHERE slug LIKE '${TAG}%')`)
    await ds.query(`DELETE FROM app.prediction_bets WHERE user_id IN (SELECT id FROM app.users WHERE id IN ($1::uuid, $2::uuid))`, [userId ?? randomUUID(), userId2 ?? randomUUID()])
    await ds.query(`DELETE FROM app.polymarket_token_mappings WHERE market_mapping_id IN (SELECT id FROM app.polymarket_market_mappings WHERE slug LIKE '${TAG}%')`)
    await ds.query(`DELETE FROM app.polymarket_market_mappings WHERE slug LIKE '${TAG}%'`)
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await ds.initialize()
    prediction = new PredictionService(ds, allowAll, polymarket)

    // 水龙头账户（测试注资用）
    const [faucet] = await ds.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('platform', $1, 'settlement', 'USDT', 6, 'debit') RETURNING id`,
      [`${TAG}-faucet`],
    )
    faucetId = faucet.id

    const [u1] = await ds.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [u2] = await ds.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    userId = u1.id
    userId2 = u2.id

    const [market] = await ds.query(
      `INSERT INTO app.polymarket_market_mappings
        (gamma_market_id, condition_id, slug, question, state, restricted, enable_order_book, last_synced_at)
       VALUES ($1, $2, $3, 'T-PRED test market?', 'active', false, true, now()) RETURNING id`,
      [`${TAG}-gamma`, `${TAG}-cond`, TAG],
    )
    marketId = market.id

    const yes = randomUUID()
    const no = randomUUID()
    await ds.query(
      `INSERT INTO app.polymarket_token_mappings (market_mapping_id, token_id, outcome, outcome_index, state)
       VALUES ($1, $2, 'Yes', 0, 'active'), ($1, $3, 'No', 1, 'active')`,
      [marketId, `yes-${yes}`, `no-${no}`],
    )
    yesTokenId = `yes-${yes}`
    noTokenId = `no-${no}`

    // 初始资金：u1 100 USDT、u2 100 USDT
    await fundUser(userId, '100000000')
    await fundUser(userId2, '100000000')
  })

  afterAll(async () => {
    await cleanup()
    await ds.destroy()
  })

  it('价格定标工具函数正确', () => {
    expect(parseDecimal18('0.62')).toBe(620000000000000000n)
    expect(parseDecimal18('1')).toBe(1000000000000000000n)
    expect(formatDecimal18(620000000000000000n)).toBe('0.62')
    expect(formatDecimal18(16129032258064516129n)).toBe('16.129032258064516129')
  })

  it('余额不足时拒绝下注', async () => {
    const [poor] = await ds.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    await expect(
      prediction.placeBet(poor.id, 't', { tokenId: yesTokenId, stakeAtomic: '1000000', idempotencyKey: 'poor-1' }),
    ).rejects.toMatchObject({ response: { code: 'PREDICTION_INSUFFICIENT_BALANCE' } })
  })

  it('正常下注：锁定价格、计算份额、划转余额', async () => {
    const before = await availableBalance(userId)
    const bet = await prediction.placeBet(userId, 't', {
      tokenId: yesTokenId, stakeAtomic: '10000000', idempotencyKey: 'bet-a',
    })
    expect(bet.status).toBe('placed')
    expect(parseDecimal18(bet.price)).toBe(620000000000000000n)
    // shares = 10e6 × 1e36 / (0.62e18 × 1e6)
    expect(parseDecimal18(bet.shares)).toBe((10_000_000n * 10n ** 36n) / (620000000000000000n * 10n ** 6n))
    const after = await availableBalance(userId)
    expect(before - after).toBe(10_000_000n)
  })

  it('相同幂等键重复提交只记一笔', async () => {
    const again = await prediction.placeBet(userId, 't', {
      tokenId: yesTokenId, stakeAtomic: '10000000', idempotencyKey: 'bet-a',
    })
    expect(again.duplicate).toBe(true)
    const [count] = await ds.query(
      `SELECT COUNT(*)::int AS n FROM app.prediction_bets WHERE user_id = $1 AND idempotency_key = 'bet-a'`,
      [userId],
    )
    expect(count.n).toBe(1)
  })

  it('单笔超过 100 USDT 上限被拒', async () => {
    await expect(
      prediction.placeBet(userId, 't', { tokenId: yesTokenId, stakeAtomic: '200000000', idempotencyKey: 'bet-over' }),
    ).rejects.toMatchObject({ response: { code: 'PREDICTION_STAKE_LIMIT_EXCEEDED' } })
  })

  it('滑点超过 2% 被拒', async () => {
    await expect(
      prediction.placeBet(userId, 't', {
        tokenId: yesTokenId, stakeAtomic: '1000000', expectedPrice: '0.50', idempotencyKey: 'bet-slip',
      }),
    ).rejects.toMatchObject({ response: { code: 'PREDICTION_SLIPPAGE_EXCEEDED' } })
  })

  it('结算：赢家派彩、输家落定、账本精确平衡、幂等', async () => {
    // u2 买 NO
    await prediction.placeBet(userId2, 't', { tokenId: noTokenId, stakeAtomic: '10000000', idempotencyKey: 'bet-b' })
    const u1Before = await availableBalance(userId)
    const u2Before = await availableBalance(userId2)

    // 开奖：YES 赢（token 置 resolved）
    await ds.query(`UPDATE app.polymarket_token_mappings SET state = 'resolved' WHERE market_mapping_id = $1 AND outcome = 'Yes'`, [marketId])

    const result = await prediction.settleMarket(marketId)
    expect(result.settled).toBe(true)
    expect(result.outcome).toBe('resolved')
    expect(result.betsSettled).toBe(2)

    // u1（赢）：拿回 shares(=10e6×1e36/(0.62e18×1e6)) 的派彩
    const expectedPayout = (10_000_000n * 10n ** 36n) / (620000000000000000n * 10n ** 6n) / 10n ** 12n
    const u1After = await availableBalance(userId)
    expect(u1After - u1Before).toBe(expectedPayout)

    // u2（输）：无返还
    const u2After = await availableBalance(userId2)
    expect(u2After).toBe(u2Before)

    // 状态与结算批次
    const bets = await ds.query(`SELECT status FROM app.prediction_bets WHERE market_mapping_id = $1 ORDER BY user_id`, [marketId])
    expect(bets.map((b: { status: string }) => b.status).sort()).toEqual(['lost', 'won'])
    const [run] = await ds.query(`SELECT outcome, bets_settled FROM app.prediction_settlement_runs WHERE market_mapping_id = $1`, [marketId])
    expect(run.outcome).toBe('resolved')
    expect(run.bets_settled).toBe(2)

    // 幂等：重复结算不再处理
    const replay = await prediction.settleMarket(marketId)
    expect(replay.settled).toBe(false)

    // 账本守恒：该市场相关流水的借贷总额相等（复式记账不变量）
    const [balance] = await ds.query(
      `SELECT COALESCE(SUM(CASE WHEN e.side = 'credit' THEN e.atomic_amount ELSE -e.atomic_amount END), 0)::text AS net
       FROM app.ledger_entries e
       JOIN app.ledger_transactions t ON t.id = e.transaction_id
       WHERE t.reference_id IN (SELECT id FROM app.prediction_bets WHERE market_mapping_id = $1)`,
      [marketId],
    )
    expect(BigInt(balance.net)).toBe(0n)
  })

  it('我的投注列表可分页查询', async () => {
    const list = await prediction.listBets(userId, 1, 20)
    expect(list.total).toBeGreaterThanOrEqual(1)
    expect(list.items[0]).toHaveProperty('stakeAtomic')
  })
})
