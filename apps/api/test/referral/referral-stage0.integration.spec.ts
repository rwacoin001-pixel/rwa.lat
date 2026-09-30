import { DataSource } from 'typeorm'
import { createHmac, randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { ReferralStageZero1790760000000 } from '../../src/database/migrations/1790760000000-referral-stage-zero'
import { ReferralBindingService } from '../../src/referral/referral-binding.service'
import { ReferralContext } from '../../src/referral/referral-context'
import { ReferralFoundationService } from '../../src/referral/referral-foundation.service'
import { ReferralReadService } from '../../src/referral/referral-read.service'
import { REFERRAL_DEFAULT_SETTINGS } from '../../src/referral/referral-policy'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { OAuthProviderService } from '../../src/identity/oauth-provider.service'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from '../../src/identity/identity-passkey-challenge.entity'
import { PasskeyCredential } from '../../src/security/passkey-credential.entity'
import { REGISTRATION_CONSENT_REQUIREMENTS } from '../../src/identity/consent-policy'
import { SessionAuthService } from '../../src/security/session-auth.service'
import { AdminSessionAuthService } from '../../src/admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../../src/admin-rbac/admin-rbac.service'
import { ReferralContextInterceptor,ReferralLandingController,ReferralUserFoundationController,ReferralAdminFoundationController } from '../../src/referral/referral-http.module'
import { ValidationPipe,RequestMethod,UnauthorizedException,ForbiddenException,INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'

const isolated=process.env.REFERRAL_ISOLATED_DATABASE
const suite=isolated?describe:describe.skip
suite('referral stage zero isolated PostgreSQL',()=>{
  let db:DataSource,binding:ReferralBindingService,core:ReferralFoundationService,context:ReferralContext
  let identity:IdentityService,crypto:IdentityCrypto,delivery:IdentityDeliveryService,http:INestApplication,base:string
  const consents=REGISTRATION_CONSENT_REQUIREMENTS.map(c=>({...c,accepted:true as const})).map(({documentType,version,accepted})=>({documentType,version,accepted}))
  const stats:Record<string,unknown>={}
  beforeAll(async()=>{
    const name=new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)
    if(name!==isolated || !/^rwa_referral_stage0_[a-f0-9]{12}_test$/.test(name))throw new Error('Dedicated test database required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'}));await db.initialize()
    await db.runMigrations({transaction:'all'})
    const migration=new ReferralStageZero1790760000000(),q=db.createQueryRunner();await q.connect();await q.startTransaction()
    try{
      await migration.down(q)
      const [legacyUser]=await q.query('INSERT INTO app.users DEFAULT VALUES RETURNING id')
      const [legacyReward]=await q.query("INSERT INTO app.rewards(user_id,kind,amount_atomic,currency) VALUES($1,'promo',12345,'USD') RETURNING *",[legacyUser.id])
      await migration.up(q)
      expect((await q.query('SELECT * FROM app.rewards WHERE id=$1',[legacyReward.id]))[0]).toEqual(legacyReward)
      await q.commitTransaction();stats.emptyUpDown=true;stats.legacyRewardPreserved=true
    }
    finally{if(q.isTransactionActive)await q.rollbackTransaction();await q.release()}
    context=new ReferralContext();binding=new ReferralBindingService(db,new ConfigService({IDENTITY_HMAC_KEY:'11'.repeat(32)}),context)
    core=new ReferralFoundationService(db)
    const config=new ConfigService({AUTH_ADAPTER:'demo',IDENTITY_HMAC_KEY:'a'.repeat(64),IDENTITY_ENC_KEY:'b'.repeat(64)})
    crypto=new IdentityCrypto(config);delivery=new IdentityDeliveryService(config)
    const oauth={
      begin:async (provider:string,intent:string,registrationConsents:unknown)=>{
        const state=randomUUID()
        await db.query(`INSERT INTO app.oauth_authorization_flows(provider,state_hash,redirect_uri,expires_at,encryption_key_version,code_verifier_ciphertext)
          VALUES($1,$2,'http://localhost/callback',now()+interval '10 minutes',1,$3)`,[provider,crypto.hashToken(state),crypto.encrypt('isolated-pkce-fixture').ciphertext])
        return {authorizationUrl:`http://localhost/callback?state=${state}`,provider,intent,registrationConsents}
      },
      exchange:async (_provider:string,_code:string,state:string)=>{
        const rows=await db.query('UPDATE app.oauth_authorization_flows SET consumed_at=now() WHERE state_hash=$1 AND consumed_at IS NULL RETURNING id',[crypto.hashToken(state)])
        if(!rows.length)throw new UnauthorizedException('Invalid test OAuth state')
        return {subject:state,intent:'register',registrationConsents:consents,consentedAt:new Date()}
      },
    } as unknown as OAuthProviderService
    identity=new IdentityService(db.getRepository(User),db.getRepository(LoginIdentity),db.getRepository(Device),db.getRepository(Session),
      db.getRepository(IdentityOneTimeToken),db.getRepository(PasskeyCredential),db.getRepository(IdentityPasskeyChallenge),crypto,delivery,oauth,config,db,binding)
    const sessions=new SessionAuthService(db.getRepository(Session),crypto)
    const module=await Test.createTestingModule({controllers:[ReferralLandingController,ReferralUserFoundationController,ReferralAdminFoundationController],providers:[
      {provide:ReferralReadService,useValue:new ReferralReadService(db)}, {provide:ReferralBindingService,useValue:binding},{provide:ReferralFoundationService,useValue:core},{provide:ReferralContext,useValue:context},
      {provide:ConfigService,useValue:config},{provide:SessionAuthService,useValue:sessions},
      {provide:AdminSessionAuthService,useValue:{authenticate:async()=>{throw new UnauthorizedException()}}},
      {provide:AdminRbacService,useValue:{assertPermission:async()=>{throw new ForbiddenException()}}},
      {provide:APP_INTERCEPTOR,useClass:ReferralContextInterceptor},
    ]}).compile()
    http=module.createNestApplication({logger:false});http.setGlobalPrefix('v1',{exclude:[{path:'r/:code',method:RequestMethod.GET}]})
    http.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}))
    await http.listen(0,'127.0.0.1');base=await http.getUrl()
  },120000)
  afterAll(async()=>{
    if(http)await http.close();delivery?.onModuleDestroy()
    if(db?.isInitialized){
      const constraints=await db.query(`SELECT c.relname,con.conname,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con
        JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='app' AND (c.relname LIKE 'referral_%' OR c.relname IN ('credit_balances','credit_entries')) ORDER BY c.relname,con.conname`)
      const fs=await import('node:fs'),path=await import('node:path')
      fs.writeFileSync(path.join(__dirname,'../../tools/referral-stage0-evidence/schema-tests.json'),JSON.stringify({...stats,constraints},null,2))
      await db.destroy()
    }
  })
  async function user(){return (await db.query('INSERT INTO app.users DEFAULT VALUES RETURNING id'))[0].id as string}
  async function fee(){
    const u=await user(),q=db.createQueryRunner();await q.connect();await q.startTransaction()
    try{
      const [account]=await q.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES('platform','prediction_fee','fee_revenue','USDT',6,'credit') ON CONFLICT DO NOTHING RETURNING id`)
      const id=account?.id ?? (await q.query("SELECT id FROM app.ledger_accounts WHERE owner_reference='prediction_fee' AND purpose='fee_revenue'"))[0].id
      const [counter]=await q.query(`INSERT INTO app.ledger_accounts(owner_type,owner_reference,purpose,asset_code,asset_decimals,normal_side)
        VALUES('platform',$1,'settlement','USDT',6,'debit') RETURNING id`,[randomUUID()])
      const [tx]=await q.query(`INSERT INTO app.ledger_transactions(transaction_type,idempotency_key,request_id,reference_type,reference_id,actor_type,actor_id,effective_at)
        VALUES('prediction_stake',$1,'isolated-test','prediction_bet',$2,'user',$3,now()) RETURNING id`,[randomUUID(),randomUUID(),u])
      await q.query("INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'debit',1000000)",[tx.id,counter.id])
      const [entry]=await q.query("INSERT INTO app.ledger_entries(transaction_id,account_id,side,atomic_amount) VALUES($1,$2,'credit',1000000) RETURNING id",[tx.id,id])
      await q.commitTransaction();return {entry:entry.id,user:u}
    }finally{if(q.isTransactionActive)await q.rollbackTransaction();await q.release()}
  }
  async function capture(id:string){return db.transaction(m=>core.captureFee(m.queryRunner!,id,'prediction_place'))}

  it('round-trips empty migration and seeds payouts disabled with immutable policy',async()=>{
    expect(stats.emptyUpDown).toBe(true)
    expect((await db.query('SELECT payouts_enabled FROM app.referral_runtime'))[0].payouts_enabled).toBe(false)
    await expect(db.query('UPDATE app.referral_runtime SET payouts_enabled=true')).rejects.toMatchObject({code:'23514'})
    await expect(db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at)
      VALUES($1,now(),now(),now())`,[JSON.stringify({...REFERRAL_DEFAULT_SETTINGS,claimExclusive:false})])).rejects.toMatchObject({code:'23514'})
    await expect(db.query(`INSERT INTO app.referral_settings(config,fee_effective_at,holding_effective_at,team_effective_at)
      VALUES($1,now(),now(),now())`,[JSON.stringify({...REFERRAL_DEFAULT_SETTINGS,feeRatesBps:[20.5,10,5]})])).rejects.toMatchObject({code:'23514'})
  })
  it('creates immutable settings versions and schedules rate groups independently',async()=>{
    const at=new Date('2026-09-30T09:00:00Z'),actor=randomUUID()
    const before=(await core.settings()).find(s=>s.version===1)
    const next=await core.saveSettings({...REFERRAL_DEFAULT_SETTINGS,feeRatesBps:[3000,1000,500]},actor,at)
    expect(next.fee_effective_at.toISOString()).toBe(at.toISOString())
    expect(next.holding_effective_at.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(next.team_effective_at.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    const back=await core.rollbackSettings(1,actor)
    expect(back.version).toBeGreaterThan(next.version);expect(back.config.feeRatesBps).toEqual([2000,1000,500])
    expect((await core.settings()).find(s=>s.version===1)).toEqual(before)
    await expect(core.saveSettings({...REFERRAL_DEFAULT_SETTINGS,payoutsEnabled:true},actor)).rejects.toThrow('Invalid')
  })
  it('binds signed attribution only during insertion and keeps first-click attribution',async()=>{
    const a=await user(),b=await user(),codeA=await binding.getCode(a),codeB=await binding.getCode(b)
    const first=await binding.land(codeA),second=await binding.land(codeB,first.token)
    expect(second.token).toBe(first.token)
    const child=await db.transaction(async m=>{const [u]=await m.query('INSERT INTO app.users DEFAULT VALUES RETURNING id');await binding.bindNewUser(m,u.id,first.token);return u.id})
    expect((await db.query('SELECT inviter_user_id FROM app.referral_edges WHERE invitee_user_id=$1',[child]))[0].inviter_user_id).toBe(a)
    await expect(db.transaction(m=>binding.bindNewUser(m,b,first.token))).rejects.toThrow('Existing accounts')
    await expect(db.query('UPDATE app.referral_edges SET inviter_user_id=$1 WHERE invitee_user_id=$2',[b,child])).rejects.toMatchObject({code:'55000'})
  })
  it('invalid or expired credentials do not bind and cannot be replayed after registration',async()=>{
    const a=await user(),code=await binding.getCode(a),valid=await binding.land(code)
    const child=await db.transaction(async m=>{const [u]=await m.query('INSERT INTO app.users DEFAULT VALUES RETURNING id');await binding.bindNewUser(m,u.id,valid.token.slice(0,-1)+'!');return u.id})
    await db.transaction(m=>binding.bindNewUser(m,child,valid.token))
    expect(await db.query('SELECT 1 FROM app.referral_edges WHERE invitee_user_id=$1',[child])).toHaveLength(0)
    const [expired]=await db.query(`INSERT INTO app.referral_attributions(inviter_user_id,code,clicked_at,expires_at)
      VALUES($1,$2,now()-interval '31 days',now()-interval '1 day') RETURNING id`,[a,code])
    const token=expired.id+'.'+createHmac('sha256',Buffer.from('11'.repeat(32),'hex')).update(`referral-attribution:v1:${expired.id}`).digest('base64url')
    const noParent=await db.transaction(async m=>{const [u]=await m.query('INSERT INTO app.users DEFAULT VALUES RETURNING id');await binding.bindNewUser(m,u.id,token);return u.id})
    expect(await db.query('SELECT 1 FROM app.referral_edges WHERE invitee_user_id=$1',[noParent])).toHaveLength(0)
  })
  it('serializes competing parents for the same newly inserted user',async()=>{
    const a=await user(),b=await user(),ca=await binding.getCode(a),cb=await binding.getCode(b)
    const child=await user()
    const results=await Promise.allSettled([a,b].map((p,i)=>db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)',[child,p,i===0?ca:cb])))
    expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1)
    expect(await db.query('SELECT 1 FROM app.referral_edges WHERE invitee_user_id=$1',[child])).toHaveLength(1)
  })
  it('prevents a five-node cycle and concurrent reciprocal bindings at database boundary',async()=>{
    const people=await Promise.all(Array.from({length:5},()=>user())),codes=await Promise.all(people.map(p=>binding.getCode(p)))
    for(let i=1;i<5;i++)await db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)',[people[i],people[i-1],codes[i-1]])
    await expect(db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)',[people[0],people[4],codes[4]])).rejects.toMatchObject({code:'23514'})
    const x=await user(),y=await user(),cx=await binding.getCode(x),cy=await binding.getCode(y)
    const result=await Promise.allSettled([
      db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)',[x,y,cy]),
      db.query('INSERT INTO app.referral_edges(invitee_user_id,inviter_user_id,code) VALUES($1,$2,$3)',[y,x,cx]),
    ])
    expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  })
  it('captures one source and one transactional queue job under parallel delivery',async()=>{
    const f=await fee(),ids=await Promise.all(Array.from({length:8},()=>capture(f.entry)))
    expect(new Set(ids).size).toBe(1)
    expect(await db.query('SELECT 1 FROM app.referral_events WHERE fee_entry_id=$1',[f.entry])).toHaveLength(1)
    expect(await db.query('SELECT 1 FROM app.job_queue WHERE dedup_key=$1',[`referral-event:${ids[0]}`])).toHaveLength(1)
    await expect(db.query('UPDATE app.referral_events SET amount_atomic=1 WHERE id=$1',[ids[0]])).rejects.toMatchObject({code:'55000'})
  })
  it('routes root landing and rejects unauthenticated or forged-actor API access',async()=>{
    const inviter=await user(),code=await binding.getCode(inviter)
    const result=await fetch(`${base}/r/${code}`)
    expect(result.status).toBe(200);expect(result.headers.get('set-cookie')).toContain('HttpOnly')
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect((await result.json() as {registrationOnly:boolean}).registrationOnly).toBe(true)
    expect((await fetch(`${base}/v1/referral/me`)).status).toBe(401)
    expect((await fetch(`${base}/v1/admin/referral/runtime`,{headers:{'x-actor-admin-id':inviter}})).status).toBe(401)
    expect((await fetch(`${base}/v1/admin/referral/settings/save`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({config:{payoutsEnabled:true}})})).status).toBe(401)
  })
  it('integrates real email registration and preserves its first attribution on retry',async()=>{
    const inviter=await user(),other=await user(),token=(await binding.land(await binding.getCode(inviter))).token
    const email=`${randomUUID()}@example.test`
    const id=await context.run(token,()=>identity.prepareEmailRegistration(email,'en',consents))
    expect((await db.query('SELECT inviter_user_id FROM app.referral_edges WHERE invitee_user_id=$1',[id]))[0].inviter_user_id).toBe(inviter)
    const otherToken=(await binding.land(await binding.getCode(other))).token
    expect(await context.run(otherToken,()=>identity.prepareEmailRegistration(email,'en',consents))).toBe(id)
    expect((await db.query('SELECT inviter_user_id FROM app.referral_edges WHERE invitee_user_id=$1',[id]))[0].inviter_user_id).toBe(inviter)
  })
  it('binds a newly verified wallet in the same wallet registration transaction',async()=>{
    const inviter=await user(),token=(await binding.land(await binding.getCode(inviter))).token
    const priv=secp256k1.utils.randomPrivateKey(),pub=secp256k1.getPublicKey(priv,false)
    const address='0x'+Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
    const challenge=await identity.createWalletChallenge(address,1)
    const prefix=`\x19Ethereum Signed Message:\n${Buffer.byteLength(challenge.nonce)}${challenge.nonce}`
    const sig=secp256k1.sign(keccak_256(Buffer.from(prefix)),priv)
    const signature='0x'+Buffer.concat([Buffer.from(sig.r.toString(16).padStart(64,'0'),'hex'),Buffer.from(sig.s.toString(16).padStart(64,'0'),'hex'),Buffer.from([sig.recovery!+27])]).toString('hex')
    const auth=await context.run(token,()=>identity.verifyWalletSignature(address,signature,challenge.nonce,undefined,consents))
    expect((await db.query('SELECT inviter_user_id FROM app.referral_edges WHERE invitee_user_id=$1',[auth.userId]))[0].inviter_user_id).toBe(inviter)
  })
  it('persists attribution across OAuth without a callback cookie and leaves logins unchanged',async()=>{
    const inviter=await user(),token=(await binding.land(await binding.getCode(inviter))).token
    const flow=await context.run(token,()=>identity.beginOAuth('google','register',consents))
    const state=new URL(flow.authorizationUrl).searchParams.get('state')!
    const auth=await identity.exchangeOAuthCode('google','isolated-fixture',state)
    expect((await db.query('SELECT inviter_user_id FROM app.referral_edges WHERE invitee_user_id=$1',[auth.userId]))[0].inviter_user_id).toBe(inviter)
    const claim=await fetch(`${base}/v1/referral/claim`,{method:'POST',headers:{authorization:`Bearer ${auth.token}`}})
    expect(claim.status).toBe(503)
    const me=await fetch(`${base}/v1/referral/me`,{headers:{authorization:`Bearer ${auth.token}`}})
    expect(me.status).toBe(200);expect((await me.json() as {payoutsEnabled:boolean}).payoutsEnabled).toBe(false)
      const summary=await fetch(`${base}/v1/referral/summary`,{headers:{authorization:`Bearer ${auth.token}`}})
      expect(summary.status).toBe(200)
      expect(await summary.json()).toMatchObject({payoutsEnabled:false,balances:{pending:'0',available:'0',frozen:'0'}})
      const badPage=await fetch(`${base}/v1/referral/invitees?page=0`,{headers:{authorization:`Bearer ${auth.token}`}})
      expect(badPage.status).toBe(400)
    expect(await db.query('SELECT 1 FROM app.referral_awards WHERE user_id=$1',[auth.userId])).toHaveLength(0)
  })
  it('rolls back source and queue together when caller transaction fails',async()=>{
    const f=await fee()
    await expect(db.transaction(async m=>{await core.captureFee(m.queryRunner!,f.entry,'prediction_place');throw new Error('simulated failure')})).rejects.toThrow('simulated failure')
    expect(await db.query('SELECT 1 FROM app.referral_events WHERE fee_entry_id=$1',[f.entry])).toHaveLength(0)
  })
  it('rejects wrong fee component and fractional atomic units',async()=>{
    const f=await fee()
    await expect(db.transaction(m=>core.captureFee(m.queryRunner!,f.entry,'prediction_payout'))).rejects.toThrow('eligible')
    const event=await capture(f.entry)
    await expect(db.query(`INSERT INTO app.referral_awards(event_id,user_id,level,settings_version,amount_atomic,occurred_at)
      VALUES($1,$2,1,(SELECT settings_version FROM app.referral_events WHERE id=$1),0.1,now())`,[event,f.user])).rejects.toMatchObject({code:'23514'})
  })
  it('enforces transitions, idempotent audit and no approval or payment',async()=>{
    const f=await fee(),event=await capture(f.entry)
    const [award]=await db.query(`INSERT INTO app.referral_awards(event_id,user_id,level,settings_version,amount_atomic,occurred_at)
      VALUES($1,$2,1,(SELECT settings_version FROM app.referral_events WHERE id=$1),100,now()) RETURNING id`,[event,f.user])
    await expect(db.query('UPDATE app.referral_awards SET state=\'available\' WHERE id=$1',[award.id])).rejects.toMatchObject({code:'23514'})
    const key=randomUUID()
    await core.transition(award.id,'pending_review',key,f.user);await core.transition(award.id,'pending_review',key,f.user)
    expect(await db.query('SELECT 1 FROM app.referral_award_actions WHERE request_key=$1',[key])).toHaveLength(1)
    await expect(core.transition(award.id,'approved',randomUUID(),f.user)).rejects.toThrow('disabled')
    await expect(db.query('UPDATE app.referral_awards SET state=\'approved\' WHERE id=$1',[award.id])).rejects.toMatchObject({code:'55000'})
    await core.transition(award.id,'rejected',randomUUID(),f.user)
    await expect(core.transition(award.id,'pending_review',randomUUID(),f.user)).rejects.toThrow('Illegal')
  })
  it('counts concurrent candidate risk once and trips review without a 50 percent budget limit',async()=>{
    const f=await fee(),event=await capture(f.entry),at=new Date(),key=randomUUID()
    const result=await Promise.all(Array.from({length:6},()=>db.transaction(m=>core.recordCandidateRisk(m.queryRunner!,f.user,event,'6000000000',key,at))))
    expect(result.filter(x=>!x.duplicate)).toHaveLength(1)
    expect(result.find(x=>!x.duplicate)).toMatchObject({reviewRequired:true})
    const [counter]=await db.query('SELECT amount_atomic::text FROM app.referral_risk_counters WHERE scope_key=$1',[`user:${f.user}`])
    expect(counter.amount_atomic).toBe('6000000000')
  })
  it('runs reconciliation on a real zero mapping and rejects projection divergence',async()=>{
    const u=await user()
    await db.transaction(async m=>{
      const [a]=await m.query(`INSERT INTO app.ledger_accounts(owner_type,user_id,purpose,asset_code,asset_decimals,normal_side)
        VALUES('user',$1,'pending','USDT',6,'credit') RETURNING id`,[u])
      await m.query(`INSERT INTO app.referral_credit_accounts(user_id,asset_code,ledger_account_id) VALUES($1,'USDT',$2)`,[u,a.id])
      await m.query(`INSERT INTO app.credit_balances(user_id,asset_code) VALUES($1,'USDT')`,[u])
    })
    expect(await core.reconcile()).toMatchObject({mappedAccounts:1,discrepancyCount:0})
    await expect(db.query('UPDATE app.credit_balances SET amount_atomic=1 WHERE user_id=$1',[u])).rejects.toMatchObject({code:'23514'})
    stats.reconciliation=await core.reconcile()
    const parent=await user(),child=await user(),outsider=await user(),read=new ReferralReadService(db)
    await db.query('INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id,code) VALUES($1,$2,$3)',[parent,child,await binding.getCode(parent)])
    expect((await read.invitees(parent,'1','20','1')).total).toBe(1)
    expect((await read.invitees(outsider)).total).toBe(0)
    expect((await read.invitees(parent)).items[0]).not.toHaveProperty('email')
    expect((await read.summary(parent)).levels).toContainEqual({level:1,count:1})
    expect((await read.summary(outsider)).balances).toEqual({pending:'0',available:'0',frozen:'0'})
    await expect(read.invitees(parent,'0')).rejects.toThrow('pagination')
    await expect(read.invitees(parent,'1','101')).rejects.toThrow('pagination')
    await expect(read.invitees(parent,'1','20','4')).rejects.toThrow('level')
  })
  it('refuses destructive rollback after business or financial source records exist',async()=>{
    const q=db.createQueryRunner();await q.connect();await q.startTransaction()
    try{await expect(new ReferralStageZero1790760000000().down(q)).rejects.toMatchObject({code:'55000'})}
    finally{await q.rollbackTransaction();await q.release()}
  })
})
