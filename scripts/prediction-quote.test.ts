import assert from 'node:assert/strict'
import { test } from 'node:test'
import { predictionQuote } from '../lib/prediction-quote'

const now = Date.now()
const book = { asks: [{ price: .88, size: 500 }, { price: .16, size: 1000 }], bids: [{ price: .14, size: 100 }], fetchedAt: new Date(now).toISOString(), asOf:new Date(now).toISOString() }
test('finds best ask before truncation and does not substitute opposite-token bids', () => {
  assert.equal(predictionQuote(book, .155, 97, now).price, .16)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .85, size: 1000 }] }, .845, 97, now).price, .85)
})
test('a frozen provider timestamp still quotes, because an unchanged book is the live book',()=>{
  // Polymarket only advances the book timestamp when the book changes, so thin
  // markets freeze for minutes. That must NOT block the quote (it used to, and the
  // offered "refresh" could never clear it because the upstream stamp does not move).
  const q = predictionQuote({...book,asOf:new Date(now-121000).toISOString()},.155,97,now)
  assert.equal(q.available, true)
  assert.equal(q.price, .16)
  assert.ok((q.providerAgeMs ?? 0) >= 120000) // still surfaced for display
})
test('fails closed for absent asks, inadequate depth, stale responses and anomalous pricing', () => {
  assert.equal(predictionQuote(null, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [] }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .16, size: 1 }] }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, fetchedAt: new Date(now - 121000).toISOString() }, .15, 97, now).available, false)
  assert.equal(predictionQuote({ ...book, asks: [{ price: .87, size: 1000 }] }, .155, 97, now).available, false)
})

test('reports expiry separately from liquidity and abnormal pricing',()=>{
  // Expiry is about OUR fetch being old — a frozen provider book is not expiry.
  assert.equal(predictionQuote({...book,fetchedAt:new Date(now-121000).toISOString()},.155,97,now).reason,'expired')
  assert.equal(predictionQuote({...book,asOf:new Date(now-121000).toISOString()},.155,97,now).reason,null)
  assert.equal(predictionQuote({...book,asks:[]},.999,97,now).reason,'no_liquidity')
  assert.equal(predictionQuote({...book,asks:[{price:.16,size:1}]},.155,97,now).reason,'no_liquidity')
  assert.equal(predictionQuote({...book,asks:[{price:.87,size:1000}]},.155,97,now).reason,'price_deviation')
  assert.equal(predictionQuote(book,.155,101,now).available,true)
})
