import {activeEventMarkets, stringArray, type GammaEventData} from './polymarket-data'
import {predictionEndAt} from './prediction-lifecycle'
import {POLYMARKET_CATEGORY_TAGS, type PolymarketCategory, type PolymarketFeedMarket, type PolymarketStatus} from './feed-types'

/** Retain upstream order; active discovery excludes expired children, closed history retains them. */
export function polymarketDiscoveryItems(events: readonly GammaEventData[], category: PolymarketCategory, featuredId?: string, now=Date.now(), status: PolymarketStatus = 'active'): PolymarketFeedMarket[] {
  const seen=new Set<string>()
  const items:PolymarketFeedMarket[]=[]
  for(const event of events) {
    if(!event.id || !event.title || seen.has(event.id)) continue
    seen.add(event.id)
    const markets = status === 'resolved'
      ? (event.closed ? (event.markets ?? []).filter(market => market.id && market.question
        && (market.closed || market.resolved) && stringArray(market.outcomes).length >= 2) : [])
      : activeEventMarkets(event,now)
    if(!markets.length) continue
    const binary=markets.length===1
    const outcomes=binary
      ? stringArray(markets[0].outcomes).map((label,index)=>({label,impliedProbability:Number(stringArray(markets[0].outcomePrices)[index])}))
      : markets.slice(0,4).map(market=>({label:market.groupItemTitle||market.question!,impliedProbability:Number(stringArray(market.outcomePrices)[0])}))
    const actualCategory=category==='all'
      ? (Object.entries(POLYMARKET_CATEGORY_TAGS).find(([,tag])=>event.tags?.some(item=>Number(item.id)===tag))?.[0]??'all') as PolymarketCategory
      : category
    items.push({id:`event-${event.id}`,conditionId:binary?markets[0].conditionId??null:null,question:event.title,category:actualCategory,outcomes:outcomes.filter(outcome=>Number.isFinite(outcome.impliedProbability)),volume24hUsd:Number(event.volume24hr)||0,endAt:predictionEndAt(event),marketIds:markets.map(market=>market.id!),optionCount:markets.length,featured:featuredId===event.id,image:event.image??null,
      ...(status === 'resolved' ? { closed: true, resolved: event.resolved === true || markets.every(market => market.resolved === true), active: false } : {}),
    })
  }
  return items
}

/** Offset counts provider records consumed, including filtered records, so no page repeats or skips. */
export function nextPolymarketDiscoveryOffset(offset:number, count:number, limit:number, maxOffset:number):number|null {
  return count===limit && offset+limit<=maxOffset ? offset+limit : null
}
