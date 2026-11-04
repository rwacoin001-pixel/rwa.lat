import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { MemberLevels1793900000002 } from '../../src/database/migrations/1793900000002-member-levels'
import { MembershipService } from '../../src/membership/membership.service'
import { RankingService } from '../../src/membership/ranking.service'
import { MembershipRunner } from '../../src/membership/membership.runner'
import { DEFAULT_MEMBER_CONFIG, periodStart } from '../../src/membership/membership-rules'

// Opt-in in-memory PostgreSQL engine: never reads DATABASE_URL or touches an existing database.
// Set MEMBERSHIP_PGLITE_PATH to an installed @electric-sql/pglite package (no production dependency),
// and run node --experimental-vm-modules node_modules/jest/bin/jest.js with the normal local config.
const pglitePath=process.env.MEMBERSHIP_PGLITE_PATH
;(pglitePath?describe:describe.skip)('membership SQL on embedded PostgreSQL',()=>{
  let embedded:any,db:DataSource,membership:MembershipService,ranks:RankingService
  const users=Array.from({length:5},()=>randomUUID()),now=new Date()
  async function statements(sql:string,args:unknown[]) {
    for(const statement of sql.split(';').filter(s=>s.trim())) {
      const count=Math.max(0,...[...statement.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])))
      await db.query(statement,args.slice(0,count))
    }
  }
  beforeAll(async()=>{
    const {PGlite}=require(pglitePath!)
    embedded=await PGlite.create()
    const query=(engine:any)=>async(sql:string,args?:unknown[])=>args?.length?(await engine.query(sql,args)).rows:(await engine.exec(sql)).at(-1)?.rows??[]
    db={query:query(embedded),transaction:async(...args:any[])=>embedded.transaction(async(tx:any)=>args.at(-1)({query:query(tx)}))} as DataSource
    await db.query(`CREATE SCHEMA app;
      CREATE TABLE app.users(id uuid PRIMARY KEY);
      CREATE TABLE app.community_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid UNIQUE REFERENCES app.users,
        handle text NOT NULL,display_name text NOT NULL,avatar_url text,kind text DEFAULT 'member',is_active boolean DEFAULT true,identity_configured boolean DEFAULT false);
      CREATE TABLE app.referral_edges(inviter_user_id uuid,invitee_user_id uuid PRIMARY KEY,bound_at timestamptz DEFAULT now());
      CREATE TABLE app.deposits(id uuid DEFAULT gen_random_uuid(),user_id uuid,state text,asset_code text,asset_decimals int,atomic_amount numeric,credited_at timestamptz);
      CREATE TABLE app.internal_transfers(id uuid DEFAULT gen_random_uuid(),recipient_user_id uuid,state text,asset_code text,asset_decimals int,atomic_amount numeric,posted_at timestamptz);
      CREATE TABLE app.quant_orders(id uuid DEFAULT gen_random_uuid(),user_id uuid,kind text,status text,amount_atomic numeric,created_at timestamptz,settled_at timestamptz);
      CREATE TABLE app.orders(id uuid DEFAULT gen_random_uuid(),user_id uuid,side text,state text,filled_atomic_amount numeric,settlement_asset_code text,
        settlement_asset_decimals int,completed_at timestamptz,processed_at timestamptz,submitted_at timestamptz);
      CREATE TABLE app.prediction_bets(id uuid DEFAULT gen_random_uuid(),user_id uuid,status text,stake_atomic numeric,created_at timestamptz);
      CREATE TABLE app.basket_subscriptions(id uuid DEFAULT gen_random_uuid(),user_id uuid,status text,amount_usd numeric,created_at timestamptz,settled_at timestamptz);
      CREATE TABLE app.user_points_ledger(user_id uuid,delta int,reason text CHECK(reason IN ('draw','exchange','admin')),created_at timestamptz DEFAULT now());`)
    await new MemberLevels1793900000002().up({query:db.query} as never)
    membership=new MembershipService(db);ranks=new RankingService(db)
    await db.query('INSERT INTO app.users SELECT unnest($1::uuid[])',[users])
    for(let i=0;i<4;i++)await db.query('INSERT INTO app.referral_edges VALUES($1,$2,$3)',[users[i],users[i+1],now])
    await db.query(`INSERT INTO app.quant_orders(user_id,kind,status,amount_atomic,created_at)
      SELECT id,'subscription','accepted',1000000000,$2 FROM app.users WHERE id=ANY($1::uuid[])`,[users,now])
    await db.query(`INSERT INTO app.community_profiles(user_id,handle,display_name,identity_configured) VALUES($1,'root','Root',true),($2,'direct','Direct',true),($3,'l4','Fourth',true)`,[users[0],users[1],users[4]])
  },120000)
  afterAll(async()=>{
    await embedded?.close()
  },60000)
  it('caps descendants AND affected ancestors at three; batches persist and retry without duplicate history',async()=>{
    expect(await membership.settings()).toEqual(DEFAULT_MEMBER_CONFIG)
    await membership.recompute([users[0]])
    const view=await membership.me(users[0])
    expect(view.components.team).toEqual({l1:'1000.00',l2:'1000.00',l3:'1000.00'})
    expect(view.components.members).toEqual({direct:1,team:3,directActive:1,teamActive:3})
    expect(view.score).toBe('1800.00') // 1000 own + 500 team purchases + 300 active members.
    const [original]=await db.query('SELECT computed_at FROM app.member_levels WHERE user_id=$1',[users[0]])
    await membership.recomputeAffected(users[4])
    const [unchanged]=await db.query('SELECT computed_at FROM app.member_levels WHERE user_id=$1',[users[0]])
    expect(unchanged.computed_at).toEqual(original.computed_at)
    expect((await db.query('SELECT * FROM app.member_levels'))).toHaveLength(5)
    await membership.recompute(users)
    expect(await db.query('SELECT * FROM app.member_level_history')).toEqual([]) // no first-deposit prerequisite satisfied.
  })
  it('normalizes credited deposits/transfers, excludes old/rejected purchases and pending baskets, and counts tasks only',async()=>{
    await statements(`INSERT INTO app.deposits(user_id,state,asset_code,asset_decimals,atomic_amount,credited_at) VALUES
      ($1,'credited','USDT',8,200000000000,$2),($1,'credited','USDT',6,999000000,$2::timestamptz-interval '366 days'),
      ($1,'rejected','USDT',6,999000000,$2);
      INSERT INTO app.internal_transfers(recipient_user_id,state,asset_code,asset_decimals,atomic_amount,posted_at) VALUES($1,'posted','USDT',6,100000000,$2);
      INSERT INTO app.basket_subscriptions(user_id,status,amount_usd,created_at,settled_at) VALUES($1,'settled',20,$2,$2),($1,'pending',999,$2,NULL);
      INSERT INTO app.orders(user_id,side,state,filled_atomic_amount,settlement_asset_code,settlement_asset_decimals,submitted_at)
        VALUES($1,'buy','partially_filled',30000000,'USDT',6,$2);
      INSERT INTO app.prediction_bets(user_id,status,stake_atomic,created_at) VALUES($1,'won',40000000,$2),($1,'cancelled',999000000,$2);
      INSERT INTO app.quant_orders(user_id,kind,status,amount_atomic,created_at) VALUES($1,'subscription','accepted',999000000,$2::timestamptz-interval '366 days');
      INSERT INTO app.user_points_ledger(user_id,delta,reason) VALUES($1,1000,'draw');`,[users[0],now])
    await membership.recompute(users)
    const view=await membership.me(users[0])
    expect(view.components.deposits).toBe('2100.00')
    expect(view.components.purchases).toBe('1090.00')
    expect(view.components.tasks).toBe('0.00')
    expect(view.level).toEqual({index:2,key:'planet'})
    await membership.recompute(users)
    expect((await db.query('SELECT * FROM app.member_level_history WHERE user_id=$1',[users[0]]))).toHaveLength(1)
    await statements("ALTER TABLE app.user_points_ledger DROP CONSTRAINT user_points_ledger_reason_check; INSERT INTO app.user_points_ledger(user_id,delta,reason) VALUES($1,5,'task'),($1,6,'activity')",[users[0]])
    await membership.recompute([users[0]])
    expect((await membership.me(users[0])).components.tasks).toBe('11.00')
  })
  it('generates all eight boards idempotently and hides immediately without leaking ids or exact amounts',async()=>{
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    const [counts]=await db.query('SELECT count(DISTINCT(board,period))::int AS boards,count(*)::int AS rows FROM app.rank_snapshots')
    expect(counts).toEqual({boards:8,rows:24})
    expect((await ranks.read('invite','month',users[0],now)).items.find((r:any)=>r.handle==='root')?.band).toBe('1')
    await membership.visibility(users[0],true)
    const hidden=await ranks.read('invest','week',users[0],now)
    expect(hidden.items.map((r:any)=>r.handle)).not.toContain('root')
    expect(hidden.me).toEqual({rank:null,band:'1k-5k',hidden:true})
    expect(JSON.stringify(hidden)).not.toContain(users[0])
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    expect((await db.query('SELECT * FROM app.rank_snapshots WHERE user_id=$1',[users[0]]))).toHaveLength(0)
    await membership.visibility(users[0],false)
    expect((await ranks.read('score','week',users[0],now)).me?.rank).toBeNull()
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    expect((await ranks.read('score','week',users[0],now)).me?.rank).toBe(1)
    expect((await ranks.read('score','week',undefined,now)).periodStart).toBe(periodStart('week',now))
  })
  it('reconciles a voided prediction purchase through the incremental queue',async()=>{
    const [bet]=await db.query("UPDATE app.prediction_bets SET status='void' WHERE user_id=$1 AND status='won' RETURNING id",[users[0]])
    const jobs={enqueue:jest.fn(),claim:jest.fn().mockResolvedValue([{id:'job',payload:{type:'change',source:'prediction',sourceId:bet.id}}]),ack:jest.fn(),nack:jest.fn()}
    await new MembershipRunner(db,jobs as never,membership,ranks).tick()
    expect(jobs.ack).toHaveBeenCalled();expect(jobs.nack).not.toHaveBeenCalled()
    expect((await membership.me(users[0])).components.purchases).toBe('1050.00')
  })
  it('persists grace once, expires it, and records only actual level changes',async()=>{
    await db.query("UPDATE app.member_levels SET level=5,grace_until=NULL WHERE user_id=$1",[users[0]])
    await membership.recompute([users[0]])
    const first=await membership.me(users[0]);expect(first.level.index).toBe(5);expect(first.graceUntil).not.toBeNull()
    await membership.recompute([users[0]])
    expect((await membership.me(users[0])).graceUntil).toBe(first.graceUntil)
    await db.query("UPDATE app.member_levels SET grace_until='2000-01-01' WHERE user_id=$1",[users[0]])
    await membership.recompute([users[0]])
    expect((await membership.me(users[0])).level.index).toBe(2)
    expect((await membership.me(users[0])).graceUntil).toBeNull()
    expect((await db.query('SELECT * FROM app.member_level_history WHERE user_id=$1 AND from_level=5 AND to_level=2',[users[0]]))).toHaveLength(1)
  })
  it('keeps bootstrap handles private even when an older snapshot contains them',async()=>{
    await membership.visibility(users[2],true)
    await membership.visibility(users[2],false)
    const [profile]=await db.query('SELECT * FROM app.community_profiles WHERE user_id=$1',[users[2]])
    expect(profile.identity_configured).toBe(false)
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    expect(await db.query('SELECT * FROM app.rank_snapshots WHERE user_id=$1',[users[2]])).toEqual([])
    await db.query(`INSERT INTO app.rank_snapshots(board,period,period_start,user_id,rank,value,generated_at) VALUES('score','week',$1,$2,1,123,$3)`,[periodStart('week',now),users[2],now])
    const result=await ranks.read('score','week',users[2],now)
    expect(result.items.map((r:any)=>r.handle)).not.toContain(profile.handle)
    expect(result.me?.rank).toBeNull()
    expect(JSON.stringify(result)).not.toContain(users[2].replace(/-/g,'').slice(0,31))
  })
  it('caps every board at 100 and gives an eligible member outside the top 100 a null rank and their own band',async()=>{
    const outside='ffffffff-ffff-ffff-ffff-ffffffffffff'
    await db.query("INSERT INTO app.users SELECT gen_random_uuid() FROM generate_series(1,101)")
    await db.query('INSERT INTO app.users VALUES($1)',[outside])
    await db.query(`INSERT INTO app.community_profiles(user_id,handle,display_name,identity_configured)
      SELECT id,'test_'||replace(id::text,'-',''),'Member',true FROM app.users u
      WHERE NOT EXISTS(SELECT 1 FROM app.community_profiles p WHERE p.user_id=u.id)`)
    await ranks.generate(DEFAULT_MEMBER_CONFIG,now)
    const counts=await db.query('SELECT board,period,count(*)::int AS n FROM app.rank_snapshots GROUP BY board,period')
    expect(counts).toHaveLength(8);expect(counts.every((r:any)=>r.n===100)).toBe(true)
    const result=await ranks.read('invest','month',outside,now)
    expect(result.items).toHaveLength(100)
    expect(result.me).toEqual({rank:null,band:'0-1k',hidden:false})
  })
  it('does not treat a received transfer or a 91-day-old purchase as an active member',async()=>{
    const [root,transfer,old]=Array.from({length:3},()=>randomUUID())
    await db.query('INSERT INTO app.users SELECT unnest($1::uuid[])',[[root,transfer,old]])
    await db.query('INSERT INTO app.referral_edges(inviter_user_id,invitee_user_id) VALUES($1,$2),($1,$3)',[root,transfer,old])
    await db.query("INSERT INTO app.internal_transfers(recipient_user_id,state,asset_code,asset_decimals,atomic_amount,posted_at) VALUES($1,'posted','USDT',6,1000000000,now())",[transfer])
    await db.query("INSERT INTO app.quant_orders(user_id,kind,status,amount_atomic,created_at) VALUES($1,'subscription','accepted',1000000000,now()-interval '91 days')",[old])
    await membership.recompute([root,transfer,old])
    const result=await membership.me(root)
    expect(result.components.members).toEqual({direct:2,team:2,directActive:0,teamActive:0})
    expect(result.components.team.l1).toBe('1000.00')
    expect((await membership.me(transfer)).level.index).toBe(1)
  })
})
