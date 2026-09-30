import { NextResponse } from 'next/server'
import { POLYMARKET_CATEGORIES, POLYMARKET_CATEGORY_TAGS, type PolymarketCategory, type PolymarketFeedMarket } from '@/lib/api/polymarket-feed'

export const revalidate = 30

const PAGE_SIZE = 20
const MAX_OFFSET = 100_000

type GammaMarket = {
  id?: string
  question?: string
  active?: boolean
  closed?: boolean
  archived?: boolean
  outcomes?: string | string[]
  outcomePrices?: string | string[]
  volume24hr?: string | number
  endDate?: string
}

function stringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

function toMarket(row: GammaMarket, category: PolymarketCategory, now: number): PolymarketFeedMarket | null {
  if (!row.id || !row.question || row.active !== true || row.closed || row.archived) return null
  if (row.endDate && Number.isFinite(Date.parse(row.endDate)) && Date.parse(row.endDate) < now) return null
  const labels = stringArray(row.outcomes)
  const prices = stringArray(row.outcomePrices).map(Number)
  if (labels.length !== 2 || prices.length !== 2 || prices.some((price) => !Number.isFinite(price) || price < 0 || price > 1)) return null
  const volume = Number(row.volume24hr)
  return {
    id: row.id,
    question: row.question,
    category,
    outcomes: labels.map((label, index) => ({ label, impliedProbability: prices[index] })),
    volume24hUsd: Number.isFinite(volume) && volume >= 0 ? volume : null,
    endAt: row.endDate ?? null,
  }
}

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
    const upstream = await fetch(`https://gamma-api.polymarket.com/markets?${query}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) })
    if (!upstream.ok) throw new Error('Gamma unavailable')
    const rows: unknown = await upstream.json()
    if (!Array.isArray(rows)) throw new Error('Invalid Gamma response')
    const now = Date.now()
    const items = rows.flatMap((row) => {
      const market = toMarket(row as GammaMarket, category, now)
      return market ? [market] : []
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
