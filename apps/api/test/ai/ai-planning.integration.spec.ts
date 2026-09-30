import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { AiPlanningService, parseAiSuggestion } from '../../src/ai/ai-planning.service'
import { CatalogService, ProductView } from '../../src/catalog/catalog.service'
import { AiModelClient } from '../../src/ai/ai-model.client'

const product: ProductView = { id:randomUUID(),displayName:'Published test asset',assetClassId:'rwa',assetCode:'USDT',assetDecimals:6,version:1,state:'published',imageUrl:null }
const suggestion = {cashBps:1000,explanation:'This is a suggestion, not guaranteed income.',allocations:[{productId:product.id,weightBps:9000,reason:'Published product facts.'}]}
describe('Untrusted AI allocation validation',()=>{
  it('accepts exact catalog IDs and requires cash plus allocations to total 100%',()=>{
    expect(parseAiSuggestion(JSON.stringify(suggestion),[product])).toEqual(suggestion)
    expect(()=>parseAiSuggestion(JSON.stringify({...suggestion,cashBps:999}),[product])).toThrow('total')
  })
  it('rejects hallucinated IDs, duplicate products, fractional weights and prose',()=>{
    expect(()=>parseAiSuggestion(JSON.stringify({...suggestion,allocations:[{...suggestion.allocations[0],productId:randomUUID()}]}),[product])).toThrow('product')
    expect(()=>parseAiSuggestion(JSON.stringify({...suggestion,allocations:[...suggestion.allocations,...suggestion.allocations]}),[product])).toThrow('product')
    expect(()=>parseAiSuggestion(JSON.stringify({...suggestion,allocations:[{...suggestion.allocations[0],weightBps:9000.5}]}),[product])).toThrow('product')
    expect(()=>parseAiSuggestion('Please execute an order',[product])).toThrow('JSON')
  })
})
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip
suite('Persisted AI planning with isolated PostgreSQL',()=>{
  let db:DataSource, runner:QueryRunner, svc:AiPlanningService, userId:string
  const complete=jest.fn()
  const goals={expectedRevision:0,title:'Long term',budgetUsdt:'100',horizonMonths:12,riskTolerance:'low' as const,notes:'',locale:'en'}
  beforeAll(async()=>{
    const url=new URL(process.env.TEST_DATABASE_URL!)
    if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test')) throw new Error('Local isolated test database required')
    db=new DataSource(buildDatabaseOptions({...process.env,NODE_ENV:'test'})); await db.initialize(); await db.runMigrations()
    if (!(await db.query('SELECT current_database() AS name'))[0].name.endsWith('_test')) throw new Error('Connected database is not isolated')
  })
  beforeEach(async()=>{
    runner=db.createQueryRunner(); await runner.connect(); await runner.startTransaction(); userId=randomUUID()
    await runner.query('INSERT INTO app.users(id) VALUES($1)',[userId])
    complete.mockReset(); complete.mockResolvedValue({text:JSON.stringify(suggestion),model:'test-model'})
    svc=new AiPlanningService({query:(sql:string,args:unknown[])=>runner.query(sql,args),transaction:(work:any)=>work(runner.manager)} as unknown as DataSource,
      {listProducts:async()=>[product]} as unknown as CatalogService,{configured:true,complete} as unknown as AiModelClient)
  })
  afterEach(async()=>{await runner.rollbackTransaction();await runner.release()})
  afterAll(async()=>{if(db?.isInitialized)await db.destroy()})
  it('keeps goals private and detects stale edits while allowing a lost response replay',async()=>{
    expect(await svc.save(userId,goals)).toMatchObject({revision:1,content:{title:'Long term'}})
    expect(await svc.save(userId,goals)).toMatchObject({revision:1})
    expect(await svc.goals(randomUUID())).toMatchObject({revision:0,content:null})
    await expect(svc.save(userId,{...goals,title:'Stale edit'})).rejects.toThrow('changed')
  })
  it('persists one real suggestion per intent and scopes reads to its owner',async()=>{
    await svc.save(userId,goals);const key=randomUUID()
    const plan=await svc.generate(userId,1,key)
    expect(plan).toMatchObject({state:'ready',result:suggestion,model:'test-model'})
    expect((await svc.generate(userId,1,key)).id).toBe(plan.id);expect(complete).toHaveBeenCalledTimes(1)
    await expect(svc.get(randomUUID(),plan.id)).rejects.toThrow('not found')
    await expect(svc.generate(userId,2,key)).rejects.toThrow('another goal revision')
    expect((await runner.query('SELECT count(*)::int AS n FROM app.orders WHERE user_id=$1',[userId]))[0].n).toBe(0)
  })
  it('records a failed generation without saving invalid output or creating orders',async()=>{
    await svc.save(userId,goals);complete.mockResolvedValue({text:'invalid',model:'test'})
    expect(await svc.generate(userId,1,randomUUID())).toMatchObject({state:'failed',result:null})
    expect((await runner.query('SELECT count(*)::int AS n FROM app.orders WHERE user_id=$1',[userId]))[0].n).toBe(0)
    await expect(svc.generate(userId,2,randomUUID())).rejects.toThrow('reload')
  })
})
