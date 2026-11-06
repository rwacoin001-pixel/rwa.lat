import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { test } from 'node:test'
function load() {
  const exports={}, timers=new Map(); let id=0
  const output=ts.transpileModule(readFileSync(new URL('../lib/transaction-glow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(output,{exports,window:{},Set,setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:key=>timers.delete(key)})
  return {...exports,flush:()=>{for(const fn of timers.values())fn();timers.clear()}}
}
test('only actual financial submissions receive the fullscreen effect',()=>{
  const {isMoneyMutation}=load()
  for(const path of ['/v1/wallet/transfers','/v1/wallet/withdrawals','/v1/orders','/v1/market/orders','/v1/predictions/bets','/v1/basket/portfolios/abc/subscriptions','/v1/quant/products/koala/redemptions','/v1/portfolio/redemptions']) assert.equal(isMoneyMutation(path,'POST'),true,path)
  for(const path of ['/v1/wallet/withdrawals/quote','/v1/wallet/deposit-addresses/ethereum','/v1/wallet/deposit-addresses/ethereum/watch','/v1/auth/email-code/request','/v1/wallet/withdrawal-addresses','/v1/quant/products/koala/subscriptions/preview']) assert.equal(isMoneyMutation(path,'POST'),false,path)
  assert.equal(isMoneyMutation('/v1/orders','GET'),false)
})
test('concurrent requests retain the overlay until every request settles; failure clears it',()=>{
  const m=load(), a=m.beginTransactionGlow(), b=m.beginTransactionGlow()
  assert.equal(m.transactionGlowSnapshot().phase,'processing')
  a(true);assert.equal(m.transactionGlowSnapshot().phase,'processing')
  b(false);assert.equal(m.transactionGlowSnapshot().phase,'idle')
  b(true);assert.equal(m.transactionGlowSnapshot().phase,'idle')
})
test('a response ends the visual without representing a completed payment',()=>{
  const m=load(), end=m.beginTransactionGlow()
  end(true);assert.equal(m.transactionGlowSnapshot().phase,'settling')
  m.flush();assert.equal(m.transactionGlowSnapshot().phase,'idle')
  const snapshot=JSON.stringify(m.transactionGlowSnapshot())
  assert.ok(!/amount|balance|recipient|token|success|completed/.test(snapshot))
})

test('the real request layer follows server responses and leaves quotes on ordinary loading',async()=>{
  for(const [path,status,expected] of [['/v1/wallet/transfers',200,true],['/v1/orders',403,false],['/v1/wallet/withdrawals/quote',200,null]]){
    const events=[], exports={}
    const code=ts.transpileModule(readFileSync(new URL('../lib/api/_http.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    vm.runInNewContext(code,{
      exports, Headers, AbortController, Response, setTimeout, clearTimeout,
      crypto:{randomUUID:()=> 'request-fixture'},window:{},document:{documentElement:{dataset:{brand:'kimeng'}}},
      fetch:async()=>new Response(JSON.stringify(status===200?{state:'pending'}:{code:'REJECTED'}),{status}),
      require:name=>name==='../transaction-glow'?{isMoneyMutation:load().isMoneyMutation,beginTransactionGlow:()=>{events.push('begin');return accepted=>events.push(accepted)}}:name==='./base-url'?{getApiBaseUrl:()=>''}:{beginUiLoading:()=>()=>{}},
    })
    const result=await exports.request(path,{method:'POST',token:null})
    assert.equal(result.ok,status===200)
    if(expected===null)assert.equal(events.length,0)
    else assert.deepEqual(events,['begin',expected])
    if(result.ok)assert.equal(result.data.state,'pending','The effect must never promote pending to completed')
  }
})
