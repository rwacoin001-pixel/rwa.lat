import {DataSource} from 'typeorm'
import {PredictionService} from '../../src/prediction/prediction.service'
import {OperationalCapabilityService} from '../../src/operations/operational-capability.service'
import {PolymarketService} from '../../src/polymarket/polymarket.service'
import {ComplianceService} from '../../src/compliance/compliance.service'
describe('prediction single-bet cap removal',()=>{
  const query=jest.fn(async()=>[])
  // On-demand market ingest: when the token is not mapped yet, placeBet asks the
  // polymarket service to ingest it and then re-reads the mapping.
  const polymarket={ensureTokenMapped:jest.fn(async()=>false)} as unknown as PolymarketService
  const service=new PredictionService({query} as unknown as DataSource,{assertEnabled:async()=>{},isEnabled:async()=>true} as unknown as OperationalCapabilityService,polymarket,{} as ComplianceService)
  beforeEach(()=>{query.mockClear();(polymarket.ensureTokenMapped as jest.Mock).mockClear()})
  it('publishes no single-bet cap while keeping daily and exposure limits',async()=>{
    const status=await service.status()
    expect(status.limits.maxStakeAtomic).toBeNull()
    expect(status.limits.maxDailyStakeAtomic).toBe('500000000')
    expect(status.limits.maxMarketExposureAtomic).toBe('500000000')
  })
  it('allows amounts above 100 through to market validation without making a transaction',async()=>{
    await expect(service.placeBet('user','request',{tokenId:'missing',stakeAtomic:'101000000',idempotencyKey:'isolated-test'})).rejects.toMatchObject({response:{code:'PREDICTION_MARKET_NOT_TRADEABLE'}})
    // 映射查询 → 按需入库尝试 → 复查询：共 2 次，且都没有开事务
    expect(query).toHaveBeenCalledTimes(2)
    expect(polymarket.ensureTokenMapped).toHaveBeenCalledWith('missing')
  })
  it('still rejects non-positive stakes before touching the database',async()=>{
    await expect(service.placeBet('user','request',{tokenId:'missing',stakeAtomic:'0',idempotencyKey:'isolated-test'})).rejects.toMatchObject({response:{code:'PREDICTION_STAKE_LIMIT_EXCEEDED'}})
    expect(query).not.toHaveBeenCalled()
    expect(polymarket.ensureTokenMapped).not.toHaveBeenCalled()
  })
})
