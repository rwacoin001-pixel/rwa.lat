import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AiMandateService } from '../../src/ai/ai-mandate.service'
import { AI_MANDATE_TERMS_VERSION } from '../../src/ai/ai-mandate.policy'
import { AiAutomaticService } from '../../src/ai/ai-automatic.service'
import { AiKnowledgeService } from '../../src/ai/ai-knowledge.service'
import { AiCustomerToolsService } from '../../src/ai/ai-customer-tools.service'
import { OrdersService } from '../../src/orders/orders.service'
import { PortfolioService } from '../../src/portfolio/portfolio.service'
import { PositionSnapshot, Redemption } from '../../src/portfolio/portfolio.entities'
import { ManualSettlementService } from '../../src/orders/manual-settlement.service'
import { GeneratedDocumentsService } from '../../src/generated-documents/generated-documents.service'
import { UserOpsService } from '../../src/notification/user-ops.service'
import { Ticket } from '../../src/notification/ticket.entity'
import { TicketMessage } from '../../src/notification/ticket-message.entity'
import { TicketEvent } from '../../src/notification/ticket-event.entity'
import { Invitation } from '../../src/notification/invitation.entity'
import { Subscription } from '../../src/notification/subscription.entity'
import { Preference } from '../../src/notification/preference.entity'
import { Reward } from '../../src/notification/reward.entity'

const suite=process.env.TEST_DATABASE_URL?describe:describe.skip
suite('AI mandates and real ledger applications in dedicated temporary PostgreSQL',()=>{
  let db:DataSource
  beforeAll(async()=>{
    const target=new URL(process.env.TEST_DATABASE_URL!)
    const ownedCluster=target.pathname.startsWith('/rwa_lat_codex_')&&target.pathname.endsWith('_test')
    const legacyCluster=target.port==='55439'&&target.pathname==='/rwa_ai_customer_20260930_test'
    if(target.hostname!=='127.0.0.1'||(!ownedCluster&&!legacyCluster))throw new Error('Dedicated AI cluster required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'}));await db.initialize();await db.runMigrations()
  })
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  async function fixture(){
    const user=randomUUID(),admin=randomUUID(),product=randomUUID(),session=randomUUID(),assetClass=`ai_${randomUUID().slice(0,8)}`
    await db.query(`INSERT INTO app.users(id,status) VALUES ($1,'active')`,[user])
    await db.query(`INSERT INTO app.asset_classes(id,display_name,state) VALUES($1,'AI test','active')`,[assetClass])
    await db.query(`INSERT INTO app.products(id,asset_class_id,version,display_name,asset_code,asset_decimals,state,published_at) VALUES($1,$2,1,'Verified test asset','AITEST',2,'published',now())`,[product,assetClass])
    const [available]=await db.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit') RETURNING id`,[user])
    const [source]=await db.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES('platform',$1,'settlement','USDT',6,'debit',true) RETURNING id`,[randomUUID()])
    const [fund]=await db.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,reason_code,actor_type,effective_at) VALUES('adjustment',$1,$2,'test_fixture',$3,'test_funding','service',now()) RETURNING id`,[randomUUID(),randomUUID(),randomUUID()])
    await db.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',110000000),($1,$3,'credit',110000000)`,[fund.id,source.id,available.id])
    const knowledge=new AiKnowledgeService(db,new ConfigService())
    const terms=await knowledge.save(null,{expectedRevision:0,title:'Verified test terms',summary:'Test fixture only',body:'This asset has no lock and no execution fees. No guaranteed returns.',category:'terms',locale:'en',visibility:'public',productIds:[product],effectiveAt:null,expiresAt:null} as any,admin)
    await knowledge.publish(terms.id,1,admin)
    const config=new ConfigService({AI_AUTOMATIC_EXECUTION_ENABLED:'true',AI_AUTOMATIC_EXECUTION_ACCEPTED:'true'})
    const mandates=new AiMandateService(db,config,{channels:()=>({email:false})} as any)
    await mandates.saveRule(product,{expectedRevision:0,state:'enabled',termsKnowledgeId:terms.id,termsRevision:1,riskBand:'balanced',lockDays:0,buyFeeBps:0,buyFeeFixedAtomic:'0',redeemFeeBps:0,redeemFeeFixedAtomic:'0'},admin)
    const input={expectedRevision:0,confirmed:true,termsVersion:AI_MANDATE_TERMS_VERSION,allowedProductIds:[product],positions:[],cashBudgetAtomic:'100000000',cashReserveAtomic:'10000000',maxManagedValueAtomic:'200000000',maxActionAtomic:'80000000',maxDailyTurnoverAtomic:'160000000',maxTotalTurnoverAtomic:'1000000000',riskBand:'balanced',maxProductWeightBps:8000,maxUnrealizedLossBps:2000,horizonDays:365,maxLockDays:30,maxFeeBps:100,maxFeeAtomic:'1000000',allowBuy:true,allowRedeem:true,reinvestProceeds:true,scheduleIntervalMinutes:60,minTradeIntervalMinutes:15,rebalanceThresholdBps:100,effectiveAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),goals:'Keep cash and diversify',locale:'en',notifications:['in_app']}
    const mandate=await mandates.confirm(user,session,input as any)
    const quote={productId:product,unitPriceAtomicAmount:'1000000',unitPriceDecimals:6,currency:'USDT',validUntil:new Date(Date.now()+3600000),capturedAt:new Date(),stale:false,source:'test'}
    const catalog={getProduct:async(id:string)=>{const [p]=await db.query(`SELECT id,asset_class_id AS "assetClassId",display_name AS "displayName",asset_code AS "assetCode",asset_decimals AS "assetDecimals",state,version FROM app.products WHERE id=$1`,[id]);return{...p,imageUrl:null}},requireOrderableQuote:async(id:string)=>({...quote,productId:id}),getLatestQuote:async(id:string)=>({...quote,productId:id})}
    const compliance={evaluateEligibility:async()=>({decision:'eligible',reasonCodes:[]})}
    const operations={assertEnabled:async()=>undefined}
    const orders=new OrdersService(db,catalog as any,compliance as any,{create:async()=>undefined} as any,operations as any,new ConfigService({APP_ENV:'test'}))
    const portfolio=new PortfolioService(db.getRepository(PositionSnapshot),db.getRepository(Redemption),{} as any,catalog as any)
    const model={complete:jest.fn().mockResolvedValue({text:JSON.stringify({cashBps:5000,explanation:'Hold half in cash',allocations:[{productId:product,weightBps:5000,reason:'Verified terms'}]}),model:'test-model'})}
    const automatic=new AiAutomaticService(db,mandates,model as any,catalog as any,compliance as any,orders,portfolio)
    const settlement=new ManualSettlementService(db,operations as any,new GeneratedDocumentsService(db,{} as any))
    const key=`${randomUUID()}.pdf`
    await db.query(`INSERT INTO app.object_storage_objects(bucket,key,content_type,size_bytes,scan_status,checksum_sha256) VALUES('rwa-attachments',$1,'application/pdf',100,'clean',$2)`,[key,'a'.repeat(64)])
    return{user,admin,product,assetClass,knowledge,session,mandate,input,mandates,automatic,settlement,model,evidenceRef:`rwa-attachments/${key}`}
  }
  async function balance(user:string){return db.query(`SELECT a.purpose,b.current_atomic_balance::text AS amount FROM app.ledger_accounts a JOIN app.ledger_account_balances b ON b.account_id=a.id WHERE a.user_id=$1 ORDER BY a.purpose`,[user])}
  async function settledBuy(f:Awaited<ReturnType<typeof fixture>>,fee='0'){
    const run=await f.automatic.evaluate(f.user,1,randomUUID())
    expect(run.state).toBe('waiting_orders');expect(run.legs).toHaveLength(1)
    const receipt=await f.settlement.post('order',run.legs[0].orderId,{externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'50000000',quantityAtomic:'5000',feeAtomic:fee},f.admin)
    await (f.automatic as any).process(run.id)
    return{run,receipt}
  }
  it('submits one real order, requires explicit fees, and settles exactly once without a second fee debit',async()=>{
    const f=await fixture(),key=randomUUID(),run=await f.automatic.evaluate(f.user,1,key)
    expect(run.state).toBe('waiting_orders')
    const replay=await f.automatic.evaluate(f.user,1,key);expect(replay.id).toBe(run.id)
    expect(await db.query(`SELECT id FROM app.orders WHERE user_id=$1`,[f.user])).toHaveLength(1)
    await expect(f.settlement.post('order',run.legs[0].orderId,{externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'50000000',quantityAtomic:'5000'},f.admin)).rejects.toThrow('实际费用')
    const input={externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'50000000',quantityAtomic:'5000',feeAtomic:'100000'}
    const receipt=await f.settlement.post('order',run.legs[0].orderId,input,f.admin)
    await (f.automatic as any).process(run.id);await (f.automatic as any).process(run.id)
    expect((await f.automatic.get(f.user,run.id)).state).toBe('completed')
    expect(await balance(f.user)).toEqual([{purpose:'available',amount:'60000000'},{purpose:'locked',amount:'0'}])
    expect((await f.mandates.get(f.user)).mandate.managedCashAtomic).toBe('50000000')
    expect(await f.settlement.post('order',run.legs[0].orderId,input,f.admin)).toMatchObject({id:receipt.id,replay:true})
    expect((await f.automatic.adminRuns()).find((r:any)=>r.id===run.id).needsReview).toBe(false)
  })
  it('records real settlement then stops on actual fees above authorization',async()=>{
    const f=await fixture(),{run}=await settledBuy(f,'600000')
    expect((await f.automatic.get(f.user,run.id)).state).toBe('attention')
    expect((await f.mandates.get(f.user)).mandate.managedCashAtomic).toBe('50000000')
    expect(await balance(f.user)).toEqual([{purpose:'available',amount:'60000000'},{purpose:'locked',amount:'0'}])
  })
  it('pausing stops new submissions while still reconciling an already submitted real order',async()=>{
    const f=await fixture(),run=await f.automatic.evaluate(f.user,1,randomUUID())
    await f.mandates.changeState(f.user,1,f.session,'paused')
    await expect(f.automatic.cancel(f.user,run.id)).rejects.toThrow('reconciliation')
    await f.settlement.post('order',run.legs[0].orderId,{externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'50000000',quantityAtomic:'5000',feeAtomic:'0'},f.admin)
    await (f.automatic as any).process(run.id)
    expect((await f.automatic.get(f.user,run.id)).state).toBe('paused')
    expect((await f.mandates.get(f.user)).mandate.managedCashAtomic).toBe('50000000')
    await f.automatic.review(run.id,f.admin,'Settled order checked, remaining tasks closed')
    expect((await f.automatic.get(f.user,run.id)).state).toBe('canceled')
    expect(await f.mandates.history(f.user)).toHaveLength(2)
  })
  it('blocks a late receipt exception and offers manual closure without reversing money',async()=>{
    const f=await fixture(),{run,receipt}=await settledBuy(f)
    await f.settlement.review(receipt.id,{state:'exception',note:'Evidence needs manual investigation'},f.admin)
    expect((await f.automatic.adminRuns()).find((r:any)=>r.id===run.id).needsReview).toBe(true)
    const current=(await db.query(`SELECT * FROM app.ai_investment_mandates WHERE id=$1`,[f.mandate.id]))[0]
    await expect((f.automatic as any).snapshot(f.user,current)).rejects.toThrow('prior settlement exception')
    await f.automatic.review(run.id,f.admin,'Manual processing recorded; no automatic reversal')
    expect(await balance(f.user)).toEqual([{purpose:'available',amount:'60000000'},{purpose:'locked',amount:'0'}])
  })
  it('queries all selected account scopes and prevents another user confirming the persisted ticket',async()=>{
    const f=await fixture(),ops=new UserOpsService(db.getRepository(Ticket),db.getRepository(Invitation),db.getRepository(Subscription),db.getRepository(Preference),db.getRepository(Reward),db.getRepository(TicketMessage),db.getRepository(TicketEvent),{assertCleanAttachmentIds:async()=>({})} as any)
    const tools=new AiCustomerToolsService(db,ops)
    const account=await tools.account(f.user,['balances','positions','orders','qualification'])
    expect(account.accountStatus).toBe('active')
    const draft=await tools.draftTicket(f.user,{subject:'Review account',body:'Please check this issue',category:'support'})
    await expect(tools.confirmTicket(randomUUID(),draft.id,true)).rejects.toThrow('not found')
    await expect(tools.confirmTicket(f.user,draft.id,false)).rejects.toThrow('confirmation')
    const [first,second]=await Promise.all([tools.confirmTicket(f.user,draft.id,true),tools.confirmTicket(f.user,draft.id,true)])
    expect(first.ticketId).toBe(second.ticketId)
    expect(await db.query(`SELECT id FROM app.tickets WHERE author_user_id=$1`,[f.user])).toHaveLength(1)
    await expect(db.query(`UPDATE app.ai_investment_mandate_versions SET status='revoked' WHERE mandate_id=$1`,[f.mandate.id])).rejects.toThrow('immutable')
  })
  it('waits for real net redemption proceeds before funding another product',async()=>{
    const f=await fixture();await settledBuy(f)
    const second=randomUUID()
    await db.query(`INSERT INTO app.products(id,asset_class_id,version,display_name,asset_code,asset_decimals,state,published_at) VALUES($1,$2,1,'Second verified asset','AITWO',2,'published',now())`,[second,f.assetClass])
    const terms=await f.knowledge.save(null,{expectedRevision:0,title:'Second terms',summary:'Test only',body:'Zero execution fees, no lock, no guarantees.',category:'terms',locale:'en',visibility:'public',productIds:[second],effectiveAt:null,expiresAt:null} as any,f.admin)
    await f.knowledge.publish(terms.id,1,f.admin)
    await f.mandates.saveRule(second,{expectedRevision:0,state:'enabled',termsKnowledgeId:terms.id,termsRevision:1,riskBand:'balanced',lockDays:0,buyFeeBps:0,buyFeeFixedAtomic:'0',redeemFeeBps:0,redeemFeeFixedAtomic:'0'},f.admin)
    const [position]=await db.query(`SELECT id FROM app.positions WHERE user_id=$1 AND product_id=$2`,[f.user,f.product])
    await f.mandates.confirm(f.user,f.session,{...f.input,expectedRevision:1,allowedProductIds:[f.product,second],cashBudgetAtomic:'50000000',positions:[{positionId:position.id,quantityAtomic:'5000'}]} as any)
    await db.query(`UPDATE app.ai_automatic_legs SET submitted_at=now()-interval '1 hour' WHERE run_id IN(SELECT id FROM app.ai_automatic_runs WHERE user_id=$1)`,[f.user])
    f.model.complete.mockResolvedValue({text:JSON.stringify({cashBps:5000,explanation:'Replace first holding',allocations:[{productId:second,weightBps:5000,reason:'Verified second product'}]}),model:'test-model'})
    const run=await f.automatic.evaluate(f.user,2,randomUUID())
    expect(run.state).toBe('waiting_redemptions');expect(run.legs).toHaveLength(1);expect(run.legs[0].kind).toBe('redeem')
    await (f.automatic as any).process(run.id)
    expect(await db.query(`SELECT id FROM app.orders WHERE user_id=$1 AND product_id=$2`,[f.user,second])).toHaveLength(0)
    await f.settlement.post('redemption',run.legs[0].redemptionId,{externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'49000000',quantityAtomic:'5000',feeAtomic:'100000'},f.admin)
    await (f.automatic as any).process(run.id)
    const after=await f.automatic.get(f.user,run.id)
    expect(after.state).toBe('waiting_orders')
    const buy=after.legs.find((l:any)=>l.kind==='buy')
    expect(buy.notionalAtomic).toBe('49500000')
    await f.settlement.post('order',buy.orderId,{externalReference:randomUUID(),evidenceRef:f.evidenceRef,amountAtomic:'49500000',quantityAtomic:'4950',feeAtomic:'0'},f.admin)
    await (f.automatic as any).process(run.id)
    expect((await f.automatic.get(f.user,run.id)).state).toBe('completed')
    expect((await f.mandates.get(f.user)).mandate.managedCashAtomic).toBe('49500000')
    expect(await balance(f.user)).toEqual([{purpose:'available',amount:'59500000'},{purpose:'locked',amount:'0'}])
  })
  it('serializes concurrent evaluators and recovers an application committed before linking the task',async()=>{
    const f=await fixture(),key=randomUUID()
    const [first,second]=await Promise.all([f.automatic.evaluate(f.user,1,key),f.automatic.evaluate(f.user,1,key)])
    expect(first.id).toBe(second.id)
    expect(f.model.complete).toHaveBeenCalledTimes(1)
    const run=await f.automatic.get(f.user,first.id),order=run.legs[0].orderId
    await db.query(`UPDATE app.ai_automatic_legs SET state='planned',order_id=NULL WHERE run_id=$1`,[run.id])
    await (f.automatic as any).process(run.id)
    expect((await f.automatic.get(f.user,run.id)).legs[0].orderId).toBe(order)
    expect(await db.query(`SELECT id FROM app.orders WHERE user_id=$1`,[f.user])).toHaveLength(1)
    expect(await balance(f.user)).toEqual([{purpose:'available',amount:'60000000'},{purpose:'locked',amount:'50000000'}])
    await expect(f.automatic.get(randomUUID(),run.id)).rejects.toThrow('not found')
  })
  it('keeps execution disabled unless both acceptance and enable flags are explicitly true',async()=>{
    const f=await fixture()
    const disabled=new AiMandateService(db,new ConfigService({AI_AUTOMATIC_EXECUTION_ENABLED:'true',AI_AUTOMATIC_EXECUTION_ACCEPTED:'false'}),{} as any)
    expect(disabled.executionEnabled).toBe(false)
    expect(()=>disabled.assertExecutionEnabled()).toThrow('awaits isolated acceptance')
    const source=(await f.mandates.get(f.user)).mandate
    expect(source.revision).toBe(1)
    await expect(f.mandates.confirm(f.user,f.session,{...f.input,expectedRevision:0} as any)).rejects.toThrow('changed')
  })
})
