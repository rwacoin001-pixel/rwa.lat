import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { PredictionService, parseDecimal18 } from '../../src/prediction/prediction.service'
import { PredictionResolutionService } from '../../src/prediction/prediction-resolution.service'
import { PredictionSettlementWorker } from '../../src/prediction/prediction-settlement.worker'
import { normalizeMarket } from '../../src/polymarket/polymarket-public.adapter'
import { PolymarketService } from '../../src/polymarket/polymarket.service'
import { PolymarketExternalEvent, PolymarketMarketMapping, PolymarketSyncWatermark, PolymarketTokenMapping } from '../../src/polymarket/polymarket.entities'

const dbDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip
jest.setTimeout(120_000)

dbDescribe('final-result sync → atomic prediction settlement', () => {
  let ds: DataSource
  let prediction: PredictionService
  let seq = 0
  const prefix = `resolution-${randomUUID()}`
  const upstream = new Map<string, Record<string, unknown>>()
  const book = jest.fn(async (tokenId: string) => ({
    tokenId, bids: [{ price: '0.60', size: '10000' }], asks: [{ price: '0.62', size: '10000' }],
    stale: false, fetchedAt: new Date(), asOf: new Date(),
  }))
  const trading = { getOrderBook: book, getOutcomeProbability: async () => .6 } as unknown as PolymarketService
  const adapter = {
    isEnabled: () => true,
    getMarketById: jest.fn(async (id: string) => {
      const payload = upstream.get(id)
      if (!payload) throw new Error('upstream temporarily unavailable')
      return normalizeMarket(payload)
    }),
  }
  const balance = async (id: string) => BigInt((await ds.query(`
    SELECT b.current_atomic_balance::text AS amount FROM app.ledger_accounts a
    JOIN app.ledger_account_balances b ON b.account_id=a.id
    WHERE a.user_id=$1 AND a.purpose='available' AND a.asset_code='USDT' AND a.network IS NULL`, [id]))[0]?.amount ?? '0')
  const worker = (mode?: string) => {
    const config = new ConfigService({ PREDICTION_RESOLUTION_SYNC_MODE: mode })
    return new PredictionSettlementWorker(prediction, config, new PredictionResolutionService(ds, adapter as never, config))
  }
  const counts = async (marketId: string) => (await ds.query(`
    SELECT (SELECT count(*)::int FROM app.prediction_settlement_runs WHERE market_mapping_id=$1) AS runs,
      (SELECT count(*)::int FROM app.prediction_bets WHERE market_mapping_id=$1 AND status='placed') AS placed,
      (SELECT count(*)::int FROM app.polymarket_token_mappings WHERE market_mapping_id=$1 AND state='resolved') AS winners`, [marketId]))[0]

  async function fixture() {
    const key = `${prefix}-${++seq}`
    const [m] = await ds.query(`INSERT INTO app.polymarket_market_mappings
      (gamma_market_id, condition_id, slug, question, state, enable_order_book, last_synced_at)
      VALUES ($1,$2,$1,'Fixture only','active',true,now()) RETURNING id`, [key, `cond-${key}`])
    const yes = `${key}-yes`, no = `${key}-no`
    await ds.query(`INSERT INTO app.polymarket_token_mappings (market_mapping_id,token_id,outcome,outcome_index,state)
      VALUES ($1,$2,'Yes',0,'active'),($1,$3,'No',1,'active')`, [m.id, yes, no])
    const users: string[] = []
    for (let i=0;i<2;i++) {
      const [u] = await ds.query('INSERT INTO app.users DEFAULT VALUES RETURNING id')
      users.push(u.id)
      const [account] = await ds.query(`INSERT INTO app.ledger_accounts (owner_type,user_id,purpose,asset_code,asset_decimals,normal_side)
        VALUES ('user',$1,'available','USDT',6,'credit') RETURNING id`, [u.id])
      // Test faucet uses the existing ledger's balanced double-entry API.
      const [faucet] = await ds.query(`INSERT INTO app.ledger_accounts (owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES ('platform',$1,'settlement','USDT',6,'debit') RETURNING id`, [`${key}-faucet-${i}`])
      const [tx] = await ds.query(`INSERT INTO app.ledger_transactions
        (transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,effective_at)
        VALUES ('deposit',$1,'resolution-test','test_faucet',$2,'service',now()) RETURNING id`, [`${key}-fund-${i}`, faucet.id])
      await ds.query(`INSERT INTO app.ledger_entries (transaction_id,account_id,side,atomic_amount)
        VALUES ($1,$2,'credit',1000000000),($1,$3,'debit',1000000000)`, [tx.id,account.id,faucet.id])
    }
    const payload = { id:key,conditionId:`cond-${key}`,slug:key,question:'Fixture only',active:true,closed:true,
      umaResolutionStatus:'resolved',outcomes:'["Yes","No"]',clobTokenIds:JSON.stringify([yes,no]),outcomePrices:'["1","0"]' }
    upstream.set(key,payload)
    return { id:m.id as string, key, yes, no, users, payload }
  }

  beforeAll(async () => {
    ds = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV:'test' }))
    await ds.initialize()
    prediction = new PredictionService(ds, { assertEnabled: async()=>{} } as never, trading, { requireInvestmentEligibility:async()=>{} } as never)
  })
  afterAll(async()=> { if(ds?.isInitialized) await ds.destroy() })

  it('defaults to observe-only; fetching final results does not write winners, settle or credit', async () => {
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'10000000',idempotencyKey:randomUUID()})
    const before=await balance(f.users[0])
    for(const mode of [undefined,'observe','typo']) {
      expect(await worker(mode).runOnce()).toBe(0)
      expect(await counts(f.id)).toEqual({runs:0,placed:1,winners:0})
      expect(await balance(f.users[0])).toBe(before)
    }
  })

  it('syncs exact final winner, pays once, records evidence, preserves fees and balanced ledger', async () => {
    const f=await fixture()
    const winner=await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'10000000',idempotencyKey:randomUUID()})
    await prediction.placeBet(f.users[1],'test',{tokenId:f.no,stakeAtomic:'10000000',idempotencyKey:randomUUID()})
    const before=await balance(f.users[0]), loserBefore=await balance(f.users[1])
    await Promise.all([worker('apply').runOnce(),worker('apply').runOnce()])
    expect(await counts(f.id)).toEqual({runs:1,placed:0,winners:1})
    const bets=await ds.query('SELECT status FROM app.prediction_bets WHERE market_mapping_id=$1',[f.id])
    expect(bets.map((b:{status:string})=>b.status).sort()).toEqual(['lost','won'])
    // Original shares + original 3% payout fee, with integer truncation preserved.
    const gross=parseDecimal18(winner.shares) / 10n**12n
    expect(await balance(f.users[0])-before).toBe(gross-gross*300n/10000n)
    expect(await balance(f.users[1])).toBe(loserBefore)
    await worker('apply').runOnce()
    const [proof]=await ds.query(`SELECT count(*)::int AS n FROM app.polymarket_external_events
      WHERE market_condition_id=$1 AND event_type='prediction.final_resolution' AND processing_state='processed'`,[f.payload.conditionId])
    expect(proof.n).toBe(1)
    expect((await ds.query('SELECT state,winning_token_mapping_id FROM app.polymarket_settlement_mappings WHERE market_mapping_id=$1',[f.id]))[0].state).toBe('confirmed')
    const [ledger]=await ds.query(`SELECT count(DISTINCT t.id)::int AS n,
      COALESCE(sum(CASE WHEN e.side='credit' THEN e.atomic_amount ELSE -e.atomic_amount END),0)::text AS net
      FROM app.ledger_transactions t JOIN app.ledger_entries e ON e.transaction_id=t.id
      WHERE t.transaction_type='prediction_payout' AND t.reference_id=$1`,[winner.id])
    expect(ledger).toEqual({n:1,net:'0'})
  })

  it.each([
    {umaResolutionStatus:'proposed'}, {umaResolutionStatus:'disputed'},
    {outcomePrices:'["0.5","0.5"]'}, {conditionId:'wrong'}, {clobTokenIds:'["wrong","tokens"]'},
  ])('leaves ambiguous or unfinalized results pending: %j',async(patch)=>{
    const f=await fixture()
    upstream.set(f.key,{...f.payload,...patch})
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    const before=await balance(f.users[0])
    await worker('apply').runOnce()
    expect(await counts(f.id)).toEqual({runs:0,placed:1,winners:0})
    expect(await balance(f.users[0])).toBe(before)
  })

  it('fails closed for a suspended market and continues past upstream failure',async()=>{
    const bad=await fixture(), paused=await fixture(), good=await fixture()
    for(const f of [bad,paused,good]) await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    upstream.delete(bad.key)
    await ds.query("UPDATE app.polymarket_market_mappings SET state='suspended' WHERE id=$1",[paused.id])
    await worker('apply').runOnce()
    expect((await counts(bad.id)).placed).toBe(1)
    expect((await counts(paused.id)).placed).toBe(1)
    expect((await counts(good.id)).runs).toBe(1)
  })

  it('revalidates a previously quoted bet after settlement; no post-snapshot orphan bet',async()=>{
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    const quoted=book(f.no)
    let release!:()=>void, entered!:()=>void
    const started=new Promise<void>(r=>{entered=r})
    const blocked=new Promise<void>(r=>{release=r})
    book.mockImplementationOnce(async()=>{entered();await blocked;return quoted})
    const late=prediction.placeBet(f.users[1],'test',{tokenId:f.no,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
      .then(()=>({ok:true}),e=>({ok:false,code:e.response?.code}))
    await started
    await worker('apply').runOnce()
    release()
    expect(await late).toMatchObject({ok:false,code:'PREDICTION_MARKET_NOT_TRADEABLE'})
    expect(await counts(f.id)).toEqual({runs:1,placed:0,winners:1})
  })

  it('serializes exposure checks across different users',async()=>{
    const f=await fixture()
    const results=await Promise.allSettled(f.users.map((userId)=>prediction.placeBet(userId,'test',{
      tokenId:f.yes,stakeAtomic:'300000000',idempotencyKey:randomUUID(),
    })))
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
    expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.response.code).toBe('PREDICTION_MARKET_EXPOSURE_LIMIT')
  })

  it('rolls back a failed payout atomically and retries without duplicate credit',async()=>{
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    const before=await balance(f.users[0])
    const factory=ds.createQueryRunner.bind(ds)
    let injected=false
    const spy=jest.spyOn(ds,'createQueryRunner').mockImplementation(mode=>{
      const runner=factory(mode), query=runner.query.bind(runner)
      let target=false
      runner.query=(async(sql:string,parameters?:unknown[],structured?:boolean)=>{
        if(sql.includes('SELECT * FROM app.prediction_bets WHERE market_mapping_id')) target=parameters?.[0]===f.id
        if(target && !injected && sql.includes('INSERT INTO app.ledger_entries')) {
          injected=true
          throw new Error('Injected test-only payout failure')
        }
        return structured ? query(sql,parameters,true) : query(sql,parameters)
      }) as typeof runner.query
      return runner
    })
    try { await worker('apply').runOnce() } finally {spy.mockRestore()}
    expect(injected).toBe(true)
    expect(await counts(f.id)).toEqual({runs:0,placed:1,winners:1})
    expect(await balance(f.users[0])).toBe(before)
    await worker('apply').runOnce()
    expect(await counts(f.id)).toEqual({runs:1,placed:0,winners:1})
    const credited=await balance(f.users[0])
    expect(credited).toBeGreaterThan(before)
    await worker('apply').runOnce()
    expect(await balance(f.users[0])).toBe(credited)
  })

  it('rejects an expired market even if the local discovery flag is still active',async()=>{
    const f=await fixture()
    await ds.query("UPDATE app.polymarket_market_mappings SET market_end_at=now()-interval '1 second' WHERE id=$1",[f.id])
    await expect(prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()}))
      .rejects.toMatchObject({response:{code:'PREDICTION_MARKET_NOT_TRADEABLE'}})
    expect((await counts(f.id)).placed).toBe(0)
  })

  it.each([
    {state:'disputed',value:'1'}, {state:'reversed',value:'1'}, {state:'observed',value:'1'},
    {state:'confirmed',value:'0.5'}, {state:'confirmed',value:'0.999999999999999999'},
  ])('does not override an existing conflicting settlement: %j',async({state,value})=>{
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    const [winner]=await ds.query('SELECT id FROM app.polymarket_token_mappings WHERE token_id=$1',[f.yes])
    await ds.query(`INSERT INTO app.polymarket_settlement_mappings
      (market_mapping_id,external_settlement_id,winning_token_mapping_id,outcome,state,payout_value,resolved_at,confirmed_at,raw_payload)
      VALUES ($1,$2,$3,'Yes',$4,$5,now(),CASE WHEN $4='confirmed' THEN now() ELSE NULL END,'{}')`,
      [f.id,`gamma-final:${f.key}`,winner.id,state,value])
    const before=await balance(f.users[0])
    await worker('apply').runOnce()
    expect(await counts(f.id)).toEqual({runs:0,placed:1,winners:0})
    expect(await balance(f.users[0])).toBe(before)
  })

  it('rotates small batches past unresolved markets rather than starving later ones',async()=>{
    const resolution=new PredictionResolutionService(ds,adapter as never,new ConfigService({}))
    const seen=new Set<string>()
    for(let i=0;i<35;i++) for(const result of await resolution.syncPendingMarkets(1)) seen.add(result.marketId)
    const pending=await ds.query(`SELECT DISTINCT b.market_mapping_id AS id FROM app.prediction_bets b
      JOIN app.polymarket_market_mappings m ON m.id=b.market_mapping_id
      WHERE b.status='placed' AND m.state NOT IN ('resolved','suspended')`)
    expect(pending.length).toBeGreaterThan(1)
    for(const m of pending) expect(seen.has(m.id)).toBe(true)
  })

  it('stops settlement if evidence is disputed after sync and before payout',async()=>{
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    const service=new PredictionResolutionService(ds,adapter as never,new ConfigService({PREDICTION_RESOLUTION_SYNC_MODE:'apply'}))
    await service.syncPendingMarkets(100)
    expect((await counts(f.id)).winners).toBe(1)
    await ds.query("UPDATE app.polymarket_settlement_mappings SET state='disputed' WHERE market_mapping_id=$1",[f.id])
    const before=await balance(f.users[0])
    expect((await prediction.settleMarket(f.id)).settled).toBe(false)
    expect(await prediction.findSettleableMarkets(100)).not.toContain(f.id)
    expect(await counts(f.id)).toEqual({runs:0,placed:1,winners:1})
    expect(await balance(f.users[0])).toBe(before)
  })

  it('does not reopen a resolved market when normal market discovery sees stale active data',async()=>{
    const f=await fixture()
    await prediction.placeBet(f.users[0],'test',{tokenId:f.yes,stakeAtomic:'1000000',idempotencyKey:randomUUID()})
    await worker('apply').runOnce()
    const discovery=new PolymarketService(ds.getRepository(PolymarketMarketMapping),ds.getRepository(PolymarketTokenMapping),
      ds.getRepository(PolymarketSyncWatermark),ds.getRepository(PolymarketExternalEvent),
      {...adapter,listMarkets:async()=>({markets:[normalizeMarket({...f.payload,closed:false,enableOrderBook:true})!],nextCursor:null,fetchedAt:new Date()})} as never,
      new ConfigService({}),{assertPermission:async()=>{}} as never)
    await discovery.syncMarkets({id:randomUUID()} as never)
    expect((await ds.query('SELECT state FROM app.polymarket_market_mappings WHERE id=$1',[f.id]))[0].state).toBe('resolved')
    expect(await counts(f.id)).toEqual({runs:1,placed:0,winners:1})
  })
})
