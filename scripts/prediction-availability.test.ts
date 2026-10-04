import assert from 'node:assert/strict'
import {test} from 'node:test'
import {evaluatePredictionDirections,hideUnavailablePrediction,predictionCountdown} from '../lib/prediction-availability'
import {predictionAvailabilityText} from '../lib/prediction-availability-copy'
import {localeOptions} from '../lib/app-locales'

const now=Date.parse('2026-10-04T04:00:00Z')
const market={id:'1',prices:[.3,.7],tokenIds:['11','12'],acceptingOrders:true}
const book=(price:number,size:number)=>({asks:[{price,size}],bids:[],fetchedAt:new Date(now).toISOString()})

test('thin books remain selectable for smaller valid stakes; empty books are disabled',()=>{
  const thin=evaluatePredictionDirections(market,[book(.3,1),book(.7,20)],now)
  assert.equal(thin[0].state,'available')
  assert.equal(thin[0].reason,'thin_book')
  assert.equal(thin[1].state,'available')
  assert.equal(hideUnavailablePrediction(thin),false)
  const empty=evaluatePredictionDirections(market,[book(.3,0),book(.7,0)],now)
  assert.equal(empty[0].reason,'empty_book')
  assert.equal(hideUnavailablePrediction(empty),true)
})
test('an amount that exceeds capacity does not blacklist a direction with a smaller valid order',()=>{
  const directions=evaluatePredictionDirections(market,[book(.3,100),book(.7,100)],now)
  assert.equal(directions[0].state,'available')
  assert.equal(directions[0].depth,30)
  assert.equal(hideUnavailablePrediction(directions),false)
})
test('failed and expired reads never hide a market, including stale empty books',()=>{
  const staleEmpty={...book(.3,0),fetchedAt:new Date(now-121000).toISOString()}
  const cases=[evaluatePredictionDirections(market,[null,null],now),evaluatePredictionDirections(market,[staleEmpty,book(.7,0)],now)]
  for(const directions of cases){assert.equal(directions[0].state,'unknown');assert.equal(hideUnavailablePrediction(directions),false)}
  assert.equal(cases[1][0].reason,'expired')
})
test('closed or explicitly paused source directions can be disabled without book calls',()=>{
  for(const flags of [{closed:true},{acceptingOrders:false}]){
    const directions=evaluatePredictionDirections({...market,...flags},[],now)
    assert.equal(hideUnavailablePrediction(directions),true)
  }
  assert.equal(hideUnavailablePrediction(evaluatePredictionDirections({...market,acceptingOrders:undefined},[],now)),false)
})
test('abnormal prices are excluded, while frozen upstream timestamps remain valid',()=>{
  const directions=evaluatePredictionDirections(market,[book(.8,100),{...book(.7,100),asOf:new Date(now-900000).toISOString()}],now)
  assert.equal(directions[0].reason,'price_deviation')
  assert.equal(directions[1].state,'available')
})
test('baseline is conservative and exact best-price depth is preserved',()=>{
  const asks={...book(.3,2),asks:[{price:.6,size:10000},{price:.3,size:2}]}
  assert.equal(evaluatePredictionDirections(market,[asks],now)[0].depth,.6)
  assert.equal(evaluatePredictionDirections(market,[asks],now)[0].state,'available')
  assert.equal(evaluatePredictionDirections(market,[asks],now,.5)[0].state,'available')
})
test('countdown uses source date and reaching it does not claim a settled result',()=>{
  assert.equal(predictionCountdown(null,now),null)
  assert.equal(predictionCountdown('invalid',now),null)
  assert.deepEqual(predictionCountdown(new Date(now+90061000).toISOString(),now),{reached:false,days:1,hours:1,minutes:1,seconds:1})
  assert.deepEqual(predictionCountdown(new Date(now-1000).toISOString(),now),{reached:true,days:0,hours:0,minutes:0,seconds:0})
  assert.equal(predictionCountdown(new Date(now+10).toISOString(),now)?.seconds,1)
})
test('availability, retry, help and countdown have all seven software languages',()=>{
  for(const {code} of localeOptions){for(const key of ['Ends in','Hide unavailable','Refresh quotes','Small capacity','How to play'] as const)assert.ok(predictionAvailabilityText(code,key))}
  assert.equal(predictionAvailabilityText('zh-CN','How to play'),'玩法介绍')
})
