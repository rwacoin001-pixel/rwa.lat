import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve,dirname} from 'node:path'
import ts from 'typescript'

function loader(overrides={}){
  const cache=new Map()
  const load=path=>{
    const filename=resolve(path)
    if(cache.has(filename))return cache.get(filename)
    const exports={};cache.set(filename,exports)
    const require=createRequire(filename)
    const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,experimentalDecorators:true}}).outputText
    new Function('require','exports',code)(id=>{
      if(id in overrides)return overrides[id]
      const base=id.startsWith('@/')?resolve(id.slice(2)):id.startsWith('.')?resolve(dirname(filename),id):null
      if(base)for(const suffix of ['.ts','.tsx'])if(existsSync(base+suffix))return load(base+suffix)
      return require(id)
    },exports)
    return exports
  }
  return load
}
async function mocked(fetcher,work){const original=globalThis.fetch;globalThis.fetch=fetcher;try{return await work()}finally{globalThis.fetch=original}}
const provider='apps/api/src/polymarket/public/public-fetch.ts'

test('concurrent public reads share a request, retain their source timestamps and bounded cache',async()=>{
  const {publicFetch}=loader()(provider)
  let calls=0,complete
  await mocked(()=>{calls++;return new Promise(resolve=>{complete=()=>resolve(Response.json({timestamp:'1791111000000'}))})},async()=>{
    const url='https://clob.polymarket.com/book?token_id=1'
    const first=publicFetch(url,{next:{revalidate:10}}),second=publicFetch(url,{next:{revalidate:10}})
    await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);complete()
    const results=await Promise.all([first,second]);assert.deepEqual(await results[0].json(),await results[1].json())
    assert.equal((await (await publicFetch(url)).json()).timestamp,'1791111000000');assert.equal(calls,1)
  })
})

test('explicit refresh bypasses the cache and in-flight cached book reads',async()=>{
  const {publicFetch}=loader()(provider);let calls=0
  await mocked(async()=>Response.json({sequence:++calls}),async()=>{
    const url='https://clob.polymarket.com/book?token_id=1'
    await publicFetch(url);const result=await publicFetch(url,{cache:'no-store'})
    assert.equal((await result.json()).sequence,2);assert.equal(calls,2)
  })
})

test('provider memory bounds reject oversized data and non-provider targets before reading',async()=>{
  const {publicFetch}=loader()(provider);let calls=0,cancelled=0
  await mocked(async()=>{calls++;return new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{'content-length':String(33*1024*1024)}})},async()=>{
    await assert.rejects(publicFetch('https://evil.invalid/events'),/Unsupported provider/);assert.equal(calls,0)
    await assert.rejects(publicFetch('https://gamma-api.polymarket.com/events'),/too large/);assert.equal(cancelled,1)
  })
})

test('all four chart requests run with only two provider requests active',async()=>{
  const {publicFetch}=loader()(provider);let peak=0,active=0
  await mocked(async()=>{peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,5));active--;return Response.json({history:[]})},async()=>{
    const results=await Promise.all([1,2,3,4].map(id=>publicFetch(`https://clob.polymarket.com/prices-history?market=${id}`)))
    assert.equal(results.length,4);assert.equal(peak,2);assert.ok(results.every(response=>response.ok))
  })
})

test('public edge relay streams only compact backend responses and forwards no session headers',async()=>{
  const {proxyPublicPrediction}=loader()('lib/prediction-public-proxy.ts');let received
  await mocked(async(url,options)=>{received={url:String(url),options};return Response.json({items:[]},{headers:{'cache-control':'public,max-age=10'}})},async()=>{
    const response=await proxyPublicPrediction(new Request('https://rwa.lat/api/polymarket/feed?sort=volume',{headers:{authorization:'test-only',cookie:'test-only'}}),'feed','https://api.rwa.lat')
    assert.deepEqual(await response.json(),{items:[]});assert.equal(response.headers.get('cache-control'),'public,max-age=10')
    assert.equal(received.url,'https://api.rwa.lat/v1/polymarket/public/feed?sort=volume')
    assert.deepEqual(received.options.headers,{accept:'application/json'})
    assert.equal((await proxyPublicPrediction(new Request('https://rwa.lat/'),'event/../../auth')).status,400)
  })
})

test('relay never turns an error page into a cacheable public JSON response',async()=>{
  const {proxyPublicPrediction}=loader()('lib/prediction-public-proxy.ts')
  for(const result of [new Response('upstream html',{headers:{'content-type':'text/html'}}),new Response('error',{status:503})]){
    await mocked(async()=>result,async()=>{const response=await proxyPublicPrediction(new Request('https://rwa.lat/'),'feed');assert.equal(response.status,502);assert.equal(response.headers.get('cache-control'),null)})
  }
})

test('featured cards reuse the primary feed page instead of downloading a second giant page',async()=>{
  const {GET}=loader()( 'apps/api/src/polymarket/public/feed.ts');const urls=[]
  await mocked(async url=>{urls.push(String(url));return Response.json(String(url).includes('/slug/')?{}:[{id:'123',title:'Open event',markets:[{id:'1',question:'Open market',outcomes:['Yes','No'],outcomePrices:['0.4','0.6']}]}])},async()=>{
    const page=await (await GET(new Request('https://api.rwa.lat/v1/polymarket/public/feed'))).json()
    assert.equal(page.items.length,1);assert.equal(urls.filter(url=>new URL(url).pathname==='/events').length,1)
    assert.ok(!urls.some(url=>url.includes('limit=40')))
  })
})

test('direct Worker public requests bypass Next while account and auth requests stay in Next',async()=>{
  let nextCalls=0,relayCalls=0
  const {default:worker}=loader({'../../.open-next/worker.js':{__esModule:true,default:{fetch:()=>{nextCalls++;return new Response('next')}}},'../../lib/prediction-public-proxy':{proxyPublicPrediction:async()=>{relayCalls++;return Response.json({items:[]})}}})('workers/frontend/index.mjs')
  await worker.fetch(new Request('https://rwa.lat/api/polymarket/feed'),{API_INTERNAL_URL:'https://api.rwa.lat'},{})
  for(const path of ['/home','/api/auth/session','/auth/callback/google','/v1/prediction/bets'])await worker.fetch(new Request('https://rwa.lat'+path),{API_INTERNAL_URL:'https://api.rwa.lat'},{})
  assert.equal(relayCalls,1);assert.equal(nextCalls,4)
})

test('backend caches the reduced response and coalesces concurrent discovery requests',async()=>{
  const decorator=()=>()=>undefined
  const {PolymarketDiscoveryController}=loader({'@nestjs/common':{Controller:decorator,Get:decorator,Req:decorator,Res:decorator}})('apps/api/src/polymarket/public/polymarket-discovery.controller.ts')
  const controller=new PolymarketDiscoveryController();let providerCalls=0
  const request={originalUrl:'/v1/polymarket/public/feed?category=sports'}
  const response=()=>({headers:{},statusCode:200,type(){return this},setHeader(k,v){this.headers[k]=v;return this},status(code){this.statusCode=code;return this},send(body){this.body=body;return this}})
  await mocked(async()=>{providerCalls++;await new Promise(resolve=>setTimeout(resolve,5));return Response.json([{id:'123',title:'Live match',markets:[{id:'1',question:'Team wins?',outcomes:['Yes','No'],outcomePrices:['0.4','0.6']}]}])},async()=>{
    const a=response(),b=response(),c=response()
    await Promise.all([controller.feed(request,a),controller.feed(request,b)])
    await controller.feed(request,c)
    assert.equal(providerCalls,1);assert.equal(a.body,b.body);assert.equal(b.body,c.body)
    assert.equal(c.statusCode,200);assert.equal(c.headers['Cache-Control'],'public,max-age=10')
    assert.equal(JSON.parse(c.body).items[0].id,'event-123')
  })
})

test('backend errors cannot become reusable cached market data',async()=>{
  const decorator=()=>()=>undefined
  const {PolymarketDiscoveryController}=loader({'@nestjs/common':{Controller:decorator,Get:decorator,Req:decorator,Res:decorator}})('apps/api/src/polymarket/public/polymarket-discovery.controller.ts')
  const controller=new PolymarketDiscoveryController();let calls=0
  const response=()=>({headers:{},type(){return this},setHeader(k,v){this.headers[k]=v;return this},status(code){this.statusCode=code;return this},send(body){this.body=body;return this}})
  await mocked(async()=>{calls++;return new Response('failed',{status:503})},async()=>{
    for(let index=0;index<2;index++){const res=response();await controller.feed({originalUrl:'/v1/polymarket/public/feed?category=sports'},res);assert.equal(res.statusCode,502);assert.equal(res.headers['Cache-Control'],'no-store')}
    assert.equal(calls,2)
  })
})
