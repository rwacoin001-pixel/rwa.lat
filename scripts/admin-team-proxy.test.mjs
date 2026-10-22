import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
const require=createRequire(import.meta.url),ts=require('typescript')
const path=new URL('../apps/admin-frontend/src/app/api/admin/[...path]/route.ts',import.meta.url)
function load(fetch,forbidden=false){
  const exports={}
  class NextResponse extends Response{static json(body,init){return new NextResponse(JSON.stringify(body),init)}}
  const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  vm.runInNewContext(output,{exports,URL,Headers,AbortSignal,fetch,require:name=>name==='next/server'?{NextResponse}:name==='@/lib/server/admin-session'?{ADMIN_SESSION_COOKIE:'session',adminApiBase:()=> 'https://admin-api.example.test/v1'}:name==='@/lib/server/csrf'?{rejectCrossOrigin:()=>forbidden?NextResponse.json({}, {status:403}):null}:require(name)})
  return exports
}
function request(key){return {method:'POST',nextUrl:new URL('https://admin.example.test/api/admin/referral/team/b/pay'),cookies:{get:()=>({value:'test-only-session'})},headers:new Headers({'content-type':'application/json',...(key?{'idempotency-key':key}:{})}),text:async()=> '{}'}}
const context={params:Promise.resolve({path:['referral','team','b','pay']})}
test('browser proxy preserves payment idempotency through the first authenticated hop',async()=>{
  let sent
  const route=load(async(url,options)=>{sent={url:String(url),options};return Response.json({status:'paid'})})
  assert.equal((await route.POST(request('batch-payment-key'),context)).status,200)
  assert.equal(sent.options.headers['idempotency-key'],'batch-payment-key')
  assert.equal(sent.options.headers.authorization,'Bearer test-only-session')
})
test('invalid idempotency is refused and CSRF denial never reaches upstream',async()=>{
  let calls=0;const fetch=async()=>{calls++;return Response.json({})}
  assert.equal((await load(fetch).POST(request('bad key'),context)).status,400)
  assert.equal((await load(fetch,true).POST(request('batch-payment-key'),context)).status,403)
  assert.equal(calls,0)
})
