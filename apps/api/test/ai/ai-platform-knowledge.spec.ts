import { AiPlatformKnowledgeService } from '../../src/ai/ai-platform-knowledge.service'
import { AiKnowledgeService } from '../../src/ai/ai-knowledge.service'
import { ConfigService } from '@nestjs/config'
import { parseGroundedReply } from '../../src/ai/ai-grounding'
import { PAGE_DIRECTORY } from '../../src/ai/ai-platform-guide'

describe('Live platform knowledge', () => {
  const fixture = () => {
    let products = [{id:'1f5d3f37-785d-489d-bab5-42a7dc5c06cb',name:'Nvidia',state:'published',orderableQuote:false}]
    const db = {query: jest.fn(async (sql:string) => sql.includes('FROM app.products p') ? products : [])}
    const service = new AiPlatformKnowledgeService(db as any)
    return {db,service,publish:()=>{products=[...products,{id:'9d7f53b0-48a6-4251-a3bc-171a545b3dad',name:'New product',state:'published',orderableQuote:false}]},retire:()=>{products=[]}}
  }
  it('includes registered pages and concrete deposit/QR steps even without manual articles',async()=>{
    const f=fixture();const sources=await f.service.retrieve('怎么充值和扫码转账','zh-CN')
    expect(PAGE_DIRECTORY.length).toBeGreaterThan(60)
    expect(sources.some(s=>s.url==='/assets/cash/deposit')).toBe(true)
    expect(sources.some(s=>s.body.includes('scanning fills the recipient only'))).toBe(true)
    expect(JSON.stringify(sources)).toContain('/profile/security')
  })
  it('reads new publications on the next question and detects retirement during generation',async()=>{
    const f=fixture();const before=await f.service.retrieve('英伟达','zh-CN')
    expect(await f.service.stillCurrent(before)).toBe(true)
    f.publish();const after=await f.service.retrieve('有哪些产品','zh-CN')
    expect(JSON.stringify(after)).toContain('New product')
    expect(await f.service.stillCurrent(before)).toBe(false)
    f.retire();expect(await f.service.stillCurrent(after)).toBe(false)
  })
  it('uses parameterized public queries without account tables, drafts or credentials',async()=>{
    const f=fixture();await f.service.retrieve("' OR 1=1 -- 黄金",'en')
    for(const [sql] of f.db.query.mock.calls){
      expect(sql).not.toContain('OR 1=1')
      expect(sql).not.toMatch(/app\.(users|wallets|ledger|ai_chat)|SELECT \* FROM app\.products|\bdraft\b/)
    }
    expect(JSON.stringify(f.db.query.mock.calls)).toContain('state IN')
  })
  it('allows only links to supplied routes and records, preserving page citations',async()=>{
    const f=fixture();const sources=await f.service.retrieve('充值','zh-CN')
    const deposit=sources.find(s=>s.url==='/assets/cash/deposit')!
    const result=parseGroundedReply(JSON.stringify({reply:'[充值](/assets/cash/deposit) [伪造产品](/asset/fake) [后台](https://admin.rwa.lat) [恶意](javascript:alert)',sourceIds:[deposit.sourceId]}),sources)
    expect(result.reply).toContain('[充值](/assets/cash/deposit)')
    expect(result.reply).not.toContain('/asset/fake')
    expect(result.reply).not.toContain('admin.rwa.lat')
    expect(result.citations[0].url).toBe('/assets/cash/deposit')
    const alias=parseGroundedReply(JSON.stringify({reply:'充值',sourceIds:[deposit.id]}),sources)
    expect(alias.citations[0].sourceId).toBe(deposit.sourceId)
    expect(()=>parseGroundedReply(JSON.stringify({reply:'重复',sourceIds:[deposit.id,deposit.sourceId]}),sources)).toThrow('Duplicate')
  })
  it('retrieves active published fallback-language knowledge without exposing internal records',async()=>{
    const row={id:'9d7f53b0-48a6-4251-a3bc-171a545b3dad',publishedRevision:1,publishedAt:'2026-01-01T00:00:00Z',archivedAt:null,published:{title:'Deposit',body:'Verified deposit process',locale:'en',visibility:'public'}}
    const db={query:jest.fn(async()=>[row,{...row,published:{...row.published,visibility:'internal'}}])}
    const service=new AiKnowledgeService(db as any,new ConfigService({AI_KNOWLEDGE_ENABLED:'true'}))
    const sources=await service.retrieve('充值 deposit','zh-CN',false)
    expect(sources).toHaveLength(1)
    expect(sources[0].locale).toBe('en')
    expect(await service.stillCurrent(sources,false)).toBe(true)
  })
})
