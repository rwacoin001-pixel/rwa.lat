import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

function load(path, overrides={}) {
  const filename=resolve(path), exports={}, require=createRequire(filename)
  const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','exports',code)(id=>{
    if(id in overrides)return overrides[id]
    if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}
    if(id.startsWith('.')||id.startsWith('@/')){
      const base=id.startsWith('@/')?resolve(id.slice(2)):resolve(dirname(filename),id)
      for(const suffix of ['.ts','.tsx'])if(existsSync(base+suffix))return load(base+suffix,overrides)
    }
    return require(id)
  },exports)
  return exports
}
const {predictionWalletAction,addPredictionStake,predictionCapacityStake}=load('lib/prediction-ticket-state.ts')
const balance={walletDecimals:6,walletAsset:'USDT',expectedDecimals:6}
test('verified zero, positive, missing and failed balances select different actions',()=>{
  assert.equal(predictionWalletAction({...balance,availableAtomic:'0'}),'deposit')
  assert.equal(predictionWalletAction({...balance,availableAtomic:'1'}),'bet')
  assert.equal(predictionWalletAction({...balance,availableAtomic:null}),'loading')
  assert.equal(predictionWalletAction({...balance,availableAtomic:'0',error:true}),'reload')
  assert.equal(predictionWalletAction({...balance,availableAtomic:'500',error:true}),'reload')
})
test('wrong asset/scale and malformed wallet values cannot enable a bet or fake zero',()=>{
  for(const patch of [{walletAsset:'USDC'},{walletDecimals:18},{availableAtomic:'invalid'},{availableAtomic:'-1'}]) assert.equal(predictionWalletAction({...balance,availableAtomic:'0',...patch}),'reload')
})
test('quick additions preserve atomic precision and allow amounts above 100',()=>{
  assert.equal(addPredictionStake('0.123456',100),'100.123456')
  assert.equal(addPredictionStake('100',100),'200')
  assert.equal(addPredictionStake('',5),'5')
  assert.equal(addPredictionStake('9007199254740993',1),'9007199254740994')
})
test('capacity suggestion is rounded down after the authoritative placement fee',()=>{
  const stake=predictionCapacityStake(35.20422,.03,6)
  assert.equal(stake,'36.29301')
  assert.ok(Number(stake)*.97<=35.20422+1e-9)
  for(const input of [0,NaN,-1,Infinity]) assert.equal(predictionCapacityStake(input,.03),null)
  assert.equal(predictionCapacityStake(10,1),null)
})
function view(locale, patch={}) {
  const {PredictionBetForm}=load('components/maison/PredictionBetForm.tsx',{'@/lib/i18n':{useI18n:()=>({locale})},'./primitives':{maison:new Proxy({},{get:(_,key)=>String(key)})}})
  const noop=()=>{}
  return renderToStaticMarkup(createElement(PredictionBetForm,{stake:'10',onStake:noop,onAdd:noop,outcomes:[{label:'Yes',probability:'35%',disabled:false},{label:'No',probability:'65%',disabled:false}],outcome:0,onOutcome:noop,balance:'10 USDT',walletAction:'bet',price:'35¢',shares:'27.71',fees:'.30 USDT',netPayout:'27.43 USDT',updatedAt:'12:00',refreshing:false,pending:false,risk:false,ready:false,onRisk:noop,onRefresh:noop,onLower:noop,onReload:noop,onDeposit:noop,onSubmit:noop,...patch}))
}
const cta=html=>[...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].at(-1)?.[0]
test('zero balance has active deposit even without amount or consent; wallet failure offers retry',()=>{
  const deposit=view('zh-CN',{walletAction:'deposit',stake:'',balance:'0 USDT'})
  assert.match(cta(deposit),/充值/);assert.doesNotMatch(cta(deposit),/disabled/)
  assert.doesNotMatch(deposit,/type="checkbox"/)
  const failed=view('zh-CN',{walletAction:'reload'})
  assert.match(cta(failed),/重试/);assert.doesNotMatch(cta(failed),/disabled/)
})
test('bet keeps consent, loading/invalid quote/pending prevent submit, ready allows it',()=>{
  assert.match(view('zh-CN'),/type="checkbox"/)
  assert.match(cta(view('zh-CN')),/disabled/)
  assert.doesNotMatch(cta(view('zh-CN',{ready:true,risk:true})),/disabled/)
  assert.match(cta(view('zh-CN',{ready:true,risk:true,pending:true})),/disabled/)
  assert.match(cta(view('zh-CN',{walletAction:'loading'})),/disabled/)
})
test('seven locales keep compact details, quick amounts, net winnings and refresh affordance',()=>{
  for(const locale of ['en','zh-CN','hi','es','ar','fr','pt']) {
    const html=view(locale)
    assert.match(html,/<details/)
    for(const amount of [1,5,10,100])assert.ok(html.includes(`+${amount}`))
    assert.ok(html.includes('27.43 USDT'))
    assert.match(html,/<div[^>]*role="status"/)
  }
  const expired=view('zh-CN',{quoteReason:'expired'})
  assert.match(expired,/报价已过期/);assert.match(expired,/刷新报价/)
})

test('no liquidity disables betting without a repeated warning and retains recovery actions',()=>{
  const empty=view('zh-CN',{quoteReason:'no_liquidity'})
  assert.doesNotMatch(empty,/当前卖盘不足以成交此金额/)
  assert.match(cta(empty),/disabled/)
  assert.match(empty,/刷新报价/)
  const large=view('zh-CN',{quoteReason:'no_liquidity',amountTooLarge:true,smallerStake:'5'})
  assert.doesNotMatch(large,/当前卖盘不足以成交此金额/)
  assert.match(large,/调低金额 · 5/)
  assert.match(cta(large),/disabled/)
})
