import { validatedPredictionPrice } from '../../src/prediction/prediction-quote'
const book = () => ({ tokenId: 'yes', stale: false, asOf: new Date(), asks: [{price:'0.87',size:'1000'},{price:'0.16',size:'1000'}] })
describe('prediction quote boundary', () => {
  it('sorts full positive liquidity and uses only selected token', () => {
    expect(validatedPredictionPrice(book(),'yes',97000000n,.155)).toBe(160000000000000000n)
    expect(validatedPredictionPrice(book(),'no',97000000n,.155)).toBeNull()
  })
  it('rejects last-trade fallbacks, anomalies, insufficient depth and stale books', () => {
    expect(validatedPredictionPrice({...book(),asks:[]},'yes',97000000n,.155)).toBeNull()
    expect(validatedPredictionPrice({...book(),asks:[{price:'0.87',size:'1000'}]},'yes',97000000n,.155)).toBeNull()
    expect(validatedPredictionPrice({...book(),asks:[{price:'0.16',size:'1'}]},'yes',97000000n,.155)).toBeNull()
    expect(validatedPredictionPrice({...book(),stale:true},'yes',97000000n,.155)).toBeNull()
    expect(validatedPredictionPrice(book(),'yes',97000000n,null)).toBeNull()
  })
})
