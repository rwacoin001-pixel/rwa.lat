import { createHash, randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { PublicShareService } from '../../src/sharing/public-share.service'
import { PublicResourceShares1790000000020 } from '../../src/database/migrations/1790000000020-public-resource-shares'
import { buildDatabaseOptions } from '../../src/database/database-options'

const suite=process.env.TEST_DATABASE_URL?describe:describe.skip
suite('Public sharing in rolled-back PostgreSQL transactions',()=>{
  let db:DataSource,runner:QueryRunner,sharing:PublicShareService,user:string,other:string,product:string,post:string,profile:string
  beforeAll(async()=>{
    const url=new URL(process.env.TEST_DATABASE_URL!)
    const expected=decodeURIComponent(url.pathname.slice(1))
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!expected.endsWith('_test'))throw new Error('Verified local test database required')
    db=new DataSource({...buildDatabaseOptions({...process.env,NODE_ENV:'test'}),entities:[],synchronize:false});await db.initialize()
    if((await db.query('SELECT current_database() AS name'))[0].name!==expected)throw new Error('Unexpected test database')
  })
  beforeEach(async()=>{
    runner=db.createQueryRunner();await runner.connect();await runner.startTransaction()
    if(!(await runner.query("SELECT to_regclass('app.public_resource_shares') AS name"))[0].name)await new PublicResourceShares1790000000020().up(runner)
    user=randomUUID();other=randomUUID();product=randomUUID();post=randomUUID();profile=randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1),($2)',[user,other])
    const klass=`sh_${randomUUID().replace(/-/g,'').slice(0,20)}`
    await runner.query("INSERT INTO app.asset_classes(id,display_name,state) VALUES($1,'Share fixture','active')",[klass])
    await runner.query("INSERT INTO app.products(id,asset_class_id,display_name,summary,asset_code,asset_decimals,state,published_at) VALUES($1,$2,'Published fixture','Public description','TEST',6,'published',now())",[product,klass])
    await runner.query("INSERT INTO app.community_profiles(id,handle,display_name,kind,user_id,is_active) VALUES($1,$2,'Public author','member',$3,true)",[profile,`share_${randomUUID().replace(/-/g,'').slice(0,20)}`,user])
    await runner.query("INSERT INTO app.community_posts(id,profile_id,body,topics,source,state,published_at) VALUES($1,$2,'Public post text','[]'::jsonb,'user','published',now())",[post,profile])
    sharing=new PublicShareService({query:(sql:string,args:unknown[])=>runner.query(sql,args),transaction:async(work:(tx:unknown)=>unknown)=>work(runner.manager)} as unknown as DataSource)
  })
  afterEach(async()=>{if(runner?.isTransactionActive)await runner.rollbackTransaction();await runner?.release()})
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  it('stores only a token hash and resolves public product fields without account data',async()=>{
    const share=await sharing.create(user,{kind:'product',resourceId:product})
    const [stored]=await runner.query('SELECT token_hash FROM app.public_resource_shares WHERE id=$1',[share.id])
    expect(stored.token_hash).toBe(createHash('sha256').update(share.token).digest('hex'))
    expect(stored.token_hash).not.toBe(share.token)
    expect(await sharing.resolve(share.token)).toEqual({kind:'product',title:'Published fixture',summary:'Public description',path:`/asset/${product}`})
    await runner.query("UPDATE app.products SET state='suspended',published_at=NULL WHERE id=$1",[product])
    await expect(sharing.resolve(share.token)).rejects.toThrow('停止公开')
  })
  it('rejects draft products without creating a share record',async()=>{
    await runner.query("UPDATE app.products SET state='draft',published_at=NULL WHERE id=$1",[product])
    await expect(sharing.create(user,{kind:'product',resourceId:product})).rejects.toThrow('停止公开')
    expect(await runner.query('SELECT id FROM app.public_resource_shares WHERE creator_id=$1',[user])).toEqual([])
  })
  it('rechecks moderation and author availability on every public post resolution',async()=>{
    const share=await sharing.create(user,{kind:'community_post',resourceId:post})
    expect((await sharing.resolve(share.token)).summary).toBe('Public post text')
    await runner.query("UPDATE app.community_posts SET state='hidden' WHERE id=$1",[post])
    await expect(sharing.resolve(share.token)).rejects.toThrow('停止公开')
    await runner.query("UPDATE app.community_posts SET state='published' WHERE id=$1",[post])
    await runner.query('UPDATE app.community_profiles SET is_active=false WHERE id=$1',[profile])
    await expect(sharing.resolve(share.token)).rejects.toThrow('停止公开')
  })
  it('allows only the creator to revoke, and a repeated revocation stays effective',async()=>{
    const share=await sharing.create(user,{kind:'product',resourceId:product})
    await expect(sharing.revoke(other,share.id)).rejects.toThrow('不存在')
    expect(await sharing.listOwn(other,{kind:'product',resourceId:product})).toEqual([])
    expect((await sharing.listOwn(user,{kind:'product',resourceId:product}))[0].id).toBe(share.id)
    expect((await sharing.resolve(share.token)).kind).toBe('product')
    await sharing.revoke(user,share.id);await sharing.revoke(user,share.id)
    await expect(sharing.resolve(share.token)).rejects.toThrow('撤销')
    await expect(sharing.resolve('malformed-token')).rejects.toThrow('无效')
  })
  it('does not let a closed account create a new share',async()=>{
    await runner.query("UPDATE app.users SET status='closed',closed_at=now() WHERE id=$1",[user])
    await expect(sharing.create(user,{kind:'product',resourceId:product})).rejects.toThrow('当前账户')
  })
})
