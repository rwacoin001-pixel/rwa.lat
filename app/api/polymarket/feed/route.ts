import { NextResponse } from 'next/server'
import { activeEventMarkets, stringArray as eventArray, type GammaEventData } from '@/lib/polymarket-data'
import { POLYMARKET_CATEGORIES, POLYMARKET_CATEGORY_TAGS, type PolymarketCategory, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'

export const revalidate = 30

const PAGE_SIZE = 20
const MAX_OFFSET = 100_000

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawCategory = url.searchParams.get('category') ?? 'all'
  const rawOffset = Number(url.searchParams.get('offset') ?? '0')
  if (!(POLYMARKET_CATEGORIES as readonly string[]).includes(rawCategory)
    || !Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > MAX_OFFSET || rawOffset % PAGE_SIZE !== 0) {
    return NextResponse.json({ error: 'Invalid feed parameters' }, { status: 400 })
  }

  const category = rawCategory as PolymarketCategory
  const query = new URLSearchParams({ active: 'true', closed: 'false', limit: String(PAGE_SIZE), offset: String(rawOffset), order: 'volume24hr', ascending: 'false' })
  if (category !== 'all') query.set('tag_id', String(POLYMARKET_CATEGORY_TAGS[category]))

  try {
    const upstream = await fetch(`https://gamma-api.polymarket.com/events?${query}`, { headers: {accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'}, next: { revalidate }, signal: AbortSignal.timeout(8_000) })
    if (!upstream.ok) throw new Error('Gamma unavailable')
    const rows: unknown = await upstream.json()
    if (!Array.isArray(rows)) throw new Error('Invalid Gamma response')
    const featured: GammaEventData[] = rawOffset === 0 && (category === 'all' || category === 'politics') ? (await Promise.all([
      'which-party-will-win-the-senate-in-2026','which-party-will-win-the-house-in-2026',
    ].map(async slug => {
      try {const response=await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`,{headers:{accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'},next:{revalidate:300},signal:AbortSignal.timeout(5000)});return response.ok?await response.json() as GammaEventData:null}catch{return null}
    }))).filter((event):event is GammaEventData=>event!==null) : []
    const seen = new Set<string>()
    const items = [...featured,...rows as GammaEventData[]].filter(event=>{if(!event.id||seen.has(event.id))return false;seen.add(event.id);return true}).flatMap(event => {
      const markets = activeEventMarkets(event)
      if (!event.id || !event.title || event.closed || event.archived || !markets.length) return []
      const binary = markets.length === 1
      const outcomes = binary ? eventArray(markets[0].outcomes).map((label,index) => ({label,impliedProbability:Number(eventArray(markets[0].outcomePrices)[index])})) : markets.slice(0,4).map(m=>({label:m.groupItemTitle||m.question!,impliedProbability:Number(eventArray(m.outcomePrices)[0])}))
      return [{id:`event-${event.id}`,question:event.title,category,outcomes:outcomes.filter(x=>Number.isFinite(x.impliedProbability)),volume24hUsd:Number(event.volume24hr)||0,endAt:event.endDate??null,marketIds:markets.map(m=>m.id!),optionCount:markets.length,featured:featured.some(f=>f.id===event.id),image:event.image??null}]
    })
    return NextResponse.json({
      source: 'polymarket-gamma' as const,
      fetchedAt: new Date().toISOString(),
      items,
      nextOffset: rows.length === PAGE_SIZE && rawOffset + PAGE_SIZE <= MAX_OFFSET ? rawOffset + PAGE_SIZE : null,
    })
  } catch {
    return NextResponse.json({ error: 'Market data unavailable' }, { status: 502 })
  }
}
