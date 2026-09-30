import {randomBytes,randomUUID} from 'node:crypto'
import {DataSource,QueryRunner} from 'typeorm'
import {buildDatabaseOptions} from '../../src/database/database-options'
import {AccountClosureService} from '../../src/notification/account-closure.service'
import {WalletLedgerBridge} from '../../src/wallet/wallet-ledger.bridge'
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip
suite('Account closure with isolated PostgreSQL',()=>{
  let db:DataSource,runner:QueryRunner,svc:AccountClosureService,userId:string
  beforeAll(async()=>{
    const url=new URL(process.env.TEST_DATABASE_URL!)
    if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw new Error('Local isolated test database required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'}));await db.initialize();await db.runMigrations()
    if(!(await db.query('SELECT current_database() AS name'))[0].name.endsWith('_test'))throw new Error('Connected database is not isolated')
  })
  beforeEach(async()=>{
    runner=db.createQueryRunner();await runner.connect();await runner.startTransaction();userId=randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1)',[userId])
    svc=new AccountClosureService({query:(sql:string,args:unknown[])=>runner.query(sql,args),transaction:(work:any)=>work(runner.manager)} as unknown as DataSource)
  })
  afterEach(async()=>{await runner.rollbackTransaction();await runner.release()})
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  it('keeps one open request per user and refuses another user canceling it',async()=>{
    const first=await svc.request(userId,'Close my account'),again=await svc.request(userId,'Retry')
    expect(again.requests).toHaveLength(1);expect(again.requests[0].id).toBe(first.requests[0].id)
    expect((await svc.status(randomUUID())).requests).toEqual([])
    await expect(svc.cancel(randomUUID(),first.requests[0].id)).rejects.toThrow('cannot be canceled')
    expect((await svc.cancel(userId,first.requests[0].id)).requests[0].state).toBe('canceled')
  })
  it('allows only a reviewed empty account to close and revokes active sessions',async()=>{
    const session=randomUUID();await runner.query("INSERT INTO app.sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",[session,userId,randomBytes(32)])
    const req=await svc.request(userId,'Close account');const id=req.requests[0].id
    expect((await svc.inspect(id)).blockers).toEqual([])
    const admin=randomUUID();expect(await svc.review(id,'close','All checks complete',admin)).toMatchObject({state:'closed'})
    expect((await runner.query('SELECT status,closed_at FROM app.users WHERE id=$1',[userId]))[0]).toMatchObject({status:'closed',closed_at:expect.any(Date)})
    expect((await runner.query('SELECT state,revoke_reason FROM app.sessions WHERE id=$1',[session]))[0]).toMatchObject({state:'revoked',revoke_reason:'account_closed'})
    expect((await runner.query("SELECT actor_id FROM app.audit_logs WHERE action='account_closure.review' AND object_id=$1",[id]))[0].actor_id).toBe(admin)
  })
  it('blocks closure while a renewable subscription is active',async()=>{
    await runner.query("INSERT INTO app.subscriptions(user_id,plan,current_period_start,current_period_end) VALUES($1,'test',now(),now()+interval '1 day')",[userId])
    const req=await svc.request(userId,'Close account')
    expect((await svc.inspect(req.requests[0].id)).blockers).toContainEqual({code:'subscriptions',count:1})
    await expect(svc.review(req.requests[0].id,'close','Attempt',randomUUID())).rejects.toThrow('Resolve balances')
    expect((await runner.query('SELECT status FROM app.users WHERE id=$1',[userId]))[0].status).toBe('active')
  })
  it('rejects new financial writes and active sessions after closure at the database boundary',async()=>{
    const req=await svc.request(userId,'Close account');await svc.review(req.requests[0].id,'close','Verified',randomUUID())
    await runner.query('SAVEPOINT closed_session')
    await expect(runner.query("INSERT INTO app.sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 day')",[randomUUID(),userId,randomBytes(32)])).rejects.toMatchObject({driverError:{constraint:'closed_account_financial_write'}})
    await runner.query('ROLLBACK TO SAVEPOINT closed_session')
    await runner.query('SAVEPOINT closed_order')
    await expect(runner.query("INSERT INTO app.trading_orders(id,user_id,pair_id,side,quantity) VALUES($1,$2,$3,'buy',1)",[randomUUID(),userId,randomUUID()])).rejects.toMatchObject({driverError:{constraint:'closed_account_financial_write'}})
    await runner.query('ROLLBACK TO SAVEPOINT closed_order')
  })
  it('holds deposits for closed accounts without creating ledger entries',async()=>{
    // Verify the bridge path independently of custody integrations and chain fixtures.
    const query=jest.fn(async(sql:string)=>sql.includes('SELECT status')?[{status:'closed'}]:sql.includes('SELECT state')?[{state:'confirming'}]:[])
    const tx={connect:jest.fn(),startTransaction:jest.fn(),commitTransaction:jest.fn(),rollbackTransaction:jest.fn(),release:jest.fn(),query}
    const bridge=new WalletLedgerBridge({createQueryRunner:()=>tx} as unknown as DataSource)
    expect(await bridge.creditDeposit(randomUUID(),userId,'TRON' as any,'1000000',randomUUID())).toMatchObject({credited:false,manualReview:true,reasonCode:'account_closed_manual_refund'})
    expect(query.mock.calls.some(([sql])=>sql.includes('INSERT INTO app.ledger_entries'))).toBe(false)
    expect(tx.commitTransaction).toHaveBeenCalled()
  })
})
