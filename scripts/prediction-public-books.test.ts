import assert from 'node:assert/strict'
import {test} from 'node:test'
import {predictionBookTokens,readPredictionPublicBooks} from '../lib/prediction-public-books'

test('token batch input is bounded, deduplicated and numeric only',()=>{
  assert.deepEqual(predictionBookTokens('1,2,1'),['1','2'])
  for(const value of [null,'','https://example.com','1,abc','1,2,3,4,5,6,7,8,9','9'.repeat(91)])assert.equal(predictionBookTokens(value),null)
})
test('public book fetches use at most four concurrent GETs and preserve valid empty books',async()=>{
  let active=0,maxActive=0,count=0
  const fetcher:typeof fetch=async (input,options)=>{
    active++;maxActive=Math.max(maxActive,active);count++
    assert.match(String(input),/^https:\/\/clob\.polymarket\.com\/book\?token_id=\d+$/)
    assert.equal(options?.method,undefined)
    assert.equal(new Headers(options?.headers).get('authorization'),null)
    await new Promise<void>(done=>setImmediate(done))
    active--
    return Response.json({asset_id:new URL(String(input)).searchParams.get('token_id'),asks:[],bids:[]})
  }
  const values=await readPredictionPublicBooks(['1','2','3','4','5','6','7','8'],fetcher)
  assert.equal(count,8);assert.equal(maxActive,4)
  for(const book of Object.values(values)){assert.deepEqual(book?.asks,[]);assert.ok(book?.fetchedAt)}
})
test('upstream HTTP failures, malformed books and wrong assets stay unknown',async()=>{
  const responses=[new Response('',{status:503}),Response.json({asset_id:'wrong',asks:[],bids:[]}),Response.json({asks:[]})]
  const values=await readPredictionPublicBooks(['1','2','3'],async()=>responses.shift()!)
  assert.deepEqual(values,{'1':null,'2':null,'3':null})
})
test('invalid price/size levels are filtered without fabricating an opposite-token quote',async()=>{
  const values=await readPredictionPublicBooks(['1'],async()=>Response.json({asset_id:'1',timestamp:'1791086400',asks:[{price:'.31',size:'10'},{price:'1',size:'10'},{price:'NaN',size:'4'},{price:'.2',size:'-5'}],bids:[{price:'.3',size:'5'}]}))
  assert.deepEqual(values['1']?.asks,[{price:.31,size:10}])
  assert.deepEqual(values['1']?.bids,[{price:.3,size:5}])
  assert.equal(values['1']?.asOf,'2026-10-04T04:00:00.000Z')
})
