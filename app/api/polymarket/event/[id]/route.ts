import { NextResponse } from 'next/server'
import { eventMarkets, HISTORY_PERIODS, historyQuery, stringArray, type GammaEventData, type HistoryPeriod } from '@/lib/polymarket-data'
export const revalidate = 30
export async function GET(request:Request, context:{params:Promise<{id:string}>}) {
  const {id}=await context.params
  const url=new URL(request.url), period=url.searchParams.get('period')??'max'
  if (!/^\d+$/.test(id)||!HISTORY_PERIODS.includes(period as HistoryPeriod)) return NextResponse.json({error:'Invalid event'},{status:400})
  try {
    const r=await fetch(`https://gamma-api.polymarket.com/events/${id}`,{headers:{accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'},next:{revalidate},signal:AbortSignal.timeout(8000)})
    if(!r.ok) throw new Error('Unavailable')
    const event=await r.json() as GammaEventData
    const markets=eventMarkets(event).map(m=>({id:m.id!,question:m.question!,label:m.groupItemTitle||m.question!,image:m.image??null,prices:stringArray(m.outcomePrices).map(Number),tokenIds:stringArray(m.clobTokenIds),closed:Boolean(m.closed),volume:Number(m.volume)||0,endAt:m.endDate??null}))
    const chosen=(url.searchParams.get('markets')??'').split(',').filter(Boolean)
    const chartMarkets=chosen.length ? markets.filter(m=>chosen.includes(m.id)).slice(0,4) : markets.filter(m=>!m.closed).sort((a,b)=>(b.prices[0]??0)-(a.prices[0]??0)).slice(0,4)
    const curves=await Promise.all(chartMarkets.map(async m=>{
      try {
        if(!m.tokenIds[0]) throw new Error('No token')
        const h=await fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(m.tokenIds[0])}&${historyQuery(period as HistoryPeriod)}`,{headers:{accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'},next:{revalidate},signal:AbortSignal.timeout(8000)})
        if(!h.ok) throw new Error('No history')
        const rows=await h.json() as {history?:Array<{t:number;p:number}>}
        return {id:m.id,label:m.label,available:true,points:(rows.history??[]).filter(x=>Number.isFinite(x.t)&&x.t>0&&Number.isFinite(x.p)&&x.p>=0&&x.p<=1).map(x=>({time:x.t,price:x.p})).sort((a,b)=>a.time-b.time)}
      }catch{return {id:m.id,label:m.label,available:false,points:[]}}
    }))
    return NextResponse.json({id:event.id??id,title:event.title??'',description:event.description??'',image:event.image??null,volume:Number(event.volume)||0,endAt:event.endDate??null,markets,curves,fetchedAt:new Date().toISOString()})
  }catch{return NextResponse.json({error:'Event data unavailable'},{status:502})}
}
