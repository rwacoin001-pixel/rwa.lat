import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { AdminControlService } from '../src/admin-control.service'

describe('Automatic quote administration', () => {
  const binding={expectedRevision:0,enabled:true,issuerName:'Issuer',tokenName:'Exact token',tokenSymbol:'REAL',chain:'ethereum',contractAddress:'0x1234567890123456789012345678901234567890'}
  function make() {
    const query=jest.fn().mockResolvedValue([{id:'p1'}])
    const service=new AdminControlService({query} as unknown as DataSource,new ConfigService({APP_ENV:'test'}))
    jest.spyOn(service as any,'query').mockImplementation(query)
    jest.spyOn(service,'getProduct').mockResolvedValue({id:'p1',assetCode:'UNDL'} as any)
    return {service,query}
  }
  it('uses optimistic revision checks and creates a new source binding identity', async () => {
    const {service,query}=make()
    await service.saveAutomaticQuote('p1',binding,'admin1')
    const update=query.mock.calls[0]
    expect(update[0]).toContain("COALESCE((quote_binding_json->>'revision')::integer,0)=$4")
    expect(update[1][3]).toBe(0)
    const saved=JSON.parse(update[1][1])
    expect(saved).toMatchObject({revision:1,chain:'ethereum',issuerName:'Issuer'})
    expect(saved.bindingId).toMatch(/^[a-f0-9-]{36}$/)
  })
  it('rejects concurrent stale updates', async () => {
    const {service,query}=make(); query.mockResolvedValueOnce([])
    await expect(service.saveAutomaticQuote('p1',binding,'admin1')).rejects.toThrow('绑定已被其他管理员修改')
  })
  it('does not permit a manual quote to bypass an automatic binding', async () => {
    const {service}=make()
    jest.spyOn(service,'getProduct').mockResolvedValue({assetCode:'UNDL',quoteBinding:binding} as any)
    await expect(service.addQuote('p1',{unitPriceAtomicAmount:'1',currency:'USD',source:'manual',validUntil:new Date(Date.now()+60000).toISOString()},'admin1')).rejects.toThrow('不能用人工报价替代')
  })
})
