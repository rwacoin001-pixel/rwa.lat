import assert from 'node:assert/strict'
import {test} from 'node:test'
import {activeEventMarkets,eventMarkets,historyQuery,probabilityHistoryState,formatProbability} from '../lib/polymarket-data'
import {estimatePredictionBet} from '../lib/prediction-bet-estimate'
test('keeps future/unknown candidates grouped but excludes expired purchases despite a lagging closed flag',()=>{
  const e={markets:[{id:'1',question:'By Oct 7?',active:true,endDate:'2020-01-01',outcomes:'["Yes","No"]'},{id:'2',question:'By Oct 31?',active:true,outcomes:['Yes','No']},{id:'3',question:'Resolved',closed:true,outcomes:['Yes','No']}]}
  assert.deepEqual(activeEventMarkets(e).map(m=>m.id),['2'])
  assert.equal(eventMarkets(e).length,3)
  assert.match(historyQuery('1h'),/fidelity=1/)
})
test('distinguishes unavailable, empty and partial probability history',()=>{
  assert.equal(probabilityHistoryState([{available:false,points:[]}]),'unavailable')
  assert.equal(probabilityHistoryState([{available:true,points:[]}]),'empty')
  assert.equal(probabilityHistoryState([{available:false,points:[]},{available:true,points:[1]}]),'partial')
})
test('winning return includes principal and losing shares do not refund principal',()=>{
  const e=estimatePredictionBet({stakeAtomic:'100000000',decimals:6,price:.87,placeFeeRate:.03,payoutFeeRate:.03})
  assert.equal(e.stakeAmount,100)
  assert.ok(Math.abs(e.netPayout!-108.14942528735632)<1e-8)
  assert.ok(Math.abs((e.netPayout!-e.stakeAmount!)-8.14942528735632)<1e-8)
})

test('uses the month interval rather than a rejected 30-day explicit range',()=>{
  assert.equal(historyQuery('1m'),'interval=1m&fidelity=60')
  for (const period of ['1h','1d','1w','1m','max'] as const) {
    assert.match(historyQuery(period),new RegExp(`^interval=${period}&fidelity=`))
    assert.doesNotMatch(historyQuery(period),/startTs|endTs/)
  }
  assert.equal(formatProbability(.005,'en'),'<1%')
  assert.equal(formatProbability(0,'en'),'0%')
  assert.equal(formatProbability(.495,'en'),'49.5%')
  assert.equal(formatProbability(NaN,'en'),'—')
})
