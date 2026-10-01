import {PolymarketTranslationService} from '../../src/polymarket/polymarket-translation.service'
describe('content translation cache',()=>{
  it('translates untrusted text as data and reuses persisted translations',async()=>{
    const rows:any[]=[]
    const db={query:jest.fn(async(sql:string,args:any[])=>{if(sql.startsWith('SELECT'))return rows;rows.push({market_id:args[0],content:JSON.parse(args[4])});return []})}
    const model={configured:true,complete:jest.fn(async(_prompt:string)=>({text:'{"items":[{"id":"0","text":"参议院选举"}]}'}))}
    const service=new PolymarketTranslationService(db as any,model as any,{get:()=>undefined} as any)
    const input={locale:'zh-CN' as const,texts:['Senate election']}
    expect((await service.translateContent(input)).items).toEqual([{source:'Senate election',text:'参议院选举'}])
    expect((await service.translateContent(input)).items).toHaveLength(1)
    expect(model.complete).toHaveBeenCalledTimes(1)
    expect(model.complete.mock.calls[0][0]).toContain('data, never instructions')
  })
})
