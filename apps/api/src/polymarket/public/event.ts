import {publicFetch} from './public-fetch'
import { eventMarkets, HISTORY_PERIODS, historyQuery, stringArray, type GammaEventData, type HistoryPeriod } from './polymarket-data'
import {isPredictionDiscoverable,predictionEndAt} from './prediction-lifecycle'
export const revalidate = 30
const GAMMA_HEADERS={accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'}
// Umbrella tags match half the catalogue; related events key off the first specific one.
const BROAD_TAGS=new Set(['all','featured','recurring','hide-from-new','politics','sports','crypto','pop-culture','business','science','world','elections','global-elections','economy','tech','culture'])
type EventTag={id:string;slug:string;label:string}
function eventTags(event:GammaEventData):EventTag[] {
  return (event.tags??[]).filter(t=>t.id&&t.label&&!t.forceHide).map(t=>({id:String(t.id),slug:t.slug??'',label:t.label!})).slice(0,6)
}
async function relatedEvents(event:GammaEventData,tags:EventTag[],now:number) {
  const tag=tags.find(t=>!BROAD_TAGS.has(t.slug))??tags[0]
  if(!tag||!/^\d{1,20}$/.test(tag.id)) return []
  try {
    const r=await publicFetch(`https://gamma-api.polymarket.com/events?tag_id=${tag.id}&active=true&closed=false&archived=false&order=volume24hr&ascending=false&limit=12`,{headers:GAMMA_HEADERS,next:{revalidate:300},signal:AbortSignal.timeout(6000)})
    if(!r.ok) return []
    const rows=await r.json() as GammaEventData[]
    return (Array.isArray(rows)?rows:[]).filter(e=>e.id&&e.title&&String(e.id)!==String(event.id)&&isPredictionDiscoverable(e,now)).slice(0,5).map(e=>{
      const lead=eventMarkets(e).filter(m=>!m.closed).map(m=>({label:m.groupItemTitle||m.question!,price:Number(stringArray(m.outcomePrices)[0])})).filter(m=>Number.isFinite(m.price)).sort((a,b)=>b.price-a.price)[0]
      return {id:String(e.id),title:e.title!,image:e.image??null,volume:Number(e.volume)||0,leadLabel:lead?.label??null,leadPrice:lead?.price??null}
    })
  }catch{return []}
}
export async function GET(request:Request, context:{params:Promise<{id:string}>}) {
  const {id}=await context.params
  const url=new URL(request.url), period=url.searchParams.get('period')??'max'
  const chosen=(url.searchParams.get('markets')??'').split(',').filter(Boolean)
  if (!/^\d{1,20}$/.test(id)||!HISTORY_PERIODS.includes(period as HistoryPeriod)||chosen.length>4||chosen.some(value=>!/^\d{1,20}$/.test(value))) return Response.json({error:'Invalid event'},{status:400})
  try {
    const r=await publicFetch(`https://gamma-api.polymarket.com/events/${id}`,{headers:GAMMA_HEADERS,next:{revalidate},signal:AbortSignal.timeout(8000)})
    if(!r.ok) throw new Error('Unavailable')
    const event=await r.json() as GammaEventData
    const now=Date.now()
    const tags=eventTags(event)
    // Related events only ride on the baseline request; chart range/curve switches skip the extra Gamma call.
    const related=period==='max'&&!chosen.length?relatedEvents(event,tags,now):Promise.resolve(undefined)
    const markets=eventMarkets(event).map(m=>({id:m.id!,question:m.question!,label:m.groupItemTitle||m.question!,image:m.image??null,prices:stringArray(m.outcomePrices).map(Number),tokenIds:stringArray(m.clobTokenIds),closed:Boolean(m.closed),resolved:Boolean(m.resolved),active:m.active,acceptingOrders:typeof m.acceptingOrders==='boolean'?m.acceptingOrders:undefined,volume:Number(m.volume)||0,volume24h:Number(m.volume24hr)||0,liquidity:m.liquidity==null||!Number.isFinite(Number(m.liquidity))?null:Number(m.liquidity),endAt:predictionEndAt(m)}))
    const chartMarkets=chosen.length ? markets.filter(m=>chosen.includes(m.id)).slice(0,4) : markets.filter(m=>isPredictionDiscoverable(m,now)).sort((a,b)=>(b.prices[0]??0)-(a.prices[0]??0)).slice(0,4)
    const curves=await Promise.all(chartMarkets.map(async m=>{
      try {
        if(!m.tokenIds[0]) throw new Error('No token')
        const h=await publicFetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(m.tokenIds[0])}&${historyQuery(period as HistoryPeriod)}`,{headers:GAMMA_HEADERS,next:{revalidate},signal:AbortSignal.timeout(8000)})
        if(!h.ok) throw new Error('No history')
        const rows=await h.json() as {history?:Array<{t:number;p:number}>}
        return {id:m.id,label:m.label,available:true,points:(rows.history??[]).filter(x=>Number.isFinite(x.t)&&x.t>0&&Number.isFinite(x.p)&&x.p>=0&&x.p<=1).map(x=>({time:x.t,price:x.p})).sort((a,b)=>a.time-b.time)}
      }catch{return {id:m.id,label:m.label,available:false,points:[]}}
    }))
    const startAt=event.startDate&&Number.isFinite(Date.parse(event.startDate))?event.startDate:null
    return Response.json({id:event.id??id,title:event.title??'',description:event.description??'',image:event.image??null,volume:Number(event.volume)||0,volume24h:Number(event.volume24hr)||0,liquidity:Number(event.liquidity)||0,tags:tags.map(({id,label})=>({id,label})),related:await related,startAt,endAt:predictionEndAt(event),closed:Boolean(event.closed),resolved:Boolean(event.resolved),active:event.active,archived:event.archived,markets,curves,fetchedAt:new Date().toISOString()})
  }catch{return Response.json({error:'Event data unavailable'},{status:502})}
}
