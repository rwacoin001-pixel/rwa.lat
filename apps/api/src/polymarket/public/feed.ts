import {publicFetch} from './public-fetch'
import { activeEventMarkets, type GammaEventData } from './polymarket-data'
import { POLYMARKET_CATEGORIES, POLYMARKET_CATEGORY_TAGS, POLYMARKET_SORTS, type PolymarketCategory } from './feed-types'
import {polymarketDiscoveryItems,nextPolymarketDiscoveryOffset} from './polymarket-feed-discovery'

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
    return Response.json({ error: 'Invalid feed parameters' }, { status: 400 })
  }

  const category = rawCategory as PolymarketCategory
  // Latest fetches more records to screen out short crypto intervals. The cursor
  // advances by records consumed; emit every remaining valid record from that page.
  const filterMicro = sort === 'createdAt' && !search
  const upstreamLimit = filterMicro ? PAGE_SIZE * 3 : PAGE_SIZE
  const upstreamOffset = rawOffset
  const query = new URLSearchParams({ active: 'true', closed: 'false', limit: String(upstreamLimit), offset: String(upstreamOffset), order: sort, ascending: String(sort==='endDate') })
  if (category !== 'all') query.set('tag_id', String(POLYMARKET_CATEGORY_TAGS[category]))

  if(sort==='endDate')query.set('end_date_min',new Date().toISOString())
  if(search)query.set('title_search',search)
  try {
    const upstream = await publicFetch(`https://gamma-api.polymarket.com/events?${query}`, { headers: {accept:'application/json','user-agent':'A-REIT/0.1 market-data'}, next: { revalidate }, signal: AbortSignal.timeout(8_000) })
    if (!upstream.ok) throw new Error('Gamma unavailable')
    const rows: unknown = await upstream.json()
    if (!Array.isArray(rows)) throw new Error('Invalid Gamma response')
    const now=Date.now()
    // 动态榜位：这里原来写死了 'which-party-will-win-the-senate/house-in-2026' 两个 slug，
    // 首页顶部因此永远不变（用户反馈"刷新一直是一样的盘口"）。改成从「24h 成交量前 8 的
    // 非微盘」里按小时轮换取 2 个：保证非空、保证质量，而且每小时都会换。
    const featured: GammaEventData[] = []
    if (!search && sort==='volume24hr' && rawOffset===0 && (category==='all'||category==='politics')) {
      const clean=(rows as GammaEventData[]).filter(event=>activeEventMarkets(event,now).length>0&&!isMicro(event)).slice(0,8)
      if(clean.length){const slot=Math.floor(now/3_600_000)%clean.length;featured.push(clean[slot]);if(clean.length>1)featured.push(clean[(slot+1)%clean.length])}
    }
    let pulse:GammaEventData|null=null
    const pulseStart=Math.floor(Date.now()/300000)*300
    if(!search&&sort==='volume24hr'&&rawOffset===0&&(category==='all'||category==='crypto')) {
      try {const slug=`btc-updown-5m-${pulseStart}`;const response=await publicFetch(`https://gamma-api.polymarket.com/events/slug/${slug}`,{next:{revalidate:8},signal:AbortSignal.timeout(5000)});if(response.ok)pulse=await response.json() as GammaEventData}catch{}
    }
    const upstreamRows = (rows as GammaEventData[]).filter(event => !filterMicro || !isMicro(event))
    const candidates=[featured[0],pulse,...featured.slice(1),...upstreamRows].filter((event):event is GammaEventData=>Boolean(event))
    const round={start:new Date(pulseStart*1000).toISOString(),end:new Date((pulseStart+300)*1000).toISOString()}
    const items=polymarketDiscoveryItems(candidates,category,featured[0]?.id,Date.now())
      // The feed hides items whose endAt has passed, so the round card disappears when its 5 minutes are up.
      .map(item=>pulse&&item.id===`event-${pulse.id}`?{...item,window:round,endAt:round.end}:item)
    return Response.json({
      source: 'polymarket-gamma' as const,
      fetchedAt: new Date().toISOString(),
      items,
      nextOffset: nextPolymarketDiscoveryOffset(rawOffset,rows.length,upstreamLimit,MAX_OFFSET),
    })
  } catch {
    return Response.json({ error: 'Market data unavailable' }, { status: 502 })
  }
}
