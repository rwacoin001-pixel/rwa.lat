import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve,dirname} from 'node:path'
import ts from 'typescript'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

function load(path,overrides={}) {
  const filename=resolve(path),exports={},require=createRequire(filename)
  const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','exports',code)(id=>{
    if(id in overrides)return overrides[id]
    if(id==='./public-fetch')return {publicFetch:(url,options)=>fetch(url,options),publicIntegration:()=>({})}
    if(id.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}
    if(id.startsWith('.')||id.startsWith('@/')){
      const base=id.startsWith('@/')?resolve(id.slice(2)):resolve(dirname(filename),id)
      for(const suffix of ['.ts','.tsx'])if(existsSync(base+suffix))return load(base+suffix,overrides)
    }
    return require(id)
  },exports)
  return exports
}

const {hasPredictionEnded,isPredictionDiscoverable,isPredictionAcceptingOrders,openPredictionItems,predictionEndAt}=load('lib/prediction-lifecycle.ts')
const {activeEventMarkets,eventMarkets}=load('lib/polymarket-data.ts')
const {polymarketDiscoveryItems,nextPolymarketDiscoveryOffset}=load('lib/polymarket-feed-discovery.ts')
const now=Date.parse('2026-10-04T08:00:00.000Z')
const past='2026-10-04T07:59:59.000Z',future='2026-10-04T08:00:01.000Z'
const child=(id,patch={})=>({id,question:`Option ${id}`,groupItemTitle:`Candidate ${id}`,active:true,closed:false,acceptingOrders:true,outcomes:['Yes','No'],outcomePrices:['0.6','0.4'],...patch})
const event=(id,patch={})=>({id,title:`Event ${id}`,active:true,closed:false,markets:[child(`${id}a`)],...patch})

test('an exact/past deadline ends purchase visibility even while provider closed=false',()=>{
  for(const endAt of [past,new Date(now).toISOString()]) {
    const market={endAt,active:true,closed:false,acceptingOrders:true}
    assert.equal(hasPredictionEnded(market,now),true)
    assert.equal(isPredictionDiscoverable(market,now),false)
    assert.equal(isPredictionAcceptingOrders(market,now),false)
  }
  assert.equal(hasPredictionEnded({endDate:future},now),false)
  assert.equal(hasPredictionEnded({endDate:future},now+1000),true)
})

test('unknown or malformed deadlines are not fabricated; explicit lifecycle flags remain authoritative',()=>{
  for(const endAt of [undefined,null,'','bad date'])assert.equal(isPredictionDiscoverable({endAt},now),true)
  assert.equal(predictionEndAt({endAt:'bad',endDate:future}),future)
  assert.equal(hasPredictionEnded({endDateIso:past},now),true)
  for(const patch of [{closed:true},{resolved:true},{archived:true},{active:false}])assert.equal(isPredictionDiscoverable({...patch,endAt:future},now),false)
  assert.equal(isPredictionDiscoverable({acceptingOrders:false,endAt:future},now),true)
  assert.equal(isPredictionAcceptingOrders({acceptingOrders:false,endAt:future},now),false)
})

test('discovery filters expired parent and child records without mutating historical source data',()=>{
  const mixed=event('mixed',{markets:[child('expired',{endDate:past}),child('live',{endDate:future}),child('unknown'),child('resolved',{resolved:true})]})
  assert.deepEqual(activeEventMarkets(mixed,now).map(m=>m.id),['live','unknown'])
  assert.deepEqual(eventMarkets(mixed).map(m=>m.id),['expired','live','unknown','resolved'])
  assert.deepEqual(activeEventMarkets({...mixed,endDate:past},now),[])
  assert.deepEqual(activeEventMarkets({...mixed,closed:true},now),[])
  const items=polymarketDiscoveryItems([event('past',{endDate:past}),mixed,event('future',{endDate:future})],'all',undefined,now)
  assert.deepEqual(items.map(item=>item.id),['event-mixed','event-future'])
  assert.deepEqual(items[0].marketIds,['live','unknown'])
  assert.equal(items[0].optionCount,2)
})

test('deduplication and expiry screening retain provider sort order, including equal-ranked records',()=>{
  const rows=[event('c'),event('a',{endDate:past}),event('b'),event('c'),event('d')]
  const items=polymarketDiscoveryItems(rows,'politics','c',now)
  assert.deepEqual(items.map(item=>item.id),['event-c','event-b','event-d'])
  assert.equal(items[0].featured,true)
  assert.deepEqual(openPredictionItems(items,now).map(item=>item.id),items.map(item=>item.id))
})

test('raw pagination consumes filtered records and keeps every valid result from expanded latest pages',()=>{
  const rows=Array.from({length:60},(_,index)=>event(String(index),index<5?{endDate:past}:{}))
  const items=polymarketDiscoveryItems(rows,'all',undefined,now)
  assert.equal(items.length,55)
  assert.equal(items.at(-1).id,'event-59')
  assert.equal(nextPolymarketDiscoveryOffset(0,60,60,100000),60)
  assert.equal(nextPolymarketDiscoveryOffset(60,60,60,100000),120)
  assert.equal(nextPolymarketDiscoveryOffset(0,20,20,100000),20)
  assert.equal(nextPolymarketDiscoveryOffset(60,59,60,100000),null)
  assert.equal(nextPolymarketDiscoveryOffset(99980,60,60,100000),null)
})

test('cached feed entries disappear at their deadline and paused records remain available to the gray-button UI',()=>{
  const records=[{id:'live',endAt:future},{id:'paused',endAt:null,acceptingOrders:false},{id:'expired',endAt:past},{id:'resolved',endAt:future,resolved:true}]
  assert.deepEqual(openPredictionItems(records,now).map(item=>item.id),['live','paused'])
  assert.deepEqual(openPredictionItems(records,now+1000).map(item=>item.id),['paused'])
  assert.equal(records.length,4)
})

test('loading the selected candidate uses the same compact Buy sheet before market data arrives',()=>{
  const stubComponent=({children})=>createElement('div',null,children)
  const react=load('components/maison/PredictionScreen.tsx',{
    '@/lib/i18n':{useI18n:()=>({locale:'zh-CN'})},
    '@/lib/api/_query':{useQuery:()=>({data:undefined,error:undefined,loading:true,refetch:async()=>{}}),invalidate:async()=>true},
    '@/lib/app-navigation':{usePageState:(_key,initial)=>[initial,()=>{}]},
    '@/lib/use-prediction-expiry-clock':{usePredictionExpiryClock:()=>now},
    '@/lib/use-prediction-directions':{useHideUnavailablePrediction:()=>[false,()=>{}]},
    '@/components/rwa-topbar':{__esModule:true,default:()=>null},
    './PredictionHowTo':{PredictionHowTo:()=>null},
    './PredictionEventScreen':{PredictionEventScreen:()=>null},
    './PredictionDiscussion':{PredictionDiscussion:()=>null},
    './PredictionBetForm':{PredictionBetForm:()=>null},
    './primitives':{MaisonPage:stubComponent,Skeleton:()=>createElement('div',{'data-skeleton':true}),Logo:()=>createElement('span',{'data-logo':true}),maison:new Proxy({},{get:(_,key)=>String(key)})},
    './PredictionSheet':{PredictionSheet:({title,compact,children})=>createElement('section',{'data-compact':compact},createElement('h2',null,title),children)},
  })
  const html=renderToStaticMarkup(createElement(react.PredictionMarketScreen,{id:'123',eventHeader:createElement('div',null,'Event'),ticketOpen:true,ticketLabel:'Candidate',ticketEventTitle:'Event title'}))
  assert.match(html,/data-compact="true"/)
  assert.match(html,/<h2>买入<\/h2>/)
  assert.match(html,/Candidate/)
  assert.doesNotMatch(html,/确认投注/)
})

const nextResponse={'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}}}
async function withFetch(mock,work) {
  const original=globalThis.fetch
  globalThis.fetch=mock
  try{return await work()}finally{globalThis.fetch=original}
}

test('feed route passes each sort to Gamma with the right direction and excludes lagging closed=false expiry',async()=>{
  const route=load('apps/api/src/polymarket/public/feed.ts',nextResponse)
  const expired=new Date(Date.now()-1000).toISOString(),open=new Date(Date.now()+60000).toISOString()
  for(const sort of ['volume24hr','volume','createdAt','endDate','liquidity']) {
    let query
    await withFetch(async url=>{query=new URL(String(url));return Response.json([event('expired',{endDate:expired}),event('open',{endDate:open})])},async()=>{
      const response=await route.GET(new Request(`https://rwa.lat/api/polymarket/feed?category=sports&sort=${sort}`))
      const page=await response.json()
      assert.equal(response.status,200)
      assert.deepEqual(page.items.map(item=>item.id),['event-open'])
      assert.equal(query.searchParams.get('order'),sort)
      assert.equal(query.searchParams.get('ascending'),String(sort==='endDate'))
      assert.equal(query.searchParams.get('tag_id'),'1')
    })
  }
})

test('feed route exposes a next page when this whole provider page is expired; expanded latest offsets do not skip a batch',async()=>{
  const route=load('apps/api/src/polymarket/public/feed.ts',nextResponse)
  const expired=new Date(Date.now()-1000).toISOString()
  await withFetch(async url=>{
    const query=new URL(String(url))
    const limit=Number(query.searchParams.get('limit'))
    const offset=Number(query.searchParams.get('offset'))
    return Response.json(Array.from({length:limit},(_,index)=>event(String(offset+index),{endDate:expired})))
  },async()=>{
    const first=await (await route.GET(new Request('https://rwa.lat/api/polymarket/feed?category=sports&sort=createdAt'))).json()
    assert.deepEqual(first.items,[])
    assert.equal(first.nextOffset,60)
    const second=await (await route.GET(new Request(`https://rwa.lat/api/polymarket/feed?category=sports&sort=createdAt&offset=${first.nextOffset}`))).json()
    assert.equal(second.nextOffset,120)
  })
})

test('market detail cannot accept an expired, resolved, or explicitly paused purchase; unknown end dates are preserved',async()=>{
  const route=load('apps/api/src/polymarket/public/market.ts',{...nextResponse,'@/lib/polymarket-server':{polymarketServerConfig:()=>({})}})
  const expired=new Date(Date.now()-1000).toISOString(),open=new Date(Date.now()+60000).toISOString()
  for(const [patch,expected] of [[{endDate:expired},false],[{endDate:open,resolved:true},false],[{acceptingOrders:false},false],[{endDate:'bad'},true],[{},true]]) {
    await withFetch(async()=>Response.json(child('123',patch)),async()=>{
      const response=await route.GET(new Request('https://rwa.lat/api/polymarket/market/123'),{params:Promise.resolve({id:'123'})})
      const payload=await response.json()
      assert.equal(response.status,200)
      assert.equal(payload.market.acceptingOrders,expected)
      if(patch.endDate==='bad')assert.equal(payload.market.endDate,null)
    })
  }
})

test('event route sends child deadlines to cached clients and selects only open default probability curves',async()=>{
  const route=load('apps/api/src/polymarket/public/event.ts',nextResponse)
  const expired=new Date(Date.now()-1000).toISOString(),open=new Date(Date.now()+60000).toISOString()
  const source=event('123',{markets:[child('expired',{endDate:expired}),child('open',{endDate:open}),child('resolved',{resolved:true}),child('unknown')]})
  await withFetch(async()=>Response.json(source),async()=>{
    const response=await route.GET(new Request('https://rwa.lat/api/polymarket/event/123'),{params:Promise.resolve({id:'123'})})
    const payload=await response.json()
    assert.equal(response.status,200)
    assert.equal(payload.markets.find(m=>m.id==='expired').endAt,expired)
    assert.equal(payload.markets.find(m=>m.id==='resolved').resolved,true)
    assert.deepEqual(payload.curves.map(curve=>curve.id),['open','unknown'])
    // Existing historical records are left intact; purchase components filter them.
    assert.equal(payload.markets.length,source.markets.length)
  })
})
