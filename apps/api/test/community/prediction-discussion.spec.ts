import {predictionThreadId} from '../../src/community/prediction-discussion'
describe('prediction discussion identity',()=>{
  it('gives one persistent UUID per event, separating different events',()=>{
    expect(predictionThreadId('123')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(predictionThreadId('123')).toBe(predictionThreadId('123'))
    expect(predictionThreadId('123')).not.toBe(predictionThreadId('124'))
  })
  it('rejects arbitrary external identities',()=>{expect(()=>predictionThreadId('../market')).toThrow()})
})
