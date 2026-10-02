import {DataSource} from 'typeorm'
import {PredictionService} from '../../src/prediction/prediction.service'
import {OperationalCapabilityService} from '../../src/operations/operational-capability.service'
import {PolymarketService} from '../../src/polymarket/polymarket.service'
import {ComplianceService} from '../../src/compliance/compliance.service'
describe('prediction single-bet cap removal',()=>{
  const query=jest.fn(async()=>[])
  const service=new PredictionService({query} as unknown as DataSource,{assertEnabled:async()=>{},isEnabled:async()=>true} as unknown as OperationalCapabilityService,{} as PolymarketService,{} as ComplianceService)
  beforeEach(()=>query.mockClear())
  it('publishes no single-bet cap while keeping daily and exposure limits',async()=>{
    const status=await service.status()
    expect(status.limits.maxStakeAtomic).toBeNull()
    expect(status.limits.maxDailyStakeAtomic).toBe('500000000')
    expect(status.limits.maxMarketExposureAtomic).toBe('500000000')
  })
  it('allows amounts above 100 through to market validation without making a transaction',async()=>{
    await expect(service.placeBet('user','request',{tokenId:'missing',stakeAtomic:'101000000',idempotencyKey:'isolated-test'})).rejects.toMatchObject({response:{code:'PREDICTION_MARKET_NOT_TRADEABLE'}})
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('still rejects non-positive stakes before touching the database',async()=>{
    await expect(service.placeBet('user','request',{tokenId:'missing',stakeAtomic:'0',idempotencyKey:'isolated-test'})).rejects.toMatchObject({response:{code:'PREDICTION_STAKE_LIMIT_EXCEEDED'}})
    expect(query).not.toHaveBeenCalled()
  })
})
