import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { QuantService } from '../../src/quant/quant.service'
import { LedgerService } from '../../src/ledger/ledger.service'
import { ReferralTeamService } from '../../src/referral/referral-team.service'

const isolated=process.env.REFERRAL_MIGRATION_DATABASE
const suite=isolated?describe:describe.skip
suite('referral deployment preserves existing subscriptions and scheduled rules',()=>{
  let db:DataSource,quant:QuantService,team:ReferralTeamService,user:string,inviter:string,slug:string,firstId:string,baseline:number
  beforeAll(async()=>{
    if(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)!==isolated||!/^areit_referral_activation_[a-z0-9]+_test$/.test(isolated!))throw new Error('Dedicated migration test database required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'}));await db.initialize()
    const all=[...db.migrations];db.migrations.splice(0,db.migrations.length,...all.filter(m=>Number((m.name??m.constructor.name).slice(-13))<1792700000000))
    await db.runMigrations({transaction:'all'});db.migrations.splice(0,db.migrations.length,...all)
    const [s]=await db.query('SELECT version,config FROM app.referral_settings WHERE team_effective_at<=now() ORDER BY team_effective_at DESC,version DESC LIMIT 1');baseline=s.version
    await db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,now()+interval '2 months',now()+interval '2 months',now()+interval '2 months')`,[JSON.stringify({...s.config,teamEnabled:false})])
    const users=await db.query(`INSERT INTO app.users(status) VALUES('active'),('active') RETURNING id`);[inviter,user]=users.map((r:any)=>r.id)
    const code=`h${randomUUID().replace(/-/g,'').slice(0,10)}`
    await db.query(`INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)`,[code,inviter])
    await db.query(`INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id,code) VALUES($1,$2,$3)`,[inviter,user,code])
    const [p]=await db.query(`INSERT INTO app.quant_products(slug,name,status,min_subscription_atomic) VALUES($1,'Historical test','active',1000000) RETURNING slug`,[`history-${randomUUID().slice(0,8)}`]);slug=p.slug
    await db.transaction(async m=>{
      const [available]=await m.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit') RETURNING id`,[user])
      const [fund]=await m.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES('platform',$1,'settlement','USDT',6,'debit',true) RETURNING id`,[randomUUID()])
      const [t]=await m.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,effective_at) VALUES('deposit',$1,'migration-test','test',gen_random_uuid(),'service',now()) RETURNING id`,[randomUUID()])
      await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',1000000000),($1,$3,'credit',1000000000)`,[t.id,fund.id,available.id])
    })
    quant=new QuantService(db,new LedgerService(db),{assertEnabled:async()=>{}} as never,{requireInvestmentEligibility:async()=>{}} as never)
    const first=await quant.subscribe(user,slug,'100','before-deployment','test');firstId=String(first.order!.id)
    await db.runMigrations({transaction:'all'});team=new ReferralTeamService(db)
  },120000)
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  it('preserves historical first success without a new historical reward or a later second reward',async()=>{
    const [first]=await db.query(`SELECT order_id,reward_eligible FROM app.referral_quant_first_subscriptions WHERE user_id=$1`,[user])
    expect(first).toEqual({order_id:firstId,reward_eligible:false})
    await quant.subscribe(user,slug,'100','after-deployment','test')
    const [rewards]=await db.query(`SELECT count(*)::int AS n FROM app.referral_rewards WHERE source_user_id=$1 AND source_type='quant_subscription'`,[user]);expect(rewards.n).toBe(0)
  })
  it('activates the currently effective rules without pulling future settings forward or backfilling months',async()=>{
    const [activation]=await db.query('SELECT settings_version FROM app.referral_team_activation');expect(activation.settings_version).toBe(baseline)
    expect((await team.status()).enabled).toBe(true)
    await expect(team.generateMonth('2026-09')).rejects.toMatchObject({response:{code:'REFERRAL_TEAM_BEFORE_ACTIVATION'}})
    expect((await db.query('SELECT * FROM app.referral_team_batches'))).toEqual([])
    await expect(db.query(`UPDATE app.referral_team_activation SET activated_at=now()-interval '1 year'`)).rejects.toBeTruthy()
  })
})
