import {activeEventMarkets, stringArray, type GammaEventData} from './polymarket-data'
import {predictionEndAt} from './prediction-lifecycle'
import {POLYMARKET_CATEGORY_TAGS, type PolymarketCategory, type PolymarketFeedMarket} from './feed-types'

/** Deduplicate while retaining upstream order; expired children never become purchase entries. */
export function polymarketDiscoveryItems(events: readonly GammaEventData[], category: PolymarketCategory, featuredId?: string, now=Date.now()): PolymarketFeedMarket[] {
  const seen=new Set<string>()
  const items:PolymarketFeedMarket[]=[]
  for(const event of events) {
    if(!event.id || !event.title || seen.has(event.id)) continue
    seen.add(event.id)
    const markets=activeEventMarkets(event,now)
    if(!markets.length) continue
    const binary=markets.length===1
    const outcomes=binary
      ? stringArray(markets[0].outcomes).map((label,index)=>({label,impliedProbability:Number(stringArray(markets[0].outcomePrices)[index])}))
      : markets.slice(0,4).map(market=>({label:market.groupItemTitle||market.question!,impliedProbability:Number(stringArray(market.outcomePrices)[0])}))
    const actualCategory=category==='all'
      ? (Object.entries(POLYMARKET_CATEGORY_TAGS).find(([,tag])=>event.tags?.some(item=>Number(item.id)===tag))?.[0]??'all') as PolymarketCategory
      : category
    items.push({id:`event-${event.id}`,conditionId:binary?markets[0].conditionId??null:null,question:event.title,category:actualCategory,outcomes:outcomes.filter(outcome=>Number.isFinite(outcome.impliedProbability)),volume24hUsd:Number(event.volume24hr)||0,endAt:predictionEndAt(event),marketIds:markets.map(market=>market.id!),optionCount:markets.length,featured:featuredId===event.id,image:event.image??null})
  }
  return items
}

/** Offset counts provider records consumed, including filtered records, so no page repeats or skips. */
export function nextPolymarketDiscoveryOffset(offset:number, count:number, limit:number, maxOffset:number):number|null {
  return count===limit && offset+limit<=maxOffset ? offset+limit : null
}
