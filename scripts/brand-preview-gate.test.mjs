import {test} from 'node:test'
import assert from 'node:assert/strict'
import {brandRequestGate, previewPasswordHash} from '../lib/brand/preview-gate.mjs'
const env={SITE_BRAND:'kimeng',KIMENG_RELEASE_MODE:'preview',KIMENG_PREVIEW_PASSWORD_SHA256:await previewPasswordHash('example-preview-password')}
const req=(path,method='GET',password='example-preview-password')=>new Request(`https://kimengresearch.com${path}`,{method,headers:{Authorization:`Basic ${btoa(`kimeng:${password}`)}`}})
test('Kimeng stays closed by default and without a configured preview credential',async()=>{
 assert.equal((await brandRequestGate(req('/home'),{SITE_BRAND:'kimeng'})).response.status,503)
 assert.equal((await brandRequestGate(req('/home'),{SITE_BRAND:'kimeng',KIMENG_RELEASE_MODE:'preview'})).response.status,503)
})
test('correct credentials enter preview but unknown hosts and incorrect credentials cannot',async()=>{
 assert.equal((await brandRequestGate(req('/home'),env)).preview,true)
 assert.equal((await brandRequestGate(req('/__preview','GET','wrong'),env)).response.status,401)
 assert.equal((await brandRequestGate(new Request('https://evil.test/home'),env)).response.status,421)
})
test('www canonicals stay on Kimeng and HTTP upgrades before authentication',async()=>{
 assert.equal((await brandRequestGate(new Request('https://www.kimengresearch.com/home?q=1'),env)).response.headers.get('location'),'https://kimengresearch.com/home?q=1')
 assert.equal((await brandRequestGate(new Request('http://kimengresearch.com/home'),env)).response.status,308)
})
test('preview cannot access account APIs, sign in, or submit financial requests',async()=>{
 for(const[path,method]of[['/v1/identity/email/code','POST'],['/v1/wallet/summary','GET'],['/v1/orders','POST'],['/%76%31/wallet/summary','GET'],['/api/referral/invite','GET'],['/home','POST']]){
  const result=await brandRequestGate(req(path,method),env)
  assert.equal(result.response.status,503)
  assert.equal((await result.response.json()).code,'KIMENG_PREVIEW_ONLY')
 }
 assert.equal((await brandRequestGate(req('/v1/markets'),env)).response.status,503)
})
test('preview credentials and account cookies never pass through to discovery APIs',async()=>{
 const request=req('/v1/basket/portfolios')
 request.headers.set('cookie','rwa.session=example')
 const result=await brandRequestGate(request,env)
 assert.equal(result.request.headers.get('authorization'),null)
 assert.equal(result.request.headers.get('cookie'),null)
 assert.equal(result.preview,true)
})
test('A-REIT account requests retain existing behavior',async()=>{
 const request=new Request('https://a-reit.com/v1/orders',{method:'POST',headers:{Authorization:'Bearer example'}})
 const result=await brandRequestGate(request,{})
 assert.equal(result.request,request)
 assert.equal(result.preview,false)
})
test('reserved routes cannot bypass read-only preview through case or referral attribution',async()=>{
 for(const path of ['/V1/auth/consent-requirements','/V1/basket/portfolios','/API/referral/invite','/Auth/callback/google','/auth','/r/Sample12','/R/Sample12','/app-login','/app-handoff','/sw.js']) {
  const result=await brandRequestGate(req(path),env)
  assert.equal(result.response?.status,503,path)
 }
})
test('only authenticated static auth imagery can pass the auth-page restriction',async()=>{
 for(const path of ['/auth/auth-warm-still.png','/auth/auth-cool-loop-h264.mp4','/auth/icon-google-color.png','/auth/icon-github.svg','/auth/icon-wallet.svg']){
  assert.equal((await brandRequestGate(req(path),env)).preview,true)
  assert.equal((await brandRequestGate(new Request('https://kimengresearch.com'+path),env)).response.status,401)
 }
 assert.equal((await brandRequestGate(req('/auth/unknown.png'),env)).response.status,503)
})
