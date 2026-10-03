import { NextResponse } from 'next/server'
import { activeEventMarkets, stringArray as eventArray, type GammaEventData } from '@/lib/polymarket-data'
import { POLYMARKET_CATEGORIES, POLYMARKET_CATEGORY_TAGS, POLYMARKET_SORTS, type PolymarketCategory, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'

export const revalidate = 10

const PAGE_SIZE = 20
const MAX_OFFSET = 100_000
/** Gamma 的 `createdAt` / `competitive` / `startDate` 排序清一色是「某币 5 分钟涨跌」微盘
 *  （实测 8/8）。用户想看到"每次刷新不一样"，但不能被这类噪音刷屏，所以最新排序下
 *  剔除它们。同时用于挑选动态榜位。 */
const MICRO_RE = / Up or Down - /i
const isMicro = (event: GammaEventData) => MICRO_RE.test(event.title ?? '')

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawCategory = url.searchParams.get('category') ?? 'all'
  const sort=url.searchParams.get('sort')??'volume24hr'
  const search=(url.searchParams.get('q')??'').trim()
  const rawOffset = Number(url.searchParams.get('offset') ?? '0')
  if (!(POLYMARKET_CATEGORIES as readonly string[]).includes(rawCategory)
    || !(POLYMARKET_SORTS as readonly string[]).includes(sort) || search.length>120
    || !Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > MAX_OFFSET || rawOffset % PAGE_SIZE !== 0) {
    return NextResponse.json({ error: 'Invalid feed parameters' }, { status: 400 })
  }

  const category = rawCategory as PolymarketCategory
  // 「最新」排序上游几乎全是 5 分钟加密微盘，所以多取 3 倍再过滤，保证用户能刷到
  // 新的、有意义的盘而不是噪音。分页按原始 offset 递进，避免重复。
  const filterMicro = sort === 'createdAt' && !search
  const upstreamLimit = filterMicro ? PAGE_SIZE * 3 : PAGE_SIZE
  const upstreamOffset = filterMicro ? rawOffset * 3 : rawOffset
  const query = new URLSearchParams({ active: 'true', closed: 'false', limit: String(upstreamLimit), offset: String(upstreamOffset), order: sort, ascending: String(sort==='endDate') })
  if (category !== 'all') query.set('tag_id', String(POLYMARKET_CATEGORY_TAGS[category]))

  if(sort==='endDate')query.set('end_date_min',new Date().toISOString())
  if(search)query.set('title_search',search)
  try {
    const upstream = await fetch(`https://gamma-api.polymarket.com/events?${query}`, { headers: {accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'}, next: { revalidate }, signal: AbortSignal.timeout(8_000) })
    if (!upstream.ok) throw new Error('Gamma unavailable')
    const rows: unknown = await upstream.json()
    if (!Array.isArray(rows)) throw new Error('Invalid Gamma response')
    // 动态榜位：这里原来写死了 'which-party-will-win-the-senate/house-in-2026' 两个 slug，
    // 首页顶部因此永远不变（用户反馈"刷新一直是一样的盘口"）。改成从「24h 成交量前 8 的
    // 非微盘」里按小时轮换取 2 个：保证非空、保证质量，而且每小时都会换。
    const featured: GammaEventData[] = !search && sort==='volume24hr' && rawOffset === 0 && (category === 'all' || category === 'politics') ? await (async () => {
      try {
        const response = await fetch('https://gamma-api.polymarket.com/events?active=true&closed=false&limit=40&order=volume24hr&ascending=false', { headers: {accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'}, next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) })
        if (!response.ok) return []
        const pool: unknown = await response.json()
        const clean = (Array.isArray(pool) ? pool as GammaEventData[] : [])
          .filter(event => !event.closed && !event.archived && !isMicro(event))
          .slice(0, 8)
        if (!clean.length) return []
        const slot = Math.floor(Date.now() / 3_600_000) % clean.length
        return [clean[slot], clean[(slot + 1) % clean.length]].filter(Boolean)
      } catch { return [] }
    })() : []
    let pulse:GammaEventData|null=null
    if(!search&&sort==='volume24hr'&&rawOffset===0&&(category==='all'||category==='crypto')) {
      try {const slug=`btc-updown-5m-${Math.floor(Date.now()/300000)*300}`;const response=await fetch(`https://gamma-api.polymarket.com/events/slug/${slug}`,{next:{revalidate:8},signal:AbortSignal.timeout(5000)});if(response.ok)pulse=await response.json() as GammaEventData}catch{}
    }
    const seen = new Set<string>()
    // 「最新」排序：先剔除 5 分钟加密微盘，再取前 20 条，剩下的位置由榜位补足。
    const upstreamRows = (rows as GammaEventData[]).filter(event => !filterMicro || !isMicro(event)).slice(0, PAGE_SIZE)
    const items = [featured[0],pulse,...featured.slice(1),...upstreamRows].filter((event):event is GammaEventData=>Boolean(event)).filter(event=>{if(!event.id||seen.has(event.id))return false;seen.add(event.id);return true}).flatMap(event => {
      const markets = activeEventMarkets(event)
      if (!event.id || !event.title || event.closed || event.archived || !markets.length) return []
      const binary = markets.length === 1
      const outcomes = binary ? eventArray(markets[0].outcomes).map((label,index) => ({label,impliedProbability:Number(eventArray(markets[0].outcomePrices)[index])})) : markets.slice(0,4).map(m=>({label:m.groupItemTitle||m.question!,impliedProbability:Number(eventArray(m.outcomePrices)[0])}))
      const actualCategory=category==='all'?(Object.entries(POLYMARKET_CATEGORY_TAGS).find(([,tag])=>event.tags?.some(t=>Number(t.id)===tag))?.[0]??'all') as PolymarketCategory:category
      return [{id:`event-${event.id}`,conditionId:binary?markets[0].conditionId??null:null,question:event.title,category:actualCategory,outcomes:outcomes.filter(x=>Number.isFinite(x.impliedProbability)),volume24hUsd:Number(event.volume24hr)||0,endAt:event.endDate??null,marketIds:markets.map(m=>m.id!),optionCount:markets.length,featured:featured[0]?.id===event.id,image:event.image??null}]
    })
    return NextResponse.json({
      source: 'polymarket-gamma' as const,
      fetchedAt: new Date().toISOString(),
      items,
      nextOffset: (rows as GammaEventData[]).length === upstreamLimit && rawOffset + PAGE_SIZE <= MAX_OFFSET ? rawOffset + PAGE_SIZE : null,
    })
  } catch {
    return NextResponse.json({ error: 'Market data unavailable' }, { status: 502 })
  }
}
