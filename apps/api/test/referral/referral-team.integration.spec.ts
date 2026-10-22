import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { ReferralTeamService } from '../../src/referral/referral-team.service'
import { REFERRAL_DEFAULT_SETTINGS } from '../../src/referral/referral-policy'
const database = process.env.TEST_DATABASE_URL ? describe : describe.skip
database('prospective team settlement (PostgreSQL)', () => {
  let db: DataSource, team: ReferralTeamService, a: string, b: string, c: string, feeAccount: string, funding: string
  const month = '2026-09', admin = randomUUID()
  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' })); await db.initialize(); await db.runMigrations({ transaction: 'all' }); team = new ReferralTeamService(db)
    const [s] = await db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at) VALUES($1,'2026-09-01','2026-09-01','2026-09-01') RETURNING version`,[JSON.stringify(REFERRAL_DEFAULT_SETTINGS)])
    // Isolated test deployment simulation only: production activation is immutable and starts at migration time.
    await db.query('ALTER TABLE app.referral_team_activation DISABLE TRIGGER USER')
    await db.query(`UPDATE app.referral_team_activation SET activated_at='2026-09-15T00:00:00Z',settings_version=$1`,[s.version])
    await db.query('ALTER TABLE app.referral_team_activation ENABLE TRIGGER USER')
    for(const key of ['a','b','c']) {
      const [u]=await db.query(`INSERT INTO app.users(status) VALUES('active') RETURNING id`)
      if(key==='a')a=u.id;else if(key==='b')b=u.id;else c=u.id
      await db.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side) VALUES('user',$1,'available','USDT',6,'credit')`,[u.id])
    }
    for(const [up,down] of [[a,b],[b,c]]) {
      const code=`t${randomUUID().replace(/-/g,'').slice(0,10)}`
      await db.query(`INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)`,[code,up])
      await db.query(`INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id,code,bound_at) VALUES($1,$2,$3,'2026-09-01')`,[up,down,code])
    }
    const [f]=await db.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side,allow_negative) VALUES('platform',$1,'settlement','USDT',6,'debit',true) RETURNING id`,[randomUUID()]);funding=f.id
    await db.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side) VALUES('platform','prediction_fee','fee_revenue','USDT',6,'credit') ON CONFLICT DO NOTHING`)
    const [account]=await db.query(`SELECT id FROM app.ledger_accounts WHERE owner_reference='prediction_fee' AND purpose='fee_revenue' AND asset_code='USDT' AND network IS NULL`);feeAccount=account.id
  })
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  async function fee(user:string,amount:string,at='2026-09-20T00:00:00Z',side='credit',component='prediction_stake',actor=user) {
    await db.transaction(async m=> {
      const [original]=side==='debit'?await m.query(`SELECT id FROM app.ledger_transactions WHERE actor_id=$1 AND transaction_type=$3 AND effective_at=$2 ORDER BY created_at LIMIT 1`,[user,at,component]):[]
      const [t]=await m.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,actor_id,effective_at,reverses_transaction_id) VALUES($1,$2,'team-test','prediction_bet',gen_random_uuid(),'user',$3,$4,$5) RETURNING id`,[side==='credit'?component:'reversal',randomUUID(),actor,at,original?.id??null])
      await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,$4,$5),($1,$3,$6,$5)`,[t.id,funding,feeAccount,side==='credit'?'debit':'credit',amount,side])
    })
  }
  it('excludes pre-activation fees, requires direct activity and uses progressive segments',async()=> {
    await fee(c,'50000000000','2026-09-14T00:00:00Z')
    await fee(c,'11900000000')
    let batch=await team.generateMonth(month)
    expect(batch.awards.find((x:any)=>x.userId===a)).toBeUndefined() // indirect activity alone is insufficient
    await fee(b,'100000000')
    batch=await team.generateMonth(month)
    expect(batch.awards.find((x:any)=>x.userId===a)).toMatchObject({baseAtomic:'12000000000',amountAtomic:'700000000'})
    expect(batch.awards.find((x:any)=>x.userId===b)).toMatchObject({baseAtomic:'11900000000',amountAtomic:'690000000'})
    const again=await team.generateMonth(month);expect(again.id).toBe(batch.id)
    await expect(team.generateMonth('2099-01')).rejects.toThrow()
  })
  it('refuses stale approval after fee correction, then refreshes and pays once through balanced ledger',async()=> {
    const old=await team.generateMonth(month)
    await fee(c,'100000000',undefined,'debit')
    await expect(team.approve(old.id,admin)).rejects.toMatchObject({response:{code:'REFERRAL_TEAM_STALE'}})
    const fresh=await team.generateMonth(month)
    expect(fresh.id).not.toBe(old.id)
    expect(fresh.awards.find((x:any)=>x.userId===a)).toMatchObject({baseAtomic:'11900000000',amountAtomic:'690000000'})
    await expect(team.pay(fresh.id,admin,'test-payment')).rejects.toThrow()
    await team.approve(fresh.id,admin)
    const [budget]=await db.query(`SELECT current_atomic_balance::text AS amount FROM app.ledger_account_balances WHERE account_id=$1`,[feeAccount])
    async function moveBudget(side:'debit'|'credit'){
      await db.transaction(async m=>{
        const [t]=await m.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,actor_id,effective_at) VALUES('referral_reward',$1,'isolated-budget-test','referral_budget',gen_random_uuid(),'admin',$2,now()) RETURNING id`,[randomUUID(),admin])
        await m.query(`INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,$4,$5),($1,$3,$6,$5)`,[t.id,feeAccount,funding,side,budget.amount,side==='debit'?'credit':'debit'])
      })
    }
    await moveBudget('debit')
    await expect(team.pay(fresh.id,admin,'test-payment')).rejects.toMatchObject({response:{code:'REFERRAL_TEAM_INSUFFICIENT_FUNDING'}})
    const [unchanged]=await db.query(`SELECT status FROM app.referral_team_batches WHERE id=$1`,[fresh.id]);expect(unchanged.status).toBe('approved')
    await moveBudget('credit')
    const blocker=db.createQueryRunner();await blocker.connect();await blocker.startTransaction()
    try {
      await db.query(`INSERT INTO app.ledger_account_balances(account_id,current_atomic_balance) SELECT id,0 FROM app.ledger_accounts WHERE user_id=$1 AND purpose='available' ON CONFLICT DO NOTHING`,[a])
      await blocker.query(`SELECT balance.account_id FROM app.ledger_account_balances balance JOIN app.ledger_accounts account ON account.id=balance.account_id WHERE account.user_id=$1 AND account.purpose='available' FOR UPDATE OF balance`,[a])
      await expect(team.pay(fresh.id,admin,'busy-payment')).rejects.toMatchObject({response:{code:'REFERRAL_TEAM_BUSY'}})
    }finally{await blocker.rollbackTransaction();await blocker.release()}
    const [paid,concurrent]=await Promise.all([team.pay(fresh.id,admin,'test-payment'),team.pay(fresh.id,admin,'other-payment')])
    expect(concurrent.ledgerTransactionId).toBe(paid.ledgerTransactionId)
    expect(paid.status).toBe('paid')
    const replay=await team.pay(fresh.id,admin,'test-payment');expect(replay.ledgerTransactionId).toBe(paid.ledgerTransactionId)
    const [count]=await db.query(`SELECT count(*)::int AS n FROM app.ledger_transactions WHERE reference_type='referral_team_batch' AND reference_id=$1`,[fresh.id]);expect(count.n).toBe(1)
    const [balance]=await db.query(`SELECT balance.current_atomic_balance::text AS amount FROM app.ledger_accounts account JOIN app.ledger_account_balances balance ON balance.account_id=account.id WHERE account.user_id=$1 AND account.purpose='available'`,[a]);expect(balance.amount).toBe('690000000')
    const [sum]=await db.query(`SELECT sum(atomic_amount) FILTER(WHERE side='debit')::text AS d,sum(atomic_amount) FILTER(WHERE side='credit')::text AS c FROM app.ledger_entries WHERE transaction_id=$1`,[paid.ledgerTransactionId]);expect(sum.d).toBe(sum.c)
    await expect(db.query(`UPDATE app.referral_team_awards SET amount_atomic=1 WHERE batch_id=$1`,[fresh.id])).rejects.toBeTruthy()
  })
  it('matches reversed components and original customer even when an admin posts the reversal',async()=>{
    const [up,down]=await db.query(`INSERT INTO app.users(status) VALUES('active'),('active') RETURNING id`)
    const code=`t${randomUUID().replace(/-/g,'').slice(0,10)}`
    await db.query(`INSERT INTO app.referral_code_aliases(code,user_id) VALUES($1,$2)`,[code,up.id])
    await db.query(`INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id,code,bound_at) VALUES($1,$2,$3,'2026-09-01')`,[up.id,down.id,code])
    await fee(down.id,'100000000')
    await fee(down.id,'100000000',undefined,'credit','prediction_payout')
    await fee(down.id,'100000000',undefined,'debit','prediction_payout',admin)
    const cfg={...REFERRAL_DEFAULT_SETTINGS,feeComponents:['prediction_place']}
    const [basis]=await db.query(`SELECT base_atomic::text,active FROM app.referral_team_basis('2026-09-15','2026-10-01',$1) WHERE user_id=$2`,[JSON.stringify(cfg),up.id])
    expect(basis).toEqual({base_atomic:'100000000',active:true})
    await fee(down.id,'100000000',undefined,'debit','prediction_stake',admin)
    const [net]=await db.query(`SELECT base_atomic::text,active FROM app.referral_team_basis('2026-09-15','2026-10-01',$1) WHERE user_id=$2`,[JSON.stringify(cfg),up.id])
    expect(net).toEqual({base_atomic:'0',active:false})
  })
})
