import { NextResponse } from 'next/server'
import { polymarketServerConfig } from '@/lib/polymarket-server'

export const revalidate = 60
export const dynamic = 'force-dynamic'
const CORE_API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '')

export async function GET() {
  const integration = polymarketServerConfig()
  try {
    // 数据源：核心 API（服务器侧已同步 Polymarket Gamma/CLOB，穿透本机网络限制）
    const response = await fetch(`${CORE_API}/v1/polymarket/markets?limit=50`, {
      headers: { accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(9_000),
    })
    if (!response.ok) throw new Error(`Core response ${response.status}`)
    const payload = await response.json() as
      | Array<{ id: string; gammaMarketId?: string | null; slug?: string; question?: string; state?: string; enableOrderBook?: boolean; marketEndAt?: string | null; tokens?: Array<{ tokenId: string; outcome: string }> }>
      | { items?: Array<{ id: string; gammaMarketId?: string | null; slug?: string; question?: string; state?: string; enableOrderBook?: boolean; marketEndAt?: string | null; tokens?: Array<{ tokenId: string; outcome: string }> }> }
    const rows = Array.isArray(payload) ? payload : payload.items ?? []
    const tradable = rows.filter((market) => market.question && market.state === 'active').slice(0, 18)

    // 并行取前几个市场的实时价格（book 的 lastTradePrice / bid-ask 中值）
    const priceMap = new Map<string, number>()
    const priceTokens = tradable.slice(0, 8).flatMap((market) => (market.tokens ?? []).slice(0, 2).map((token) => token.tokenId))
    await Promise.all(priceTokens.map(async (tokenId) => {
      try {
        const bookResponse = await fetch(`${CORE_API}/v1/polymarket/tokens/${encodeURIComponent(tokenId)}/order-book`, {
          headers: { accept: 'application/json' },
          next: { revalidate },
          signal: AbortSignal.timeout(8_000),
        })
        if (!bookResponse.ok) return
        const book = await bookResponse.json() as { lastTradePrice?: string; bids?: Array<{ price?: string }>; asks?: Array<{ price?: string }> }
        const last = Number(book.lastTradePrice)
        const bid = Number(book.bids?.[0]?.price)
        const ask = Number(book.asks?.[0]?.price)
        const mid = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 && ask > bid ? (bid + ask) / 2 : null
        const price = Number.isFinite(last) && last > 0 ? last : mid
        if (price !== null && Number.isFinite(price)) priceMap.set(tokenId, Math.min(0.999, Math.max(0.001, price)))
      } catch { /* 价格拿不到就退默认 */ }
    }))

    const markets = tradable.map((market) => {
      const tokens = (market.tokens ?? []).slice(0, 2)
      const outcomes = tokens.map((token) => token.outcome)
      const prices = tokens.map(token => priceMap.get(token.tokenId) ?? null)
      return {
        id: market.gammaMarketId ?? market.id,
        question: market.question!,
        slug: market.slug ?? '',
        outcomes: outcomes.length ? outcomes : ['Yes', 'No'],
        prices,
        volume: 0,
        volume24h: 0,
        liquidity: 0,
        endDate: market.marketEndAt ?? null,
        category: 'Markets',
        acceptingOrders: market.enableOrderBook === true,
      }
    })
    return NextResponse.json({ source: 'core-polymarket', fetchedAt: new Date().toISOString(), integration, markets })
  } catch (error) {
    return NextResponse.json({
      source: 'unavailable',
      fetchedAt: new Date().toISOString(),
      integration,
      error: 'Market data unavailable',
      markets: [],
    }, { status: 502 })
  }
}
