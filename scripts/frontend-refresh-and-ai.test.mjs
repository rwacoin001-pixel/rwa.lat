import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import ts from 'typescript'

// Run the actual modules without a browser session, network requests or source
// rewrites. React hooks are represented only to subscribe to the query cache.
function load(path, overrides={}){
  const filename=resolve(path), exports={}
  const require=createRequire(filename)
  const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,resolveJsonModule:true}}).outputText
  new Function('require','exports','window',code)(id=>id in overrides?overrides[id]:require(id),exports,{addEventListener(){},removeEventListener(){}})
  return exports
}
const {containsWalletSecret}=load('lib/ai-input-guard.ts')
test('ordinary English investment questions are not treated as wallet credentials',()=>{
  for(const message of ['please explain which public investment products are suitable for a conservative beginner and why','I would like to compare the available products before making any investment decision','请说明产品风险，不要替我下单']) assert.equal(containsWalletSecret(message),false)
})
test('public dictionary recovery phrases remain blocked, including uppercase and embedded text',()=>{
  const publicFixture=Array(12).fill('abandon').join(' ')
  for(const message of [publicFixture,publicFixture.toUpperCase(),`test fixture: ${publicFixture}`]) assert.equal(containsWalletSecret(message),true)
})
test('hexadecimal key material remains blocked with or without a prefix',()=>{
  for(const prefix of ['','0x']) assert.equal(containsWalletSecret(prefix+'a'.repeat(64)),true)
})
function queries(){
  const cleanup=[]
  const react={useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{const close=fn();if(close)cleanup.push(close)},useSyncExternalStore:(subscribe,snapshot)=>{cleanup.push(subscribe(()=>{}));return snapshot()}}
  const module=load('lib/api/_query.ts',{react,'./_http':{SESSION_EXPIRED:'expired',SESSION_CHANGED:'changed',getSessionToken:()=>null},'@/lib/ui-loading':{beginUiLoading:()=>()=>{},markUiLoadingNetworkComplete(){}}})
  return {...module,cleanup:()=>cleanup.reverse().forEach(close=>close())}
}
test('refresh remains pending until all visible requests actually settle',async()=>{
  const query=queries();let finish
  query.useQuery('first',()=>Promise.resolve({ok:true,data:1}))
  query.useQuery('second',()=>new Promise(resolve=>{finish=resolve}))
  let completed=false
  const refreshing=query.invalidate('').then(result=>{completed=true;return result})
  await Promise.resolve();await Promise.resolve()
  assert.equal(completed,false)
  finish({ok:true,data:2})
  assert.equal(await refreshing,true)
  query.cleanup()
})
test('one failed visible request prevents a successful refresh result',async()=>{
  const query=queries()
  query.useQuery('first',()=>Promise.resolve({ok:true,data:1}))
  query.useQuery('failed',()=>Promise.resolve({ok:false,error:{status:503,code:'UNAVAILABLE',message:'fixture'}}))
  assert.equal(await query.invalidate(''),false)
  query.cleanup()
})
test('refresh does not succeed after an account change invalidates the in-flight results',async()=>{
  const query=queries();let finish
  query.useQuery('private',()=>new Promise(resolve=>{finish=resolve}))
  const refreshing=query.invalidate('')
  query.clearQueryCache()
  finish({ok:true,data:'old-account-fixture'})
  assert.equal(await refreshing,false)
  query.cleanup()
})
