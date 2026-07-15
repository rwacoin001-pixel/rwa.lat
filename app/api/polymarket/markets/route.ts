import { NextResponse } from 'next/server'
import { polymarketServerConfig } from '@/lib/polymarket-server'

export const revalidate = 60
// The fallback is part of the Demo contract. Do not let an earlier failed ISR
// render cache an empty discovery response for later visitors.
export const dynamic = 'force-dynamic'

type GammaMarket = {
  id?: string
  question?: string
  slug?: string
  outcomes?: string | string[]
  outcomePrices?: string | string[]
  volume?: string | number
  volume24hr?: string | number
  liquidity?: string | number
  endDate?: string
  endDateIso?: string
  category?: string
  active?: boolean
  closed?: boolean
  acceptingOrders?: boolean
}

// Keep public market discovery useful when Gamma is unreachable. These are
// deliberately read-only Demo examples; the integration response still marks
// trading as disabled.
const DEMO_FALLBACK_MARKETS = [
  {
    id: 'demo-fed-rate-cut-q3-2026',
    question: 'Will the Federal Reserve cut rates in Q3 2026?',
    slug: 'demo-fed-rate-cut-q3-2026',
    outcomes: ['Yes', 'No'],
    prices: [0.58, 0.42],
    volume: 1_284_000,
    volume24h: 96_000,
    liquidity: 248_000,
    endDate: '2026-09-30T23:59:59.000Z',
    category: 'Macro',
    acceptingOrders: false,
  },
  {
    id: 'demo-ethereum-above-5000-2026',
    question: 'Will ETH trade above $5,000 before the end of 2026?',
    slug: 'demo-ethereum-above-5000-2026',
    outcomes: ['Yes', 'No'],
    prices: [0.47, 0.53],
    volume: 842_000,
    volume24h: 71_000,
    liquidity: 163_000,
    endDate: '2026-12-31T23:59:59.000Z',
    category: 'Crypto',
    acceptingOrders: false,
  },
  {
    id: 'demo-us-recession-2026',
    question: 'Will the United States enter a recession in 2026?',
    slug: 'demo-us-recession-2026',
    outcomes: ['Yes', 'No'],
    prices: [0.31, 0.69],
    volume: 629_000,
    volume24h: 38_000,
    liquidity: 119_000,
    endDate: '2026-12-31T23:59:59.000Z',
    category: 'Macro',
    acceptingOrders: false,
  },
] as const

function arrayValue(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function numberValue(value: string | number | undefined): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

export async function GET() {
  const integration = polymarketServerConfig()
  try {
    const response = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=80', {
      headers: { accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`Gamma response ${response.status}`)
    const source = await response.json() as GammaMarket[]
    const markets = source
      .filter((market) => market.active && !market.closed && market.question)
      .sort((left, right) => numberValue(right.volume24hr) - numberValue(left.volume24hr))
      .slice(0, 18)
      .map((market) => ({
        id: market.id ?? market.slug ?? crypto.randomUUID(),
        question: market.question!,
        slug: market.slug ?? '',
        outcomes: arrayValue(market.outcomes),
        prices: arrayValue(market.outcomePrices).map(numberValue),
        volume: numberValue(market.volume),
        volume24h: numberValue(market.volume24hr),
        liquidity: numberValue(market.liquidity),
        endDate: market.endDateIso ?? market.endDate ?? null,
        category: market.category ?? 'Markets',
        acceptingOrders: Boolean(market.acceptingOrders),
      }))
    return NextResponse.json({ source: 'polymarket-gamma', fetchedAt: new Date().toISOString(), integration, markets })
  } catch (error) {
    return NextResponse.json({
      source: 'demo-fallback',
      fetchedAt: new Date().toISOString(),
      integration,
      error: error instanceof Error ? error.message : 'Market data unavailable',
      markets: DEMO_FALLBACK_MARKETS,
    }, { status: 200 })
  }
}
