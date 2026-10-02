import assert from 'node:assert/strict'
import { test } from 'node:test'
import { predictionQuote } from '../lib/prediction-quote'

const now = Date.now()
const book = { asks: [{ price: .88, size: 500 }, { price: .16, size: 1000 }], bids: [{ price: .14, size: 100 }], fetchedAt: new Date(now).toISOString(), asOf:new Date(now).toISOString() }
test('finds best ask before truncation and does not substitute opposite-token bids', () => {
  assert.equal(predictionQuote(book, .155, 97, now).price, .16)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .85, size: 1000 }] }, .845, 97, now).price, .85)
})
test('an old provider timestamp remains stale after a fresh response',()=>{
  assert.equal(predictionQuote({...book,asOf:new Date(now-121000).toISOString()},.155,97,now).available,false)
})
test('fails closed for absent asks, inadequate depth, stale responses and anomalous pricing', () => {
  assert.equal(predictionQuote(null, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [] }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .16, size: 1 }] }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, fetchedAt: new Date(now - 121000).toISOString() }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .87, size: 1000 }] }, .155, 97, now).available, false)
})

test('reports expiry separately from liquidity and abnormal pricing',()=>{
  assert.equal(predictionQuote({...book,asOf:new Date(now-121000).toISOString()},.155,97,now).reason,'expired')
  assert.equal(predictionQuote({...book,asks:[]},.999,97,now).reason,'no_liquidity')
  assert.equal(predictionQuote({...book,asks:[{price:.16,size:1}]},.155,97,now).reason,'no_liquidity')
  assert.equal(predictionQuote({...book,asks:[{price:.87,size:1000}]},.155,97,now).reason,'price_deviation')
  assert.equal(predictionQuote(book,.155,101,now).available,true)
})
