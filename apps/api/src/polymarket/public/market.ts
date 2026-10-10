import {publicFetch} from './public-fetch'
import {publicIntegration} from './public-fetch'
import { stringArray, HISTORY_PERIODS, historyQuery, type HistoryPeriod, type GammaMarketData } from './polymarket-data'
import {isPredictionAcceptingOrders,predictionEndAt} from './prediction-lifecycle'
export const revalidate = 15
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0
type Book = { timestamp?: string; asset_id?: string; bids?: Array<{price:string;size:string}>; asks?: Array<{price:string;size:string}>; tick_size?: string; min_order_size?: string }
export async function GET(request: Request, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params
  const period = new URL(request.url).searchParams.get('period') ?? 'max'
  if (!/^\d{1,20}$/.test(id) || !HISTORY_PERIODS.includes(period as HistoryPeriod)) return Response.json({error:'Invalid market parameters'},{status:400})
  const fresh = new URL(request.url).searchParams.get('refresh') === '1'
  const bookCache = fresh ? {cache: 'no-store' as const} : {next:{revalidate}}
  const integration = publicIntegration()
  try {
    const response = await publicFetch(`https://gamma-api.polymarket.com/markets/${id}`,{headers:{accept:'application/json','user-agent':'A-REIT/0.1 market-data'},...bookCache,signal:AbortSignal.timeout(8000)})
    if (!response.ok) throw new Error('Unavailable')
    const market = await response.json() as GammaMarketData
    const tokenIds = stringArray(market.clobTokenIds)
    const outcomeBooks = await Promise.all(tokenIds.slice(0,2).map(async tokenId => {
      try {
        const r = await publicFetch(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`,{headers:{accept:'application/json','user-agent':'A-REIT/0.1 market-data'},...bookCache,signal:AbortSignal.timeout(8000)})
        if (!r.ok) return null
        const b = await r.json() as Book
        if (b.asset_id && b.asset_id !== tokenId) return null
        const timestamp = Number(b.timestamp)
        const asOf = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000)
        if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(asOf.getTime())) return null
        const levels = (v: Book['asks']) => (v??[]).map(x=>({price:n(x.price),size:n(x.size)})).filter(x=>x.price>0&&x.price<1&&x.size>0)
        return {tokenId,asOf:asOf.toISOString(),fetchedAt:new Date().toISOString(),bids:levels(b.bids).sort((a,b)=>b.price-a.price),asks:levels(b.asks).sort((a,b)=>a.price-b.price),tickSize:n(b.tick_size),minimumOrderSize:n(b.min_order_size)}
      } catch {return null}
    }))
    let history: Array<{time:number;price:number}> = []
    try {
      if (tokenIds[0]) {
        const r = await publicFetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenIds[0])}&${historyQuery(period as HistoryPeriod)}`,{headers:{accept:'application/json','user-agent':'A-REIT/0.1 market-data'},next:{revalidate},signal:AbortSignal.timeout(8000)})
        if (r.ok) {const h = await r.json() as {history?:Array<{t:number;p:number}>}; history=(h.history??[]).filter(x=>Number.isFinite(x.t)&&x.t>0&&Number.isFinite(x.p)&&x.p>=0&&x.p<=1).map(x=>({time:x.t,price:x.p})).sort((a,b)=>a.time-b.time)}
      }
    } catch {/* Never fabricate missing price points. */}
    const first=outcomeBooks[0]??null
    return Response.json({source:'polymarket-gamma-clob',fetchedAt:new Date().toISOString(),integration,market:{id:market.id??id,eventId:market.events?.[0]?.id??null,question:market.question??'',description:market.description??'',category:market.category??'Markets',outcomes:stringArray(market.outcomes),prices:stringArray(market.outcomePrices).map(Number),tokenIds,volume:n(market.volume),volume24h:n(market.volume24hr),liquidity:n(market.liquidity),endDate:predictionEndAt(market),closed:Boolean(market.closed),resolved:Boolean(market.resolved),active:market.active,archived:market.archived,acceptingOrders:market.acceptingOrders===true&&isPredictionAcceptingOrders(market)},outcomeBooks,orderbook:first,pricing:{midpoint:first?.asks[0]?.price??0,spread:first?.asks[0]&&first?.bids[0]?first.asks[0].price-first.bids[0].price:0,history}})
  } catch {return Response.json({source:'unavailable',integration,error:'Market details unavailable'},{status:502})}
}
