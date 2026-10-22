import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { LedgerService } from '../../src/ledger/ledger.service'
import { QuantService } from '../../src/quant/quant.service'
import { OperationalCapabilityService } from '../../src/operations/operational-capability.service'
import { ComplianceService } from '../../src/compliance/compliance.service'
import { REFERRAL_DEFAULT_SETTINGS } from '../../src/referral/referral-policy'
import { recordReferralRewards } from '../../src/referral/referral-rewards'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('Koala first successful referral subscription (PostgreSQL)', () => {
  let db: DataSource
  let quant: QuantService
  let slug: string
  let sourceUser: string
  let inviter: string
  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations({ transaction: 'all' })
    quant = new QuantService(db, new LedgerService(db), { assertEnabled: async () => {} } as unknown as OperationalCapabilityService,
      { requireInvestmentEligibility: async () => {} } as unknown as ComplianceService)
    const [p] = await db.query(`INSERT INTO app.quant_products(slug,name,status,min_subscription_atomic) VALUES($1,'Test','active',1000000) RETURNING slug`, [`ref-${randomUUID().slice(0,8)}`])
    slug=p.slug
    await db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,now(),now(),now())`,[JSON.stringify({...REFERRAL_DEFAULT_SETTINGS,holdingRatesBps:[600,300,100]})])
  })
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  beforeEach(async()=>{
    const [a]=await db.query(`INSERT INTO app.users(status) VALUES('active') RETURNING id`)
    const [u]=await db.query(`INSERT INTO app.users(status) VALUES('active') RETURNING id`)
    inviter=a.id;sourceUser=u.id
    const code=`r${randomUUID().replace(/-/g,'').slice(0,10)}`
    await db.query(`INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)`,[code,inviter])
    await db.query(`INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)`,[sourceUser,inviter,code])
    const [account]=await db.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit') RETURNING id`,[sourceUser])
    const [fund]=await db.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES('platform',$1,'settlement','USDT',6,'debit',true) RETURNING id`,[randomUUID()])
    await db.transaction(async m=>{
      const [tx]=await m.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,effective_at) VALUES('deposit',$1,'test','test',gen_random_uuid(),'service',now()) RETURNING id`,[randomUUID()])
      await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',1000000000),($1,$3,'credit',1000000000)`,[tx.id,fund.id,account.id])
    })
  })
  const rewards=()=>db.query(`SELECT source_id,amount_atomic::text AS amount FROM app.referral_rewards WHERE source_type='quant_subscription' AND source_user_id=$1`,[sourceUser])
  it('awards only the first settled subscription and does not award a retry or a topup',async()=>{
    const first=await quant.subscribe(sourceUser,slug,'100','first-subscription','test')
    expect(await rewards()).toEqual([{source_id:first.order!.id,amount:'6000000'}])
    await quant.subscribe(sourceUser,slug,'100','first-subscription','test')
    await quant.subscribe(sourceUser,slug,'200','later-subscription','test')
    expect(await rewards()).toHaveLength(1)
  })
  it('serializes concurrent successful subscriptions into one global first reward',async()=>{
    await Promise.all([quant.subscribe(sourceUser,slug,'100','concurrent-one','test'),quant.subscribe(sourceUser,slug,'200','concurrent-two','test')])
    const rows=await rewards();expect(rows).toHaveLength(1)
    const [first]=await db.query(`SELECT order_id FROM app.referral_quant_first_subscriptions WHERE user_id=$1`,[sourceUser])
    expect(rows[0].source_id).toBe(first.order_id)
  })
  it('does not consume first-success eligibility for a failed or pending subscription',async()=>{
    await expect(quant.subscribe(sourceUser,slug,'2000','failed-subscription','test')).rejects.toBeTruthy()
    const [p]=await db.query(`SELECT id FROM app.quant_products WHERE slug=$1`,[slug])
    await db.query(`INSERT INTO app.quant_orders(product_id,user_id,kind,amount_atomic,effective_date,idempotency_key) VALUES($1,$2,'subscription',1000000,current_date,'pending-subscription')`,[p.id,sourceUser])
    await quant.subscribe(sourceUser,slug,'100','successful-after-fail','test')
    expect((await rewards())[0].amount).toBe('6000000')
  })
  it('does not award a later subscription if the first success happened with rewards disabled',async()=>{
    const off={...REFERRAL_DEFAULT_SETTINGS,holdingEnabled:false,holdingRatesBps:[600,300,100]}
    await db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,now(),now(),now())`,[JSON.stringify(off)])
    await quant.subscribe(sourceUser,slug,'100','success-disabled','test')
    await db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,now(),now(),now())`,[JSON.stringify({...off,holdingEnabled:true})])
    await quant.subscribe(sourceUser,slug,'200','success-after-enable','test')
    expect(await rewards()).toEqual([])
  })
  it('rejects forged source amounts and later-source direct database insertions',async()=>{
    const first=await quant.subscribe(sourceUser,slug,'100','source-first','test')
    const later=await quant.subscribe(sourceUser,slug,'100','source-later','test')
    const [s]=await db.query('SELECT max(version) AS v FROM app.referral_settings')
    const insert=(order:string,base:string)=>db.query(`INSERT INTO app.referral_rewards(user_id,source_user_id,kind,source_type,source_id,level,settings_version,rate_bps,base_atomic,amount_atomic) VALUES($1,$2,'purchase','quant_subscription',$3,1,$4,600,$5::numeric,floor($5::numeric*600/10000))`,[inviter,sourceUser,order,s.v,base])
    await expect(insert(String(first.order!.id),'200000000')).rejects.toMatchObject({code:'23514'})
    await expect(insert(String(later.order!.id),'100000000')).rejects.toMatchObject({code:'23514'})
    await expect(db.query(`UPDATE app.quant_orders SET amount_atomic=200000000 WHERE id=$1`,[first.order!.id])).rejects.toBeTruthy()
    expect(await db.transaction(m=>recordReferralRewards(m,{kind:'purchase',sourceType:'quant_subscription' as any,sourceId:String(later.order!.id),sourceUserId:sourceUser,baseAtomic:'100000000'}))).toEqual([])
  })
})