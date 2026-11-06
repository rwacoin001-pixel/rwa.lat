import assert from 'node:assert/strict'
import {test} from 'node:test'
import {brandRequestGate} from '../lib/brand/preview-gate.mjs'
import {kimengOAuthReturn} from '../lib/brand/oauth-return.mjs'
import {withClientHeaders} from '../lib/edge-client-headers.mjs'
import {kimengPhoneRedirect, PHONE_GUIDE_PATH} from '../lib/brand/phone-access.mjs'

const env = {SITE_BRAND:'kimeng', KIMENG_RELEASE_MODE:'public', EDGE_CLIENT_SIGNING_SECRET:'test-key'}
const origin = 'https://kimengresearch.com'
test('public mode requires signed edge access and preserves bearer authentication', async () => {
  const req = new Request(origin + '/v1/wallet/withdrawals', {method:'POST',headers:{authorization:'Bearer account',origin}})
  assert.equal((await brandRequestGate(req, {...env,EDGE_CLIENT_SIGNING_SECRET:undefined})).response.status,503)
  const live = await brandRequestGate(req, env)
  assert.equal(live.kimeng,true)
  assert.equal(live.request.headers.get('authorization'),'Bearer account')
  assert.equal((await brandRequestGate(new Request(req,{headers:{origin:'https://untrusted.example'}}),env)).response.status,403)
  const basic = await brandRequestGate(new Request(origin + '/login',{headers:{authorization:'Basic ZXhhbXBsZQ=='}}),env)
  assert.equal(basic.request.headers.has('authorization'),false)
})

test('edge overwrites an injected brand and signs only the configured brand', async () => {
  const req = new Request(origin + '/v1/auth/session',{headers:{'x-site-brand':'untrusted','cf-connecting-ip':'203.0.113.8'}})
  assert.equal((await withClientHeaders(req,'test-key')).headers.get('x-site-brand'),null)
  const signed = await withClientHeaders(req,'test-key',1700000000000,'kimeng')
  assert.equal(signed.headers.get('x-site-brand'),'kimeng')
  assert.match(signed.headers.get('x-client-sig'),/^v2\.1700000000\.[A-Za-z0-9_-]{43}$/)
})

test('OAuth relay verifies state and returns only to the fixed Kimeng callback', async () => {
  const state='km_'+'a'.repeat(43)
  const url=new URL(`https://a-reit.com/auth/callback/google?state=${state}&code=example&redirect_uri=https://untrusted.example`)
  const api='https://api.a-reit.com'
  assert.equal((await kimengOAuthReturn(url,api,async()=>Response.json({kimeng:false}))).status,400)
  const result=await kimengOAuthReturn(url,api,async(target,init)=>{
    assert.equal(target.href,api+'/v1/auth/oauth/google/kimeng-return')
    assert.equal(init.method,'POST')
    assert.deepEqual(JSON.parse(init.body),{state})
    return Response.json({kimeng:true})
  })
  assert.equal(result.status,303)
  assert.equal(result.headers.get('location'),`${origin}/auth/callback/google?code=example&state=${state}`)
  assert.equal(result.headers.get('cache-control'),'no-store')
  assert.equal(await kimengOAuthReturn(new URL('https://a-reit.com/auth/callback/google?state='+ 'b'.repeat(43)),api),null)
})

test('desktop application documents always redirect to the phone guide without carrying query parameters', () => {
  for (const path of ['/home', '/markets?tab=assets', '/assets/cash/deposit', '/community', '/profile', '/ai-assistant']) {
    const response = kimengPhoneRedirect(new Request(origin + path, {
      headers: {'user-agent': 'Mozilla/5.0 (Windows NT 10.0)', 'sec-ch-ua-mobile': '?0'},
    }))
    assert.equal(response.status, 307, path)
    assert.equal(response.headers.get('location'), origin + PHONE_GUIDE_PATH)
    assert.match(response.headers.get('cache-control'), /no-store/)
  }
  assert.equal(kimengPhoneRedirect(new Request(origin + '/')).headers.get('location'), origin + '/login')
  for (const path of [PHONE_GUIDE_PATH, '/login', '/register', '/auth/callback/google', '/terms', '/privacy', '/r/ABC123', '/api/referral/invite', '/v1/ai/status']) {
    assert.equal(kimengPhoneRedirect(new Request(origin + path)), null, path)
  }
})

test('iPhone, Android phone and the packaged WebView retain application routing', () => {
  for (const headers of [
    {'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148'},
    {'user-agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36'},
    {'user-agent': 'Mozilla/5.0 (Linux; Android 15) RwaLatAndroidTrial/1.0.1'},
    {'user-agent': 'Mozilla/5.0 (Linux; Android 15)', 'sec-ch-ua-mobile': '?1'},
  ]) {
    assert.equal(kimengPhoneRedirect(new Request(origin + '/home', {headers})), null)
  }
  for (const userAgent of ['Mozilla/5.0 (iPad; CPU OS 18_0) Mobile/15E148', 'Mozilla/5.0 (Linux; Android 15) Safari/537.36']) {
    assert.equal(kimengPhoneRedirect(new Request(origin + '/home', {headers: {'user-agent': userAgent}})).status, 307)
  }
})
