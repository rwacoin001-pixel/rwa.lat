import { randomUUID } from 'node:crypto'
import { DataSource, EntityManager, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { CommunityMemberService } from '../../src/community/community-member.service'
import { CommunityService } from '../../src/community/community.service'
import { CommunityComment, CommunityFollow, CommunityLike, CommunityPost, CommunityProfile, CommunityQueueItem, CommunityReport, CommunityTopic, CommunityTranslation } from '../../src/community/community.entities'
import { PublicShareService } from '../../src/sharing/public-share.service'
import { cardsFor, resolveCard } from '../../src/community/community-card'
import { CommunityCircleService } from '../../src/community/community-circle.service'
import { proofsFor } from '../../src/community/community-proof'
import { CommunityPostCards1793700000000 } from '../../src/database/migrations/1793700000000-community-post-cards'

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Result cards with isolated PostgreSQL', () => {
  let db: DataSource, runner: QueryRunner, scoped: DataSource, member: CommunityMemberService, community: CommunityService, shares: PublicShareService, circles: CommunityCircleService
  let owner: string, other: string, product: string, payout: string, bet: string, deposit: string, circle: string
  const location = { city: 'Singapore', countryCode: 'SG', source: 'device' as const }
  beforeAll(async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.endsWith('_test')) throw new Error('Isolated local test database required')
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    if ((await db.query('SELECT current_database() AS name'))[0].name !== decodeURIComponent(target.pathname.slice(1))) throw new Error('Unexpected test database')
    await db.runMigrations()
  })
  beforeEach(async () => {
    runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    scoped = { query: (sql: string, args?: unknown[]) => runner.query(sql, args), transaction: <T>(work: (m: EntityManager) => Promise<T>) => work(runner.manager) } as unknown as DataSource
    member = new CommunityMemberService(scoped)
    const repos = [CommunityProfile, CommunityPost, CommunityComment, CommunityLike, CommunityFollow, CommunityTopic, CommunityQueueItem, CommunityReport, CommunityTranslation].map(e => runner.manager.getRepository(e))
    community = Reflect.construct(CommunityService, [...repos, {}, scoped]) as CommunityService
    circles = new CommunityCircleService(scoped, community)
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
  afterEach(async () => { if (runner?.isTransactionActive) await runner.rollbackTransaction(); await runner?.release() })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })

  it('refuses cards sourced from another account without publishing', async () => {
    for (const [kind, sourceId] of [['quant_day', payout], ['quant_product', product], ['prediction_bet', bet], ['deposit', deposit]] as const) {
      await expect(member.cardPreview(other, { kind, sourceId })).rejects.toMatchObject({ status: 404 })
      await expect(member.post(other, randomUUID(), { body: '', card: { kind, sourceId, visibleFields: [kind === 'deposit' ? 'amount' : kind === 'prediction_bet' ? 'stake' : 'pnl'] } })).rejects.toMatchObject({ status: 404 })
      expect((await member.cardSources(other, kind)).items).toEqual([])
      const forged = Buffer.from(JSON.stringify({ id: sourceId, at: '2099-01-01T00:00:00Z' })).toString('base64url')
      expect((await member.cardSources(other, kind, forged)).items).toEqual([])
    }
    expect((await runner.query('SELECT post_id FROM app.community_post_cards')).length).toBe(0)
  })
  it('answers availability for a signed-in account with no financial records or community profile', async () => {
    const emptyUser = randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1)', [emptyUser])
    const { items } = await member.cardKinds(emptyUser)
    expect(items).toHaveLength(8)
    expect(items.every(i => !i.available && i.reason !== null)).toBe(true)
    expect(items.filter(i => i.defaultHidden.includes('amount')).map(i => i.kind)).toEqual(['deposit', 'withdrawal'])
    expect(await runner.query('SELECT id FROM app.community_profiles WHERE user_id=$1', [emptyUser])).toEqual([])
  })
  it('resolves again at publication after an owner preview', async () => {
    const preview = await member.cardPreview(owner, { kind: 'prediction_bet', sourceId: bet })
    expect(preview.snapshot).toMatchObject({ result: 'void', pnl: '-100000' })
    await runner.query("UPDATE app.prediction_bets SET status='lost' WHERE id=$1", [bet])
    const post = await member.post(owner, randomUUID(), { body: '', card: { kind: 'prediction_bet', sourceId: bet, visibleFields: ['result', 'pnl'] } })
    expect((await cardsFor(scoped, [post.id])).get(post.id)?.snapshot).toMatchObject({ result: 'lost', pnl: '-10000000' })
    await runner.query('UPDATE app.prediction_bets SET user_id=$2 WHERE id=$1', [bet, other])
    await expect(member.cardPreview(owner, { kind: 'prediction_bet', sourceId: bet })).rejects.toMatchObject({ status: 404 })
    await expect(member.post(owner, randomUUID(), { body: '', card: { kind: 'prediction_bet', sourceId: bet, visibleFields: ['result'] } })).rejects.toMatchObject({ status: 404 })
  })
  it('validates visibility, allows loss-only posts without location and preserves idempotency', async () => {
    await expect(member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: [] } })).rejects.toThrow('CARD_NOTHING_VISIBLE')
    await expect(member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: ['madeUp'] } })).rejects.toMatchObject({ status: 400 })
    const input = { body: '', clientRequestId: randomUUID(), card: { kind: 'quant_product' as const, sourceId: product, visibleFields: ['pnl', 'returnPct'] } }
    const a = await member.post(owner, undefined, input)
    expect(await member.post(owner, undefined, input)).toEqual({ id: a.id, duplicate: true })
    expect((await cardsFor(scoped, [a.id])).get(a.id)?.snapshot).toMatchObject({ pnl: '-10360000', returnPct: '-10.36', disclaimer: 'v1' })
    await expect(member.post(owner, randomUUID(), { body: 'ordinary post' })).rejects.toThrow('Device location required')
    await expect(member.post(owner, randomUUID(), { body: '', location })).rejects.toThrow('Invalid post body')
    await expect(member.post(owner, randomUUID(), { ...input, location: { ...location, source: 'manual' as 'device' } })).rejects.toThrow('Device location required')
    await expect(member.post(owner, randomUUID(), { ...input, body: 'x'.repeat(4001) })).rejects.toThrow('Invalid post body')
    await expect(member.post(owner, randomUUID(), { ...input, proof: { kind: 'prediction_win', bet } })).rejects.toThrow('CARD_PROOF_EXCLUSIVE')
    await expect(member.post(owner, randomUUID(), input)).rejects.toThrow('Conflicting idempotency keys')
    expect((await resolveCard(scoped, owner, { kind: 'quant_total' }))).toMatchObject({ pnl: '-10360000', settledDays: 1, bestMonth: { month: '2026-10', pnl: '-10360000' } })
    expect((await resolveCard(scoped, owner, { kind: 'prediction_bet', sourceId: bet }))).toMatchObject({ result: 'void', stake: '10000000', payout: '9900000', pnl: '-100000', returnPct: '-1' })
    expect((await resolveCard(scoped, owner, { kind: 'prediction_record' }))).toMatchObject({ total: 1, void: 1, winRate: null, closedPnl: '-100000', last10: ['void'] })
  })
  it('freezes figures despite later payouts and strips hidden values from every public view', async () => {
    const post = await member.post(owner, randomUUID(), { body: 'privacy fixture', circleId: circle, alsoPublic: true, card: { kind: 'quant_total', visibleFields: ['returnPct'] } })
    const frozen = (await cardsFor(scoped, [post.id])).get(post.id)
    const [stored] = await runner.query('SELECT snapshot FROM app.community_post_cards WHERE post_id=$1', [post.id])
    for (const key of ['pnl', 'settledDays', 'bestMonth', 'source_refs']) expect(stored.snapshot).not.toHaveProperty(key)
    await runner.query(`WITH s AS (INSERT INTO app.quant_daily_settlements(product_id,trade_date,gross_return_pct,status,entered_by,approved_by)
        VALUES($1,'2026-11-01',1,'posted',$2,$3) RETURNING id)
      INSERT INTO app.quant_payouts(settlement_id,product_id,user_id,trade_date,principal_before_atomic,gross_atomic,mgmt_fee_atomic,perf_fee_atomic,net_atomic,paid_atomic)
      SELECT s.id,$1,$2,'2026-11-01',54000000,1000000,0,0,1000000,1000000 FROM s`, [product, owner, other])
    expect((await cardsFor(scoped, [post.id])).get(post.id)).toEqual(frozen)
    const link = await shares.create(owner, { kind: 'community_card', resourceId: post.id })
    const views = [(await community.getFeed({ hasCard: 'true' })).items[0], (await community.getPost(post.id)).post,
      (await community.postViews([post.id])).get(post.id), (await community.getProfile((await member.profile(owner)).handle)).posts[0],
      (await circles.feed(owner, circle, {})).items[0], (await circles.innerSearch(owner, circle, 'privacy fixture', 'posts')).items[0], await shares.resolve(link.token)]
    for (const v of views) {
      const card = (v as { card: typeof frozen }).card!
      expect(card.snapshot).toEqual(frozen!.snapshot)
      for (const key of ['pnl', 'settledDays', 'bestMonth', 'source_refs']) expect(card.snapshot).not.toHaveProperty(key)
      expect(JSON.stringify(v)).not.toContain('source_refs')
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
    await runner.query('UPDATE app.community_posts SET circle_only=true WHERE id=$1', [synced.id])
    await expect(shares.resolve(link.token)).rejects.toMatchObject({ status: 404 })
    await runner.query('UPDATE app.community_posts SET circle_only=false WHERE id=$1', [synced.id])
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
    expect(await resolveCard(scoped, owner, { kind: 'prediction_record' })).toMatchObject({ total: 206, won: 1, lost: 205, winRate: '0.00485436', closedPnl: '-195000000' })
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
    await expect(member.cardPreview(other, { kind: 'withdrawal', sourceId: withdrawal.id })).rejects.toMatchObject({ status: 404 })
    await expect(member.post(other, randomUUID(), { body: '', card: { kind: 'withdrawal', sourceId: withdrawal.id, visibleFields: ['amount'] } })).rejects.toMatchObject({ status: 404 })
  })
  it('weights multiple products by remaining principal and excludes another user from aggregates', async () => {
    const second = randomUUID(), order = randomUUID(), foreignOrder = randomUUID()
    await runner.query(`INSERT INTO app.quant_products(id,slug,name,first_trade_date,last_settled_date)
      VALUES($1,$2,'Second quant','2026-10-01','2026-10-31')`, [second, `card-${second}`])
    await runner.query(`INSERT INTO app.quant_orders(id,product_id,user_id,kind,amount_atomic,principal_atomic,status,effective_date,idempotency_key)
      VALUES($1::uuid,$2,$3,'subscription',18000000,18000000,'settled','2026-10-01',$1::text),
        ($4::uuid,$2,$5,'subscription',900000000,900000000,'settled','2026-10-01',$4::text)`, [order, second, owner, foreignOrder, other])
    await runner.query(`INSERT INTO app.quant_lots(product_id,user_id,order_id,original_atomic,principal_atomic,effective_date)
      VALUES($1,$2,$3,18000000,18000000,'2026-10-01'),($1,$4,$5,900000000,900000000,'2026-10-01')`, [second, owner, order, other, foreignOrder])
    await runner.query(`WITH s AS (INSERT INTO app.quant_daily_settlements(product_id,trade_date,gross_return_pct,status,entered_by,approved_by)
      VALUES($1,'2026-10-31',12.4,'posted',$2,$3) RETURNING id)
      INSERT INTO app.quant_payouts(settlement_id,product_id,user_id,trade_date,principal_before_atomic,gross_atomic,mgmt_fee_atomic,perf_fee_atomic,net_atomic,paid_atomic)
      SELECT s.id,$1,$2,'2026-10-31',18000000,2232000,0,0,2232000,2232000 FROM s`, [second, owner, other])
    expect(await resolveCard(scoped, owner, { kind: 'holdings' })).toMatchObject({ totalPrincipal: '72000000', products: [
      { weight: '0.75', lastDayReturnPct: '-10' }, { weight: '0.25', lastDayReturnPct: '12.4' },
    ] })
    expect(await resolveCard(scoped, owner, { kind: 'quant_product', sourceId: second })).toMatchObject({ pnl: '2232000', returnPct: '12.4', settledDays: 1, status: 'holding' })
    expect(await resolveCard(scoped, owner, { kind: 'quant_total' })).toMatchObject({ pnl: '-8128000', settledDays: 1 })
  })
  it('keeps old proofs and share kinds through a migration rollback and reapply', async () => {
    const [{ date }] = await runner.query('UPDATE app.quant_payouts SET net_atomic=1000000,paid_atomic=1000000,trade_date=current_date WHERE id=$1 RETURNING trade_date::text AS date', [payout])
    const proof = await member.post(owner, randomUUID(), { body: '', location, proof: { kind: 'quant_day', product: `card-${product}`, date } })
    const legacyLink = await shares.create(owner, { kind: 'community_post', resourceId: proof.id })
    const post = await member.post(owner, randomUUID(), { body: '', card: { kind: 'quant_total', visibleFields: ['pnl'] } })
    const cardLink = await shares.create(owner, { kind: 'community_card', resourceId: post.id })
    const migration = new CommunityPostCards1793700000000()
    await runner.query('SAVEPOINT cards_migration_roundtrip')
    try {
      await migration.down(runner)
      expect((await runner.query("SELECT to_regclass('app.community_post_cards') AS name"))[0].name).toBeNull()
      expect((await proofsFor(scoped, [proof.id])).get(proof.id)).toMatchObject({ kind: 'quant_day', pct: 1 })
      expect(await shares.resolve(legacyLink.token)).toMatchObject({ kind: 'community_post' })
      await expect(shares.resolve(cardLink.token)).rejects.toMatchObject({ status: 404 })
      expect((await runner.query('SELECT id FROM app.community_posts WHERE id=$1', [post.id]))).toHaveLength(1)
      await runner.query('SAVEPOINT restored_body_check')
      await expect(runner.query("INSERT INTO app.community_posts(profile_id,body,topics,source,state,published_at) SELECT profile_id,'','[]','user','published',now() FROM app.community_posts WHERE id=$1", [post.id])).rejects.toMatchObject({ code: '23514' })
      await runner.query('ROLLBACK TO SAVEPOINT restored_body_check')
      await migration.up(runner)
      // All eight new kinds work; the legacy proof-only kind belongs to the old table.
      await runner.query('SAVEPOINT invalid_card_kind')
      await expect(runner.query(`INSERT INTO app.community_post_cards(post_id,user_id,kind,source_refs,snapshot,visible_fields,calc_version)
        VALUES($1,$2,'prediction_win','{}','{}',ARRAY['pnl'],1)`, [post.id, owner])).rejects.toMatchObject({ code: '23514' })
      await runner.query('ROLLBACK TO SAVEPOINT invalid_card_kind')
      const kinds = ['quant_day', 'quant_product', 'quant_total', 'holdings', 'prediction_bet', 'prediction_record', 'deposit', 'withdrawal']
      for (const kind of kinds) {
        await runner.query(`INSERT INTO app.community_post_cards(post_id,user_id,kind,source_refs,snapshot,visible_fields,calc_version)
          VALUES($1,$2,$3,'{}','{}',ARRAY['pnl'],1)`, [post.id, owner, kind])
        await runner.query('DELETE FROM app.community_post_cards WHERE post_id=$1', [post.id])
      }
      await runner.query('DELETE FROM app.community_posts WHERE id=$1', [proof.id])
      expect((await proofsFor(scoped, [proof.id])).size).toBe(0)
    } finally {
      await runner.query('ROLLBACK TO SAVEPOINT cards_migration_roundtrip')
      await runner.query('RELEASE SAVEPOINT cards_migration_roundtrip')
    }
  })
})
