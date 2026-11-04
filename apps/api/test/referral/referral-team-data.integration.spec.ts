import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { ReferralReadService } from '../../src/referral/referral-read.service'
import type { ObjectStorageService } from '../../src/object-storage/object-storage.service'

const database = process.env.TEST_DATABASE_URL ? describe : describe.skip

database('richer referral team data (throwaway PostgreSQL)', () => {
  let admin: DataSource, db: DataSource, read: ReferralReadService, name: string
  const users = Object.fromEntries('ABCDEF GHIJX'.replace(/ /g,'').split('').map((key,i) => [key, `${(i+1).toString(16).padStart(8,'0')}-0000-4000-8000-000000000000`]))
  const media = randomUUID(), avatar = `/v1/community/media/${media}`
  const storage = { readableCommunityImageIds: jest.fn(async () => new Set([media])) }
  let monthStart: Date, now: Date

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!)
    if (!['[::1]','::1'].includes(url.hostname) || url.port !== '54330' || !/^\/rwa_test_/.test(url.pathname)) {
      throw new Error('Team data specs require a throwaway rwa_test_* PostgreSQL database on [::1]:54330')
    }
    admin = new DataSource({ type:'postgres', url:url.toString() }); await admin.initialize()
    name = `rwa_test_team_${randomUUID().replace(/-/g,'')}`
    await admin.query(`CREATE DATABASE "${name}"`)
    url.pathname = `/${name}`
    db = new DataSource({ type:'postgres', url:url.toString() }); await db.initialize()
    // Minimal isolated fixtures for the real columns read by MONEY_CTES, community and referrals.
    await db.query(`CREATE SCHEMA app;
      CREATE TABLE app.referral_rewards(id uuid PRIMARY KEY);
      CREATE TABLE app.referral_edges(inviter_user_id uuid,invitee_user_id uuid PRIMARY KEY,bound_at timestamptz NOT NULL);
      CREATE TABLE app.community_profiles(user_id uuid UNIQUE,kind text,identity_configured boolean,is_active boolean,
        show_to_inviter boolean,display_name text,avatar_url text);
      CREATE TABLE app.member_levels(user_id uuid PRIMARY KEY,level smallint NOT NULL);
      CREATE TABLE app.deposits(user_id uuid,state text,asset_code text,asset_decimals int,atomic_amount numeric,credited_at timestamptz);
      CREATE TABLE app.internal_transfers(recipient_user_id uuid,state text,asset_code text,asset_decimals int,atomic_amount numeric,posted_at timestamptz);
      CREATE TABLE app.quant_orders(user_id uuid,kind text,status text,amount_atomic numeric,created_at timestamptz,settled_at timestamptz);
      CREATE TABLE app.orders(user_id uuid,side text,state text,filled_atomic_amount numeric,settlement_asset_code text,
        settlement_asset_decimals int,completed_at timestamptz,processed_at timestamptz,submitted_at timestamptz);
      CREATE TABLE app.prediction_bets(user_id uuid,status text,stake_atomic numeric,created_at timestamptz);
      CREATE TABLE app.basket_subscriptions(user_id uuid,status text,amount_usd numeric,created_at timestamptz,settled_at timestamptz);`)
    const [clock] = await db.query(`SELECT now() AS now,date_trunc('month',now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS start`)
    now = clock.now; monthStart = clock.start
    // A -> B -> C -> D -> E (L4), B -> J; F/G/H/I are additional direct members. X is unrelated.
    for (const [i,[up,down]] of [['A','B'],['B','C'],['C','D'],['D','E'],['A','F'],['A','G'],['A','H'],['A','I'],['B','J']].entries()) {
      const at = down==='B' ? monthStart : down==='F' ? new Date(+monthStart-1) : new Date(+now-(10-i)*1000)
      await db.query('INSERT INTO app.referral_edges VALUES($1,$2,$3)',[users[up],users[down],at])
    }
    await db.query(`INSERT INTO app.member_levels VALUES($1,2),($2,5),($3,5)`,[users.B,users.D,users.F])
    for (const [key,visible,configured,active,kind] of [
      ['B',true,true,true,'member'],['C',false,true,true,'member'],['F',true,true,true,'member'],
      ['G',true,true,false,'member'],['H',true,false,true,'member'],['I',true,true,true,'persona'],
    ] as const) {
      await db.query('INSERT INTO app.community_profiles VALUES($1,$2,$3,$4,$5,$6,$7)',
        [users[key],kind,configured,active,visible,`Nick ${key}`,key==='F'?'https://example.test/avatar.png':avatar])
    }
    const daysAgo = (days:number) => new Date(+now-days*86400000)
    await db.query(`INSERT INTO app.deposits VALUES
      ($1,'credited','USDT',6,1000000,$3),($2,'credited','USDT',6,1000000,$4),
      ($5,'pending','USDT',6,1000000,$3),($5,'credited','BTC',8,1000000,$4)`,[users.B,users.C,daysAgo(29),daysAgo(31),users.G])
    await db.query(`INSERT INTO app.internal_transfers VALUES($1,'posted','USDT',6,1000000,$2)`,[users.G,now])
    await db.query(`INSERT INTO app.quant_orders VALUES
      ($1,'subscription','accepted',1000001,$3,NULL),($2,'subscription','accepted',2000002,$4,NULL),
      ($5,'subscription','rejected',900000000,$3,NULL),($6,'subscription','accepted',900000000,$3,NULL),
      ($7,'subscription','accepted',900000000,$3,NULL),($8,'subscription','accepted',900000000,$9,NULL)`,
      [users.B,users.C,new Date(+monthStart-1),monthStart,users.G,users.E,users.X,users.H,new Date(+now+86400000)])
    await db.query(`INSERT INTO app.orders VALUES($1,'buy','partially_filled',3000003,'USDT',6,$2,NULL,$2),
      ($3,'sell','filled',900000000,'USDT',6,$2,NULL,$2),($3,'buy','filled',900000000,'BTC',8,$2,NULL,$2)`,[users.D,monthStart,users.G])
    await db.query(`INSERT INTO app.prediction_bets VALUES($1,'placed',4000004,$2),($3,'void',900000000,$2)`,[users.F,monthStart,users.G])
    await db.query(`INSERT INTO app.basket_subscriptions VALUES($1,'settled',5.000005,$2,NULL),($3,'pending',900,$2,NULL)`,[users.J,monthStart,users.G])
    read = new ReferralReadService(db,storage as unknown as ObjectStorageService)
  },120000)
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
    if (admin?.isInitialized) {
      if (name) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`)
      await admin.destroy()
    }
  })
  const label = (key:string) => users[key].slice(0,8)
  const rows = async () => (await read.invitees(users.A)).items

  it('shows only eligible, opted-in community identity with the unchanged API-relative avatar URL',async () => {
    const items = await rows(), byLabel = new Map(items.map(row=>[row.memberLabel,row]))
    expect(byLabel.get(label('B'))).toMatchObject({displayName:'Nick B',avatarUrl:avatar})
    expect(byLabel.get(label('F'))).toMatchObject({displayName:'Nick F',avatarUrl:'https://example.test/avatar.png'})
    for (const key of ['C','D','G','H','I','J']) expect(byLabel.get(label(key))).toMatchObject({displayName:null,avatarUrl:null})
    expect(Object.keys(items[0]).sort()).toEqual(['memberLabel','level','boundAt','displayName','avatarUrl','memberLevel','active30d','teamSize'].sort())
    expect(JSON.stringify(items)).not.toMatch(/userId|email|legal|Atomic|amount/)
  })
  it('gates scan-pending avatars, rereads visibility without a cache, and masks generated placeholder names',async () => {
    storage.readableCommunityImageIds.mockResolvedValueOnce(new Set())
    expect((await rows()).find(r=>r.memberLabel===label('B'))).toMatchObject({displayName:'Nick B',avatarUrl:null})
    await db.query('UPDATE app.community_profiles SET show_to_inviter=false WHERE user_id=$1',[users.B])
    expect((await rows()).find(r=>r.memberLabel===label('B'))).toMatchObject({displayName:null,avatarUrl:null})
    await db.query(`UPDATE app.community_profiles SET show_to_inviter=true,display_name='Member abcdef' WHERE user_id=$1`,[users.B])
    expect((await rows()).find(r=>r.memberLabel===label('B'))?.displayName).toBeNull()
    await db.query(`UPDATE app.community_profiles SET display_name='Nick B' WHERE user_id=$1`,[users.B])
  })
  it('defaults membership to 1 and counts descendants only within the viewer window, including when level-filtered',async () => {
    const items=await rows()
    for (const key of ['C','G','H','I','J']) expect(items.find(r=>r.memberLabel===label(key))?.memberLevel).toBe(1)
    for (const [key,size] of [['B',3],['C',1],['D',0],['F',0],['J',0]] as const) expect(items.find(r=>r.memberLabel===label(key))?.teamSize).toBe(size)
    const filtered=await read.invitees(users.A,'1','100','1')
    expect(filtered.total).toBe(5)
    expect(filtered.items.find(r=>r.memberLabel===label('B'))?.teamSize).toBe(3)
    expect(items.map(r=>r.memberLabel)).not.toContain(label('E'))
  })
  it('distinguishes 29 and 31 day activity; excludes transfers, pending records, void bets and future purchases',async () => {
    const items=await rows()
    expect(items.find(r=>r.memberLabel===label('B'))?.active30d).toBe(true)
    // C has a current-month purchase, so isolate the 31-day deposit from that source.
    await db.query(`UPDATE app.quant_orders SET status='rejected' WHERE user_id=$1`,[users.C])
    try { expect((await rows()).find(r=>r.memberLabel===label('C'))?.active30d).toBe(false) }
    finally { await db.query(`UPDATE app.quant_orders SET status='accepted' WHERE user_id=$1`,[users.C]) }
    for(const key of ['D','F','J']) expect(items.find(r=>r.memberLabel===label(key))?.active30d).toBe(true)
    for(const key of ['G','H','I']) expect(items.find(r=>r.memberLabel===label(key))?.active30d).toBe(false)
  })
  it.each(['recent','active','level'] as const)('sorts %s before paging with deterministic ties',async sort => {
    const all=await rows()
    const expected=[...all].sort((a,b)=>
      (sort==='active'?Number(b.active30d)-Number(a.active30d):sort==='level'?b.memberLevel-a.memberLevel:0)
      || +new Date(b.boundAt)-+new Date(a.boundAt) || a.memberLabel.localeCompare(b.memberLabel))
    for(const page of [1,2,3,4]) {
      const result=await read.invitees(users.A,String(page),'2','all',sort)
      expect(result).toMatchObject({total:8,page,pageSize:2})
      expect(result.items.map(r=>r.memberLabel)).toEqual(expected.slice((page-1)*2,page*2).map(r=>r.memberLabel))
    }
  })
  it('aggregates all four purchase sources at the Shanghai month boundary, excludes L4, and returns strings without precision loss',async () => {
    // month_start is 16:00 UTC on the previous calendar day; B is one millisecond before it.
    expect(monthStart.getUTCHours()).toBe(16)
    const result=await read.teamOverview(users.A)
    expect(result).toMatchObject({members:8,byLevel:[{level:1,count:5},{level:2,count:2},{level:3,count:1}],
      active30d:5,joinedThisMonth:7,teamPurchaseMonthAtomic:'14000014',teamPurchaseTotalAtomic:'15000015',currency:'USDT',decimals:6})
    expect(Number.isNaN(Date.parse(result.asOf))).toBe(false)
    const unrelated=await read.teamOverview(users.X)
    expect(unrelated).toMatchObject({members:0,byLevel:[{level:1,count:0},{level:2,count:0},{level:3,count:0}],
      active30d:0,joinedThisMonth:0,teamPurchaseMonthAtomic:'0',teamPurchaseTotalAtomic:'0'})
    await db.query(`INSERT INTO app.quant_orders VALUES($1,'subscription','accepted',9007199254740993000001,$2,NULL)`,[users.B,now])
    const fresh=await new ReferralReadService(db).teamOverview(users.A)
    expect(fresh.teamPurchaseTotalAtomic).toBe('9007199254741008000016')
    expect(fresh.teamPurchaseMonthAtomic).toBe('9007199254741007000015')
  })
})
