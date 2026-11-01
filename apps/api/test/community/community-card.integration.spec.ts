import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { CommunityService } from '../../src/community/community.service'
import { CommunityComment, CommunityFollow, CommunityLike, CommunityPost, CommunityProfile, CommunityQueueItem, CommunityReport, CommunityTopic, CommunityTranslation } from '../../src/community/community.entities'
import { PublicShareService } from '../../src/sharing/public-share.service'
import { cardsFor, resolveCard } from '../../src/community/community-card'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Result cards with isolated PostgreSQL', () => {
  let db: DataSource, runner: QueryRunner, scoped: DataSource, member: CommunityMemberService, community: CommunityService, shares: PublicShareService
  let owner: string, other: string, product: string, payout: string, bet: string, deposit: string, circle: string
  const location = { city: 'Singapore', countryCode: 'SG', source: 'device' as const }
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations()
  })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    scoped = { query: (sql: string, args?: unknown[]) => runner.query(sql, args), transaction: (work: any) => work(runner.manager) } as DataSource
    member = new CommunityMemberService(scoped)
    const repos = [CommunityProfile, CommunityPost, CommunityComment, CommunityLike, CommunityFollow, CommunityTopic, CommunityQueueItem, CommunityReport, CommunityTranslation].map(e => runner.manager.getRepository(e))
    community = Reflect.construct(CommunityService, [...repos, {}, scoped]) as CommunityService
    shares = new PublicShareService(scoped)
    owner = randomUUID(); other = randomUUID(); product = randomUUID(); payout = randomUUID(); bet = randomUUID(); deposit = randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1),($2)', [owner, other])
    await member.updateProfile(owner, { displayName: 'Card owner', handle: 'card_owner', location })
    await member.updateProfile(other, { displayName: 'Other owner', handle: 'other_owner', location })
    await runner.query(`INSERT INTO app.quant_products(id,slug,name,first_trade_date,last_settled_date) VALUES($1,$2,'Card quant','2026-10-01','2026-10-31')`, [product, `card-${product}`])
    const order = randomUUID()
    await runner.query(`INSERT INTO app.quant_orders(id,product_id,user_id,kind,amount_atomic,principal_atomic,status,effective_date,idempotency_key,settled_at)
      VALUES($1::uuid,$2,$3,'subscription',100000000,100000000,'settled','2026-10-01',$1::text,now())`, [order, product, owner])
    await runner.query(`INSERT INTO app.quant_lots(product_id,user_id,order_id,original_atomic,principal_atomic,effective_date)
      VALUES($1,$2,$3,100000000,54000000,'2026-10-01')`, [product, owner, order])
    await runner.query(`INSERT INTO app.quant_orders(product_id,user_id,kind,amount_atomic,principal_atomic,fee_atomic,payout_atomic,status,effective_date,idempotency_key,settled_at)
      VALUES($1,$2,'redemption',36000000,36000000,360000,35640000,'settled','2026-10-31',$3,now())`, [product, owner, randomUUID()])
    const [settlement] = await runner.query(`INSERT INTO app.quant_daily_settlements(product_id,trade_date,gross_return_pct,status,entered_by,approved_by)
      VALUES($1,'2026-10-31',-10,'posted',$2,$3) RETURNING id`, [product, owner, other])
    await runner.query(`INSERT INTO app.quant_payouts(id,settlement_id,product_id,user_id,trade_date,principal_before_atomic,gross_atomic,mgmt_fee_atomic,perf_fee_atomic,net_atomic,paid_atomic)
      VALUES($1,$2,$3,$4,'2026-10-31',100000000,-10000000,0,0,-10000000,0)`, [payout, settlement.id, product, owner])
    const [market] = await runner.query(`INSERT INTO app.polymarket_market_mappings(gamma_market_id,slug,question,last_synced_at)
      VALUES($1,$1,'Fixture prediction?',now()) RETURNING id`, [randomUUID()])
    await runner.query(`INSERT INTO app.prediction_bets(id,user_id,market_mapping_id,token_id,side,stake_atomic,fee_atomic,payout_fee_atomic,shares,price,status,idempotency_key,settled_at)
      VALUES($1::uuid,$2,$3,'fixture','YES',10000000,100000,0,20,0.5,'void',$1::text,now())`, [bet, owner, market.id])
    const [wallet] = await runner.query(`INSERT INTO app.custody_wallets(user_id,provider,provider_wallet_hash,provider_wallet_ciphertext,encryption_key_version)
      VALUES($1,'test',$2,$2,1) RETURNING id`, [owner, Buffer.from(randomUUID())])
    const [address] = await runner.query(`INSERT INTO app.wallet_addresses(wallet_id,user_id,network,asset_code,asset_decimals,address_hash,address_ciphertext,encryption_key_version)
      VALUES($1,$2,'tron','USDT',6,$3,$3,1) RETURNING id`, [wallet.id, owner, Buffer.from(randomUUID())])
    const [chain] = await runner.query(`INSERT INTO app.chain_transactions(network,transaction_hash) VALUES('tron',$1) RETURNING id`, [randomUUID()])
    await runner.query(`INSERT INTO app.deposits(id,user_id,wallet_address_id,chain_transaction_id,asset_code,asset_decimals,atomic_amount,required_confirmations,state,credited_at)
      VALUES($1,$2,$3,$4,'USDT',6,9007199254740993123456789,1,'credited',now())`, [deposit, owner, address.id, chain.id])
    const [profile] = await runner.query('SELECT id FROM app.community_profiles WHERE user_id=$1', [owner])
    const [c] = await runner.query(`INSERT INTO app.community_circles(owner_user_id,owner_profile_id,name,public_no,invite_code) VALUES($1,$2,'Card circle',812345,$3) RETURNING id`, [owner, profile.id, randomUUID().replace(/-/g, '').slice(0, 10)])
    circle = c.id
  })
  afterEach(async () => { await runner.rollbackTransaction(); await runner.release() })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  it('refuses cards sourced from another account without publishing', async () => {
    for (const [kind, sourceId] of [['quant_product', product], ['prediction_bet', bet], ['deposit', deposit]] as const) {
      await expect(member.post(other, randomUUID(), { body: '', card: { kind, sourceId, visibleFields: [kind === 'deposit' ? 'amount' : kind === 'quant_product' ? 'pnl' : 'stake'] } })).rejects.toMatchObject({ status: 404 })
    }
    expect((await runner.query('SELECT post_id FROM app.community_post_cards')).length).toBe(0)
  })
  it('validates visibility, allows loss-only posts without location and preserves idempotency', async () => {
    await expect(member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: [] } })).rejects.toThrow('CARD_NOTHING_VISIBLE')
    await expect(member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: ['madeUp'] } })).rejects.toMatchObject({ status: 400 })
    const input = { body: '', clientRequestId: randomUUID(), card: { kind: 'quant_product' as const, sourceId: product, visibleFields: ['pnl', 'returnPct'] } }
    const a = await member.post(owner, undefined, input)
    expect(await member.post(owner, undefined, input)).toEqual({ id: a.id, duplicate: true })
    expect((await cardsFor(scoped, [a.id])).get(a.id)?.snapshot).toMatchObject({ pnl: '-10360000', returnPct: '-10.36', disclaimer: 'v1' })
    await expect(member.post(owner, randomUUID(), { body: 'ordinary post' })).rejects.toThrow('Device location required')
    expect((await resolveCard(scoped, owner, { kind: 'quant_total' }))).toMatchObject({ pnl: '-10360000', settledDays: 1, bestMonth: { month: '2026-10', pnl: '-10360000' } })
    expect((await resolveCard(scoped, owner, { kind: 'prediction_bet', sourceId: bet }))).toMatchObject({ result: 'void', stake: '10000000', payout: '9900000', pnl: '-100000', returnPct: '-1' })
    expect((await resolveCard(scoped, owner, { kind: 'prediction_record' }))).toMatchObject({ total: 1, void: 1, winRate: null, closedPnl: '-100000', last10: ['void'] })
  })
  it('freezes figures despite later payouts and strips hidden values from every public view', async () => {
    const post = await member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: ['returnPct'] } })
    const frozen = (await cardsFor(scoped, [post.id])).get(post.id)
    await runner.query(`WITH s AS (INSERT INTO app.quant_daily_settlements(product_id,trade_date,gross_return_pct,status,entered_by,approved_by)
        VALUES($1,'2026-11-01',1,'posted',$2,$3) RETURNING id)
      INSERT INTO app.quant_payouts(settlement_id,product_id,user_id,trade_date,principal_before_atomic,gross_atomic,mgmt_fee_atomic,perf_fee_atomic,net_atomic,paid_atomic)
      SELECT s.id,$1,$2,'2026-11-01',54000000,1000000,0,0,1000000,1000000 FROM s`, [product, owner, other])
    expect((await cardsFor(scoped, [post.id])).get(post.id)).toEqual(frozen)
    const link = await shares.create(owner, { kind: 'community_card', resourceId: post.id })
    const views = [(await community.getFeed({ hasCard: 'true' })).items[0], (await community.getPost(post.id)).post,
      (await community.postViews([post.id])).get(post.id), (await community.getProfile((await member.profile(owner)).handle)).posts[0], await shares.resolve(link.token)]
    for (const v of views) {
      const card = (v as { card: typeof frozen }).card!
      expect(card.snapshot).toEqual(frozen!.snapshot)
      for (const key of ['pnl', 'settledDays', 'bestMonth', 'source_refs']) expect(card.snapshot).not.toHaveProperty(key)
      expect(v).not.toHaveProperty('source_refs')
    }
    await shares.revoke(owner, link.id)
    await expect(shares.resolve(link.token)).rejects.toMatchObject({ status: 404 })
  })
  it('enforces author-only public links, circle visibility, revocation and post deletion', async () => {
    const hidden = await member.post(owner, randomUUID(), { body: '', circleId: circle, card: { kind: 'quant_day', sourceId: payout, visibleFields: ['pnl'] } })
    await expect(shares.create(owner, { kind: 'community_card', resourceId: hidden.id })).rejects.toMatchObject({ status: 404 })
    expect((await community.postViews([hidden.id], other)).size).toBe(0)
    const synced = await member.post(owner, randomUUID(), { body: '', circleId: circle, alsoPublic: true, card: { kind: 'deposit', sourceId: deposit, visibleFields: ['status'] } })
    await expect(shares.create(other, { kind: 'community_card', resourceId: synced.id })).rejects.toMatchObject({ status: 404 })
    const link = await shares.create(owner, { kind: 'community_card', resourceId: synced.id })
    expect(await shares.resolve(link.token)).toMatchObject({ kind: 'community_card', author: { displayName: 'Card owner' }, card: { snapshot: { fundsRecord: true, status: 'credited' } }, referralCode: null })
    expect(JSON.stringify(await shares.resolve(link.token))).not.toContain('9007199254740993123456789')
    await runner.query('UPDATE app.community_post_cards SET revoked_at=now() WHERE post_id=$1', [synced.id])
    await expect(shares.resolve(link.token)).rejects.toMatchObject({ status: 404 })
    await runner.query('UPDATE app.community_post_cards SET revoked_at=NULL WHERE post_id=$1', [synced.id])
    await runner.query('DELETE FROM app.community_posts WHERE id=$1', [synced.id])
    await expect(shares.resolve(link.token)).rejects.toMatchObject({ status: 404 })
  })
  it('filters card groups, excludes circle-only posts, and always sorts cards newest first', async () => {
    const q = await member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: ['pnl'] } })
    const p = await member.post(owner, randomUUID(), { body: '', card: { kind: 'prediction_bet', sourceId: bet, visibleFields: ['result'] } })
    const f = await member.post(owner, randomUUID(), { body: '', card: { kind: 'deposit', sourceId: deposit, visibleFields: ['status'] } })
    await member.post(owner, randomUUID(), { body: 'text only', location })
    await member.post(owner, randomUUID(), { body: '', circleId: circle, card: { kind: 'quant_total', visibleFields: ['pnl'] } })
    const all = (await community.getFeed({ hasCard: 'true', sort: 'hot' })).items
    expect(new Set(all.map(i => i.id))).toEqual(new Set([q.id, p.id, f.id]))
    expect(all.map(i => new Date(i.publishedAt!).getTime())).toEqual(all.map(i => new Date(i.publishedAt!).getTime()).sort((a, b) => b - a))
    for (const [cardKind, id] of [['quant', q.id], ['prediction', p.id], ['funds', f.id]] as const) {
      expect((await community.getFeed({ hasCard: 'true', cardKind })).items.map(i => i.id)).toEqual([id])
    }
  })
  it('aggregates beyond list limits and floors winning shares before subtracting payout fees', async () => {
    await runner.query(`WITH days AS (INSERT INTO app.quant_daily_settlements(product_id,trade_date,gross_return_pct,status,entered_by,approved_by)
      SELECT $1,'2026-01-01'::date+i,1,'posted',$2,$3 FROM generate_series(0,204) i RETURNING id,trade_date)
      INSERT INTO app.quant_payouts(settlement_id,product_id,user_id,trade_date,principal_before_atomic,gross_atomic,mgmt_fee_atomic,perf_fee_atomic,net_atomic,paid_atomic)
      SELECT id,$1,$2,trade_date,100000000,1000,0,0,1000,1000 FROM days`, [product, owner, other])
    expect(await resolveCard(scoped, owner, { kind: 'quant_total' })).toMatchObject({ pnl: '-10155000', settledDays: 206 })
    await runner.query(`INSERT INTO app.prediction_bets(user_id,market_mapping_id,token_id,side,stake_atomic,fee_atomic,payout_fee_atomic,shares,price,status,idempotency_key,settled_at)
      SELECT user_id,market_mapping_id,'loss-'||i,'NO',1000000,0,0,2,0.5,'lost','loss-'||i,now()-interval '1 day'
      FROM app.prediction_bets CROSS JOIN generate_series(1,205) i WHERE id=$1`, [bet])
    await runner.query(`UPDATE app.prediction_bets SET status='won',shares=20.123456789012345678,payout_fee_atomic=123456 WHERE id=$1`, [bet])
    expect(await resolveCard(scoped, owner, { kind: 'prediction_bet', sourceId: bet })).toMatchObject({ payout: '20000000', pnl: '10000000', returnPct: '100' })
    expect(await resolveCard(scoped, owner, { kind: 'prediction_record' })).toMatchObject({ total: 206, won: 1, lost: 205, closedPnl: '-195000000' })
    const first = await member.cardSources(owner, 'prediction_bet')
    expect(first.items).toHaveLength(50)
    const second = await member.cardSources(owner, 'prediction_bet', first.nextCursor!)
    expect(second.items).toHaveLength(50)
    expect(second.items.some((i: { id: string }) => first.items.some((j: { id: string }) => i.id === j.id))).toBe(false)
  })
  it('labels holdings as principal, counts future lots once, and resolves withdrawal fallback time', async () => {
    const order = randomUUID()
    await runner.query(`INSERT INTO app.quant_orders(id,product_id,user_id,kind,amount_atomic,principal_atomic,status,effective_date,idempotency_key)
      VALUES($1::uuid,$2,$3,'subscription',6000000,6000000,'settled','2099-01-01',$1::text)`, [order, product, owner])
    await runner.query(`INSERT INTO app.quant_lots(product_id,user_id,order_id,original_atomic,principal_atomic,effective_date)
      VALUES($1,$2,$3,6000000,6000000,'2099-01-01')`, [product, owner, order])
    expect(await resolveCard(scoped, owner, { kind: 'holdings' })).toMatchObject({ totalPrincipal: '60000000', pending: '6000000',
      products: [{ weight: '1', lastDayReturnPct: '-10', date: '2026-10-31' }] })
    const [wallet] = await runner.query('SELECT id FROM app.custody_wallets WHERE user_id=$1', [owner])
    const [withdrawal] = await runner.query(`INSERT INTO app.withdrawals(user_id,wallet_id,network,asset_code,asset_decimals,atomic_amount,destination_hash,destination_ciphertext,encryption_key_version,idempotency_key,requested_at)
      VALUES($1,$2,'tron','USDT',6,100000000,$3,$3,1,$4,'2026-10-31T12:34:56Z') RETURNING id`, [owner, wallet.id, Buffer.from(randomUUID()), randomUUID()])
    expect(await resolveCard(scoped, owner, { kind: 'withdrawal', sourceId: withdrawal.id })).toMatchObject({ amount: '100000000', time: '2026-10-31T12:34:56.000Z', status: 'requested', fundsRecord: true })
  })
})
