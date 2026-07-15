import { NextResponse } from 'next/server'
import { polymarketServerConfig } from '@/lib/polymarket-server'

export const revalidate = 15

type GammaMarket = {
  id?: string
  question?: string
  description?: string
  outcomes?: string | string[]
  outcomePrices?: string | string[]
  clobTokenIds?: string | string[]
  volume?: string | number
  volume24hr?: string | number
  liquidity?: string | number
  endDate?: string
  endDateIso?: string
  category?: string
  acceptingOrders?: boolean
}

type BookLevel = { price?: string; size?: string }
type ClobBook = { bids?: BookLevel[]; asks?: BookLevel[]; tick_size?: string; min_order_size?: string }
type PriceHistory = { history?: Array<{ t?: number; p?: number }> }

function arrayValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] }
}

function numberValue(value: string | number | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const integration = polymarketServerConfig()
  try {
    const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets/${encodeURIComponent(id)}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) })
    if (!marketResponse.ok) throw new Error(`Gamma response ${marketResponse.status}`)
    const market = await marketResponse.json() as GammaMarket
    const tokenIds = arrayValue(market.clobTokenIds)
    const tokenId = tokenIds[0]
    const [bookResponse, midpointResponse, spreadResponse, historyResponse] = tokenId ? await Promise.all([
      fetch(`https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) }),
      fetch(`https://clob.polymarket.com/midpoint?token_id=${encodeURIComponent(tokenId)}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) }),
      fetch(`https://clob.polymarket.com/spread?token_id=${encodeURIComponent(tokenId)}`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) }),
      fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=max&fidelity=60`, { next: { revalidate }, signal: AbortSignal.timeout(8_000) }),
    ]) : [null, null, null, null]
    const book = bookResponse?.ok ? await bookResponse.json() as ClobBook : null
    const midpoint = midpointResponse?.ok ? await midpointResponse.json() as { mid?: string } : null
    const spread = spreadResponse?.ok ? await spreadResponse.json() as { spread?: string } : null
    const history = historyResponse?.ok ? await historyResponse.json() as PriceHistory : null
    return NextResponse.json({
      source: 'polymarket-gamma-clob',
      fetchedAt: new Date().toISOString(),
      integration,
      market: {
        id: market.id ?? id,
        question: market.question ?? 'Untitled market',
        description: market.description ?? '',
        category: market.category ?? 'Markets',
        outcomes: arrayValue(market.outcomes),
        prices: arrayValue(market.outcomePrices).map(numberValue),
        tokenIds,
        volume: numberValue(market.volume),
        volume24h: numberValue(market.volume24hr),
        liquidity: numberValue(market.liquidity),
        endDate: market.endDateIso ?? market.endDate ?? null,
        acceptingOrders: Boolean(market.acceptingOrders),
      },
      orderbook: book ? {
        bids: (book.bids ?? []).slice(0, 12).map((level) => ({ price: numberValue(level.price), size: numberValue(level.size) })),
        asks: (book.asks ?? []).slice(0, 12).map((level) => ({ price: numberValue(level.price), size: numberValue(level.size) })),
        tickSize: numberValue(book.tick_size),
        minimumOrderSize: numberValue(book.min_order_size),
      } : null,
      pricing: {
        midpoint: numberValue(midpoint?.mid),
        spread: numberValue(spread?.spread),
        history: (history?.history ?? []).slice(-96).map((point) => ({ time: numberValue(point.t), price: numberValue(point.p) })),
      },
    })
  } catch (error) {
    return NextResponse.json({ source: 'unavailable', integration, error: error instanceof Error ? error.message : 'Market unavailable' }, { status: 502 })
  }
}
