import * as crypto from 'node:crypto'
import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { RewardsService } from '../../src/rewards/rewards.service'
import { DailyDrawV21793900000000 } from '../../src/database/migrations/1793900000000-daily-draw-v2'
import { WalletNetworkRegistry } from '../../src/wallet/wallet-network.registry'
import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'
import { LedgerService } from '../../src/ledger/ledger.service'
import { TransactionPinService } from '../../src/wallet/transaction-pin.service'
import { PredictionService } from '../../src/prediction/prediction.service'
import { realDeposit } from '../wallet/funds-security-fixture'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
const id = crypto.randomUUID
jest.setTimeout(180000)

// Uses committed, unique fixtures so competing requests run on different real connections.
// Immutable draws/points/ledger fixtures are intentionally retained in the isolated *_test database.
suite('daily rewards and coupon accounting with isolated PostgreSQL', () => {
  let db: DataSource, rewards: RewardsService, bridge: WalletLedgerBridge, ledger: LedgerService, pin: TransactionPinService
  let campaign: Record<string, any>, random: jest.SpyInstance, oldFee: string | undefined
  let fixtureUsers: string[] = []
  const networks = new WalletNetworkRegistry()
  const security = { assertRecentStepUp: () => undefined }
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    if ((await db.query('SELECT current_database() AS name'))[0].name !== decodeURIComponent(target.pathname.slice(1))) throw new Error('Unexpected test database')
    await db.runMigrations()
    rewards = new RewardsService(db, networks); bridge = new WalletLedgerBridge(db); ledger = new LedgerService(db)
    pin = new TransactionPinService(db, new ConfigService({ TRANSACTION_PIN_PEPPER: 'test-rewards-pepper-outside-db-at-least-32-bytes' }), security as never)
  })
  beforeEach(async () => {
    fixtureUsers = []
    ;[campaign] = await db.query("SELECT * FROM app.reward_campaigns WHERE id='daily_card_draw'")
    // Previous runs may retain immutable coupon draws. Leave ample headroom for each deterministic test.
    const [issued] = await db.query(`SELECT COALESCE(sum(max_discount_atomic),0)::text AS face FROM app.user_coupons
      WHERE (created_at AT TIME ZONE 'Asia/Singapore')::date=(now() AT TIME ZONE 'Asia/Singapore')::date`)
    await db.query("UPDATE app.reward_campaigns SET prize_version=1,exchange_coupon_kind='prediction_place_fee',exchange_coupon_max_atomic=500000,daily_coupon_budget_atomic=$1 WHERE id='daily_card_draw'", [(BigInt(issued.face) + 50000000n).toString()])
    random = jest.spyOn(crypto, 'randomInt').mockImplementation((() => 0) as never)
    oldFee = process.env.PREDICTION_FEE_BPS_PLACE; process.env.PREDICTION_FEE_BPS_PLACE = '300'
  })
  afterEach(async () => {
    random?.mockRestore()
    if (oldFee === undefined) delete process.env.PREDICTION_FEE_BPS_PLACE; else process.env.PREDICTION_FEE_BPS_PLACE = oldFee
    if (campaign) await db.query("UPDATE app.reward_campaigns SET enabled=$1,pilot_user_ids=$2,daily_coupon_budget_atomic=$3,prize_version=$4,exchange_coupon_kind=$5,exchange_coupon_max_atomic=$6 WHERE id='daily_card_draw'",
      [campaign.enabled, campaign.pilot_user_ids, campaign.daily_coupon_budget_atomic,campaign.prize_version,campaign.exchange_coupon_kind,campaign.exchange_coupon_max_atomic])
    // Keep shared community suites isolated from these committed card fixtures. Draws deliberately have no post FK.
    if (fixtureUsers.length) {
      await db.query('DELETE FROM app.community_posts WHERE profile_id IN (SELECT id FROM app.community_profiles WHERE user_id=ANY($1::uuid[]))', [fixtureUsers])
      await db.query('DELETE FROM app.community_profiles WHERE user_id=ANY($1::uuid[])', [fixtureUsers])
    }
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })
  async function user(card = true, age = '48 hours') {
    const uid = id()
    await db.query('INSERT INTO app.users(id,created_at) VALUES($1,now()-$2::interval)', [uid, age])
    fixtureUsers.push(uid)
    await db.query("UPDATE app.reward_campaigns SET pilot_user_ids=array_append(pilot_user_ids,$1) WHERE id='daily_card_draw'", [uid])
    const [p] = await db.query(`INSERT INTO app.community_profiles(user_id,handle,display_name,kind) VALUES($1,$2,'Rewards test','member') RETURNING id`, [uid, `r${uid.replace(/-/g, '').slice(0, 24)}`])
    let postId: string | null = null
    if (card) postId = await addCard(uid, p.id)
    return { uid, profileId: p.id as string, postId }
  }
  async function addCard(uid: string, profileId: string) {
    const [p] = await db.query(`INSERT INTO app.community_posts(profile_id,body,source,state,published_at) VALUES($1,'Rewards fixture','user','published',now()) RETURNING id`, [profileId])
    await db.query(`INSERT INTO app.community_post_cards(post_id,user_id,kind,source_refs,snapshot,visible_fields,calc_version)
      VALUES($1,$2,'quant_total','{}','{}',ARRAY['pnl'],1)`, [p.id, uid])
    return p.id as string
  }
  async function coupon(uid: string, kind = 'prediction_place_fee', face = '500000') {
    const [c] = await db.query(`INSERT INTO app.user_coupons(user_id,kind,max_discount_atomic,source,state,expires_at)
      VALUES($1,$2,$3,'draw','available',now()+interval '14 days') RETURNING id`, [uid, kind, face])
    return c.id as string
  }
  const couponState = async (cid: string) => (await db.query('SELECT state,locked_ref FROM app.user_coupons WHERE id=$1', [cid]))[0]
  async function prediction(uid: string, funded = true, price = '0.5') {
    if (funded) await realDeposit(db, uid, '100000000')
    const token = `reward-${id()}`
    const [m] = await db.query(`INSERT INTO app.polymarket_market_mappings(gamma_market_id,slug,condition_id,question,enable_order_book,state,last_synced_at)
      VALUES($1,$1,$1,'Rewards fixture?',true,'active',now()) RETURNING id`, [token])
    await db.query(`INSERT INTO app.polymarket_token_mappings(market_mapping_id,token_id,outcome,outcome_index,state)
      VALUES($1,$2,'YES',0,'active')`, [m.id, token])
    const service = new PredictionService(db, { assertEnabled: async () => undefined } as never, {
      getOrderBook: async (tokenId: string) => ({ tokenId, stale: false, fetchedAt: new Date(), asks: [{ price, size: '10000' }] }),
      getOutcomeProbability: async () => Number(price),
    } as never, { requireInvestmentEligibility: async () => undefined } as never)
    return { service, token, market: m.id as string }
  }
  async function withdrawal(uid: string, cid: string, amount = '10000000') {
    const deposit = await realDeposit(db, uid, '100000000')
    const actor = { userId: uid, sessionId: id(), deviceId: null }
    await pin.setup(actor, { pin: '012345', confirmation: '012345', reauthentication: 'fixture-step-up' }, id())
    const input = { id: id(), userId: uid, walletId: deposit.walletId, network: 'tron' as const, atomicAmount: amount, feeAtomicAmount: '1000000',
      couponId: cid, destinationHash: Buffer.from(id()), destinationCiphertext: Buffer.from('encrypted'), encryptionKeyVersion: 1,
      addressBookEntryId: null, policySnapshot: {}, perTransactionLimitAtomic: null, dailyLimitAtomic: null, idempotencyKey: id(),
      state: 'risk_review' as const, reasonCode: null, requestId: id(), transactionPinVersion: 1 }
    await bridge.createWithdrawalWithLock(input)
    return input
  }
  it('draws twice and replays a key with one immutable draw and one credit', async () => {
    const { uid, postId, profileId } = await user(), key = id()
    const a = await rewards.draw(uid, key, null)
    expect(await rewards.draw(uid, id(), null)).toEqual(a)
    await db.query("UPDATE app.community_posts SET state='removed' WHERE id=$1", [postId])
    await addCard(uid, profileId)
    expect(await rewards.draw(uid, key, null)).toEqual(a)
    expect(await rewards.today(uid)).toMatchObject({ eligible: false, reason: 'drawn', draw: { id: a.id } })
    expect((await db.query('SELECT id FROM app.reward_draws WHERE user_id=$1', [uid]))).toHaveLength(1)
    expect((await rewards.wallet(uid)).points).toBe(10)
  })
  it('serializes concurrent draws on separate connections', async () => {
    const { uid } = await user()
    const [a,b] = await Promise.all([rewards.draw(uid, id(), null), rewards.draw(uid, id(), null)])
    expect(a.id).toBe(b.id)
    expect(await db.query('SELECT id FROM app.reward_draws WHERE user_id=$1', [uid])).toHaveLength(1)
    expect(await db.query('SELECT id FROM app.user_points_ledger WHERE user_id=$1', [uid])).toHaveLength(1)
  })
  it('rejects deleted, revoked or yesterday cards, and accounts younger than 24 hours', async () => {
    for (const mode of ['removed', 'deleted', 'revoked', 'yesterday']) {
      const { uid, postId } = await user()
      if (mode === 'deleted') await db.query('DELETE FROM app.community_posts WHERE id=$1', [postId])
      else if (mode === 'revoked') await db.query('UPDATE app.community_post_cards SET revoked_at=now() WHERE post_id=$1', [postId])
      else if (mode === 'yesterday') await db.query("UPDATE app.community_posts SET created_at=((now() AT TIME ZONE 'Asia/Singapore')::date-1)::timestamp AT TIME ZONE 'Asia/Singapore' WHERE id=$1", [postId])
      else await db.query("UPDATE app.community_posts SET state='removed' WHERE id=$1", [postId])
      expect(await rewards.today(uid)).toMatchObject({ eligible: false, reason: 'no_card_today' })
      await expect(rewards.draw(uid, id(), null)).rejects.toMatchObject({ response: { code: 'REWARD_NOT_ELIGIBLE', reason: 'no_card_today' } })
    }
    const { uid } = await user(true, '23 hours')
    await expect(rewards.draw(uid, id(), null)).rejects.toMatchObject({ response: { reason: 'too_new' } })
    await db.query("UPDATE app.users SET created_at=now()-interval '24 hours' WHERE id=$1", [uid])
    expect(await rewards.today(uid)).toMatchObject({ eligible: true })
  })
  it('freezes the third distinct user on an IP, without crediting frozen points', async () => {
    const ip = `2001:db8:${id().slice(0,4)}:${id().slice(0,4)}::1`
    for (let n = 0; n < 3; n++) {
      const { uid } = await user(), draw = await rewards.draw(uid, id(), ip)
      expect(draw.state).toBe(n === 2 ? 'frozen' : 'granted')
      if (n === 2) {
        expect((await rewards.wallet(uid)).points).toBe(0)
        expect(await rewards.today(uid)).toMatchObject({ reason: 'frozen' })
        expect((await db.query('SELECT frozen_reason FROM app.reward_draws WHERE id=$1', [draw.id]))[0].frozen_reason).toBe('shared_ip')
      }
    }
  })
  it('uses the SQL SG date, snapshots coupon TTL and falls back after the budget is spent', async () => {
    random.mockImplementation((() => 85) as never)
    const a = await user(), draw = await rewards.draw(a.uid, id(), null)
    expect(draw.sgDate).toBe((await db.query("SELECT (now() AT TIME ZONE 'Asia/Singapore')::date::text AS day"))[0].day)
    expect(draw.prize.kind).toBe('coupon')
    if (draw.prize.kind === 'coupon') {
      expect(draw.prize.coupon.maxDiscountAtomic).toBe('500000')
      expect(Date.parse(draw.prize.coupon.expiresAt)-Date.parse(draw.prize.coupon.createdAt)).toBe(14*86400000)
    }
    await db.query("UPDATE app.reward_campaigns SET daily_coupon_budget_atomic=0 WHERE id='daily_card_draw'")
    const b = await user()
    expect((await rewards.draw(b.uid, id(), null)).prize).toEqual({ kind: 'points', points: 10, voucher:null, coupon:null })
  })
  it('keeps a pilot or owner live, hides non-owners, and exchanges once without a negative balance under concurrency', async () => {
    const { uid } = await user(false)
    await db.query("UPDATE app.reward_campaigns SET enabled=false,pilot_user_ids=array_remove(pilot_user_ids,$1) WHERE id='daily_card_draw'", [uid])
    await expect(rewards.wallet(uid)).rejects.toMatchObject({ status: 404 })
    await db.query("INSERT INTO app.user_points_ledger(user_id,delta,reason) VALUES($1,150,'admin')", [uid])
    expect((await rewards.wallet(uid)).points).toBe(150)
    const key = id(), results = await Promise.allSettled([rewards.exchange(uid, key), rewards.exchange(uid, id())])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')[0]).toMatchObject({ reason: { response: { code: 'REWARD_EXCHANGE_LIMIT' } } })
    const receipt = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<RewardsService['exchange']>>>
    expect(receipt.value.points).toBe(50)
    expect((await rewards.wallet(uid)).points).toBe(50)
    if (results[0].status === 'fulfilled') expect(await rewards.exchange(uid, key)).toEqual(receipt.value)
    const low = await user(false)
    await expect(rewards.exchange(low.uid, id())).rejects.toMatchObject({ response: { code: 'REWARD_POINTS_LOW' } })
  })
  it.each(['100000', '500000'])('charges only fee minus face %s and keeps the ledger balanced', async face => {
    const { uid } = await user(), cid = await coupon(uid, 'prediction_place_fee', face), p = await prediction(uid)
    const key = id(), bet = await p.service.placeBet(uid, id(), { tokenId: p.token, stakeAtomic: '10000000', idempotencyKey: key, couponId: cid })
    const discount = BigInt(face) < 300000n ? BigInt(face) : 300000n
    expect(bet).toMatchObject({ feeAtomic: (300000n-discount).toString(), feeDiscountAtomic: discount.toString(), couponId: cid, riskStakeAtomic: (9700000n+discount).toString() })
    expect(await couponState(cid)).toMatchObject({ state: 'used' })
    const [sum] = await db.query(`SELECT sum(CASE side WHEN 'credit' THEN atomic_amount ELSE -atomic_amount END)::text AS net,
      sum(atomic_amount) FILTER(WHERE a.owner_reference='prediction_fee')::text AS fee
      FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
      JOIN app.ledger_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key=$1`, [`prediction_stake:${bet.id}`])
    expect(BigInt(sum.net)).toBe(0n); expect(BigInt(sum.fee ?? '0')).toBe(300000n-discount)
    await db.query("UPDATE app.polymarket_market_mappings SET state='resolved' WHERE id=$1", [p.market])
    expect((await p.service.placeBet(uid, id(), { tokenId: p.token, stakeAtomic: '10000000', idempotencyKey: key, couponId: cid })).id).toBe(bet.id)
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1', [cid])).toHaveLength(1)
  })
  it('allows one of two concurrent bets to consume the same coupon', async () => {
    const { uid } = await user(), cid = await coupon(uid), p = await prediction(uid)
    const results = await Promise.allSettled([1,2].map(() => p.service.placeBet(uid, id(), { tokenId: p.token, stakeAtomic: '10000000', idempotencyKey: id(), couponId: cid })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')[0]).toMatchObject({ reason: { response: { code: 'REWARD_COUPON_INVALID' } } })
    expect(await db.query('SELECT id FROM app.prediction_bets WHERE coupon_id=$1', [cid])).toHaveLength(1)
  })
  it('rolls coupon consumption and redemption back when ledger posting fails', async () => {
    const { uid } = await user(), cid = await coupon(uid), p = await prediction(uid)
    // Force a genuine SQL failure after INSERT bet + coupon redemption, inside the existing order transaction.
    const realRunner = db.createQueryRunner.bind(db)
    const spy = jest.spyOn(db, 'createQueryRunner').mockImplementation(() => {
      const runner = realRunner(), query = runner.query.bind(runner)
      runner.query = ((sql: string, args?: any[], structured?: boolean) => {
        const statement = sql.includes('INSERT INTO app.ledger_entries') ? 'SELECT 1/0' : sql
        return structured ? query(statement, args, true) : query(statement, args)
      }) as typeof runner.query
      return runner
    })
    try {
      await expect(p.service.placeBet(uid, id(), { tokenId: p.token, stakeAtomic: '10000000', idempotencyKey: id(), couponId: cid })).rejects.toBeDefined()
    } finally { spy.mockRestore() }
    expect(await couponState(cid)).toMatchObject({ state: 'available' })
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1', [cid])).toHaveLength(0)
    expect(await db.query('SELECT id FROM app.prediction_bets WHERE coupon_id=$1', [cid])).toHaveLength(0)
  })
  it('locks a withdrawal coupon, refunds the reduced debit on admin rejection and releases the coupon', async () => {
    const { uid } = await user(), cid = await coupon(uid, 'withdrawal_fee', '2000000'), w = await withdrawal(uid, cid)
    expect(await couponState(cid)).toMatchObject({ state: 'locked', locked_ref: w.id })
    expect((await db.query('SELECT fee_atomic_amount::text AS fee,fee_discount_atomic::text AS discount FROM app.withdrawals WHERE id=$1', [w.id]))[0]).toEqual({ fee: '0', discount: '1000000' })
    const [role] = await db.query('INSERT INTO app.admin_roles(name) VALUES($1) RETURNING id', [`rewards-${id()}`])
    const [admin] = await db.query('INSERT INTO app.admin_users(email,role_id) VALUES($1,$2) RETURNING id', [`rewards-${id()}@example.test`, role.id])
    await bridge.recordWithdrawalRejection({ withdrawalId: w.id, adminId: admin.id, reasonCode: 'test_reject', requestId: id() })
    expect(await couponState(cid)).toMatchObject({ state: 'available', locked_ref: null })
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1', [cid])).toHaveLength(0)
    const [balance] = await db.query(`SELECT b.current_atomic_balance::text AS amount FROM app.ledger_account_balances b JOIN app.ledger_accounts a ON a.id=b.account_id WHERE a.user_id=$1 AND a.purpose='available'`, [uid])
    expect(balance.amount).toBe('100000000')
  })
  it('returns a coupon on chain failure/demo refund and redeems only on completion, including duplicate callbacks', async () => {
    const failed = await user(), fc = await coupon(failed.uid, 'withdrawal_fee', '500000'), fw = await withdrawal(failed.uid, fc)
    // A broadcast withdrawal carries its chain transaction (withdrawals_check2).
    const [sent] = await db.query("INSERT INTO app.chain_transactions(network,transaction_hash,state,confirmation_count) VALUES('tron',$1,'failed',0) RETURNING id", [id()])
    await db.query("UPDATE app.withdrawals SET state='broadcast',chain_transaction_id=$2 WHERE id=$1", [fw.id, sent.id])
    await ledger.refundWithdrawal(fw.id, 'chain_failed', id())
    await ledger.refundWithdrawal(fw.id, 'duplicate_chain_failed', id())
    expect(await couponState(fc)).toMatchObject({ state: 'available' })
    const done = await user(), dc = await coupon(done.uid, 'withdrawal_fee', '500000'), dw = await withdrawal(done.uid, dc)
    const [chain] = await db.query("INSERT INTO app.chain_transactions(network,transaction_hash,state,confirmation_count,confirmed_at) VALUES('tron',$1,'confirmed',30,now()) RETURNING id", [id()])
    await db.query("UPDATE app.withdrawals SET state='confirming',chain_transaction_id=$2 WHERE id=$1", [dw.id, chain.id])
    await ledger.settleWithdrawal(dw.id, chain.id, id()); await ledger.settleWithdrawal(dw.id, chain.id, id())
    expect(await couponState(dc)).toMatchObject({ state: 'used', locked_ref: null })
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1', [dc])).toHaveLength(1)
  })
  async function enableV2() {
    await db.query("UPDATE app.reward_campaigns SET prize_version=2,daily_coupon_budget_atomic=300000000,exchange_coupon_kind='prediction_stake',exchange_coupon_max_atomic=1000000 WHERE id='daily_card_draw'")
  }
  async function accountBalance(uid: string) {
    const [r] = await db.query(`SELECT COALESCE(b.current_atomic_balance,0)::text AS amount FROM app.ledger_accounts a
      LEFT JOIN app.ledger_account_balances b ON b.account_id=a.id WHERE a.user_id=$1 AND a.purpose='available' AND a.asset_code='USDT' AND a.network IS NULL`, [uid])
    return BigInt(r?.amount ?? '0')
  }
  async function voucherBet() {
    const { uid } = await user()
    await realDeposit(db,uid)
    const p=await prediction(uid,false), cid=await coupon(uid,'prediction_stake','1000000')
    // Give this fixture a real balanced pool bankroll; winning payouts must not rely on previous tests.
    await db.transaction(async q=>{
      const [faucet]=await q.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES('platform',$1,'settlement','USDT',6,'debit') RETURNING id`,[`rewards-pool-faucet:${id()}`])
      await q.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES('platform','prediction_pool','settlement','USDT',6,'credit') ON CONFLICT DO NOTHING`)
      const [pool]=await q.query("SELECT id FROM app.ledger_accounts WHERE owner_type='platform' AND owner_reference='prediction_pool' AND purpose='settlement' AND asset_code='USDT'")
      const [tx]=await q.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,effective_at,reason_code)
        VALUES('adjustment',$1,$1,'test_fixture',$2,'service',now(),'TEST_POOL_BANKROLL') RETURNING id`,[id(),id()])
      await q.query("INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',10000000),($1,$3,'credit',10000000)",[tx.id,faucet.id,pool.id])
    })
    const key=id(), input={ tokenId:p.token,stakeAtomic:'1000000',voucherId:cid,idempotencyKey:key }
    return { uid,p,cid,input }
  }
  async function assertBalanced(betId: string) {
    const sums = await db.query(`SELECT t.id,sum(CASE e.side WHEN 'credit' THEN e.atomic_amount ELSE -e.atomic_amount END)::text AS net
      FROM app.ledger_transactions t JOIN app.ledger_entries e ON e.transaction_id=t.id WHERE t.reference_id=$1 GROUP BY t.id`, [betId])
    expect(sums.length).toBeGreaterThan(0)
    for (const r of sums) expect(BigInt(r.net)).toBe(0n)
  }
  it('v2 issues points and a 14-day voucher in one immutable draw with odds and a replay', async () => {
    await enableV2()
    const { uid }=await user(), key=id(), draw=await rewards.draw(uid,key,null)
    expect(draw).toMatchObject({ serial:expect.stringMatching(/^AR-[A-Z2-7]{8}$/),tier:'common',prize:{ points:10,coupon:null,voucher:{ kind:'prediction_stake',maxDiscountAtomic:'1000000',state:'available' } } })
    expect(await rewards.draw(uid,key,null)).toEqual(draw)
    expect((await rewards.wallet(uid)).points).toBe(10)
    const [row]=await db.query('SELECT * FROM app.reward_draws WHERE id=$1',[draw.id])
    expect(row).toMatchObject({ points:10,points_code:'points_10',coupon_id:draw.prize.voucher!.id,prize_version:2 })
    expect(Date.parse(draw.prize.voucher!.expiresAt)-Date.parse(draw.prize.voucher!.createdAt)).toBe(14*86400000)
    const odds=await rewards.odds(uid)
    expect(odds.version).toBe(2)
    expect(odds.points.reduce((n,p)=>n+p.weight,0)).toBe(10000)
    expect(odds.vouchers.reduce((n,p)=>n+p.weight,0)).toBe(10000)
    expect(odds.vouchers.find(v=>v.faceAtomic==='100000000')).toMatchObject({ weight:10,dailyCap:1 })
  })
  it('v2 freezes both prizes for the third signed-IP user without crediting points', async () => {
    await enableV2()
    const ip=`2001:db8:${id().slice(0,4)}:${id().slice(0,4)}::2`
    for (let n=0;n<3;n++) {
      const { uid }=await user(), d=await rewards.draw(uid,id(),ip)
      expect(d.state).toBe(n===2?'frozen':'granted')
      expect(d.prize.voucher!.state).toBe(n===2?'frozen':'available')
      expect((await rewards.wallet(uid)).points).toBe(n===2?0:10)
    }
  })
  it('v2 always issues the base voucher at zero budget and exchanges without consuming draw budget', async () => {
    await enableV2()
    await db.query("UPDATE app.reward_campaigns SET daily_coupon_budget_atomic=0 WHERE id='daily_card_draw'")
    random.mockImplementation((() => 9999) as never)
    const { uid }=await user(), d=await rewards.draw(uid,id(),null)
    expect(d.prize).toMatchObject({ points:500,voucher:{ maxDiscountAtomic:'1000000' } })
    await db.query("INSERT INTO app.user_points_ledger(user_id,delta,reason) VALUES($1,100,'admin')",[uid])
    const receipt=await rewards.exchange(uid,id())
    expect(receipt.coupon).toMatchObject({ kind:'prediction_stake',source:'exchange',maxDiscountAtomic:'1000000' })
    expect((await rewards.wallet(uid)).exchange).toMatchObject({ couponKind:'prediction_stake',maxDiscountAtomic:'1000000',canExchange:false })
  })
  it('voucher bet debits promo, preserves user balance, waives fee and replays after voucher consumption', async () => {
    const { uid,p,cid,input }=await voucherBet(), before=await accountBalance(uid)
    const bet=await p.service.placeBet(uid,id(),input)
    expect(bet).toMatchObject({ voucherId:cid,funding:'voucher',couponId:null,feeAtomic:'0',feeDiscountAtomic:'0',riskStakeAtomic:'1000000',shares:expect.stringMatching(/^2(.0+)?$/) })
    expect(await accountBalance(uid)).toBe(before)
    const entries=await db.query(`SELECT a.purpose,e.side,e.atomic_amount::text AS amount FROM app.ledger_entries e
      JOIN app.ledger_accounts a ON a.id=e.account_id JOIN app.ledger_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key=$1`,[`prediction_stake:${bet.id}`])
    expect(entries).toEqual(expect.arrayContaining([{ purpose:'promo_expense',side:'debit',amount:'1000000' },{ purpose:'settlement',side:'credit',amount:'1000000' }]))
    expect(entries).toHaveLength(2)
    expect((await db.query('SELECT fee_before_atomic::text AS fee,discount_atomic::text AS discount FROM app.coupon_redemptions WHERE coupon_id=$1',[cid]))[0]).toEqual({ fee:'0',discount:'1000000' })
    expect(await couponState(cid)).toMatchObject({ state:'used' })
    expect(await p.service.placeBet(uid,id(),input)).toMatchObject({ id:bet.id,duplicate:true,funding:'voucher' })
    await assertBalanced(String(bet.id))
  })
  it('a winning voucher pays the full normal net payout including returned stake', async () => {
    const { uid,p,input }=await voucherBet(), before=await accountBalance(uid)
    const bet=await p.service.placeBet(uid,id(),input)
    await db.query("UPDATE app.polymarket_token_mappings SET state='resolved' WHERE token_id=$1",[p.token])
    const settled=await p.service.settleMarket(p.market)
    const final=await p.service.getBet(uid,String(bet.id))
    expect(final.status).toBe('won')
    expect(await accountBalance(uid)-before).toBe(2000000n-BigInt(final.payoutFeeAtomic))
    expect(settled.totalPaidAtomic).toBe((2000000n-BigInt(final.payoutFeeAtomic)).toString())
    await assertBalanced(String(bet.id))
  })
  it('void credits promo, extends expiry, restores the voucher and retains both redemption receipts on reuse', async () => {
    const { uid,p,cid,input }=await voucherBet(), before=await accountBalance(uid)
    const bet=await p.service.placeBet(uid,id(),input)
    await db.query("UPDATE app.user_coupons SET expires_at=now()-interval '1 day' WHERE id=$1",[cid])
    await db.query("INSERT INTO app.polymarket_token_mappings(market_mapping_id,token_id,outcome,outcome_index,state) VALUES($1,$2,'NO',1,'resolved')",[p.market,`no-${id()}`])
    await db.query("UPDATE app.polymarket_token_mappings SET state='resolved' WHERE token_id=$1",[p.token])
    await p.service.settleMarket(p.market)
    expect(await accountBalance(uid)).toBe(before)
    expect(await couponState(cid)).toMatchObject({ state:'available' })
    expect((await db.query("SELECT expires_at>=now()+interval '3 days'-interval '5 seconds' AS extended FROM app.user_coupons WHERE id=$1",[cid]))[0].extended).toBe(true)
    const [refund]=await db.query(`SELECT a.purpose,e.atomic_amount::text AS amount FROM app.ledger_entries e JOIN app.ledger_accounts a ON a.id=e.account_id
      JOIN app.ledger_transactions t ON t.id=e.transaction_id WHERE t.idempotency_key=$1 AND e.side='credit'`,[`prediction_void_refund:${bet.id}`])
    expect(refund).toEqual({ purpose:'promo_expense',amount:'1000000' })
    await assertBalanced(String(bet.id))
    expect((await p.service.settleMarket(p.market)).settled).toBe(false)
    const next=await prediction(uid,false)
    await next.service.placeBet(uid,id(),{ ...input,tokenId:next.token,idempotencyKey:id() })
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1',[cid])).toHaveLength(2)
  })
  it('only one concurrent bet can consume a voucher', async () => {
    const { uid,p,cid,input }=await voucherBet()
    const results=await Promise.allSettled([1,2].map(()=>p.service.placeBet(uid,id(),{ ...input,idempotencyKey:id() })))
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect(results.find(r=>r.status==='rejected')).toMatchObject({ reason:{ response:{ code:'REWARD_COUPON_INVALID' } } })
    expect(await db.query('SELECT id FROM app.prediction_bets WHERE voucher_id=$1',[cid])).toHaveLength(1)
  })
  it('rejects missing deposit, high price, mismatched stake, mixed coupons and opposing voucher outcomes', async () => {
    const { uid }=await user(), cid=await coupon(uid,'prediction_stake','1000000'), p=await prediction(uid,false)
    const input={ tokenId:p.token,voucherId:cid,stakeAtomic:'1000000',idempotencyKey:id() }
    await expect(p.service.placeBet(uid,id(),input)).rejects.toMatchObject({ response:{ code:'REWARD_VOUCHER_DEPOSIT_REQUIRED' } })
    await realDeposit(db,uid,'300000000') // Exact threshold is insufficient.
    await expect(p.service.placeBet(uid,id(),input)).rejects.toMatchObject({ response:{ code:'REWARD_VOUCHER_DEPOSIT_REQUIRED' } })
    await realDeposit(db,uid)
    await expect(p.service.placeBet(uid,id(),{ ...input,stakeAtomic:'999999' })).rejects.toMatchObject({ status:400,response:{ code:'REWARD_VOUCHER_STAKE' } })
    await expect(p.service.placeBet(uid,id(),{ ...input,couponId:cid })).rejects.toMatchObject({ status:400 })
    const high=await prediction(uid,false,'0.91')
    await expect(high.service.placeBet(uid,id(),{ ...input,tokenId:high.token })).rejects.toMatchObject({ response:{ code:'REWARD_VOUCHER_PRICE' } })
    await p.service.placeBet(uid,id(),input)
    const second=await coupon(uid,'prediction_stake','1000000'), no=`no-${id()}`
    await db.query("INSERT INTO app.polymarket_token_mappings(market_mapping_id,token_id,outcome,outcome_index,state) VALUES($1,$2,'NO',1,'active')",[p.market,no])
    await expect(p.service.placeBet(uid,id(),{ ...input,tokenId:no,voucherId:second,idempotencyKey:id() })).rejects.toMatchObject({ response:{ code:'REWARD_VOUCHER_HEDGE' } })
    expect(await couponState(second)).toMatchObject({ state:'available' })
    await expect(p.service.placeBet(uid,id(),{ ...input,voucherId:second,idempotencyKey:id() })).resolves.toMatchObject({ funding:'voucher' })
  })
  it('rolls voucher consumption back if posting fails', async () => {
    const { uid,p,cid,input }=await voucherBet()
    const original=db.createQueryRunner.bind(db)
    const spy=jest.spyOn(db,'createQueryRunner').mockImplementation(()=>{
      const runner=original(), query=runner.query.bind(runner)
      runner.query=((sql:string,args?:any[],structured?:boolean)=> {
        const statement=sql.includes('INSERT INTO app.ledger_entries')?'SELECT 1/0':sql
        return structured?query(statement,args,true):query(statement,args)
      }) as typeof runner.query
      return runner
    })
    try { await expect(p.service.placeBet(uid,id(),input)).rejects.toBeDefined() } finally { spy.mockRestore() }
    expect(await couponState(cid)).toMatchObject({ state:'available' })
    expect(await db.query('SELECT id FROM app.coupon_redemptions WHERE coupon_id=$1',[cid])).toHaveLength(0)
  })
  it('supports v2 up twice and non-destructive down/up with historical draws and pilot ids intact', async () => {
    await enableV2()
    const { uid }=await user(), draw=await rewards.draw(uid,id(),null)
    const q = db.createQueryRunner(); await q.connect(); await q.startTransaction()
    try {
      const migration = new DailyDrawV21793900000000()
      await migration.up(q); await migration.up(q); await migration.down(q)
      expect((await q.query("SELECT prize_version FROM app.reward_campaigns WHERE id='daily_card_draw'"))[0].prize_version).toBe(1)
      expect((await q.query("SELECT to_regclass('app.prediction_bets') AS name"))[0].name).not.toBeNull()
      await migration.up(q)
      expect((await q.query("SELECT enabled,pilot_user_ids,prize_version,daily_coupon_budget_atomic::text AS budget FROM app.reward_campaigns WHERE id='daily_card_draw'"))[0]).toMatchObject({ enabled:campaign.enabled,prize_version:2,budget:'300000000',pilot_user_ids:expect.arrayContaining([uid]) })
      expect(await q.query('SELECT id FROM app.reward_draws WHERE id=$1',[draw.id])).toHaveLength(1)
      expect(await q.query("SELECT code FROM app.reward_prizes WHERE version=1 AND campaign_id='daily_card_draw'")).toHaveLength(4)
    } finally { await q.rollbackTransaction(); await q.release() }
  })
})
