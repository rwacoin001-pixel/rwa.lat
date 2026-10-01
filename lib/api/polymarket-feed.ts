export const POLYMARKET_CATEGORIES = ['all', 'politics', 'sports', 'crypto', 'finance', 'geopolitics', 'earnings', 'tech', 'culture', 'world'] as const

export type PolymarketCategory = (typeof POLYMARKET_CATEGORIES)[number]

// Gamma tag IDs verified against /tags/slug/:slug. Filter on the provider, not by question keywords.
export const POLYMARKET_CATEGORY_TAGS: Record<Exclude<PolymarketCategory, 'all'>, number> = {
  politics: 2,
  sports: 1,
  crypto: 21,
  finance: 120,
  geopolitics: 100265,
  earnings: 1013,
  tech: 1401,
  culture: 596,
  world: 101970,
}

export type PolymarketFeedMarket = {
  id: string
  featured?: boolean
  marketIds?: string[]
  optionCount?: number
  image?: string | null
  question: string
  category: PolymarketCategory
  outcomes: Array<{ label: string; impliedProbability: number }>
  volume24hUsd: number | null
  endAt: string | null
}

export type PolymarketFeedPage = {
  source: 'polymarket-gamma'
  fetchedAt: string
  items: PolymarketFeedMarket[]
  nextOffset: number | null
}

export async function getPolymarketFeed(category: PolymarketCategory, offset: number, signal?: AbortSignal): Promise<PolymarketFeedPage> {
  const query = new URLSearchParams({ category, offset: String(offset) })
  const response = await fetch(`/api/polymarket/feed?${query}`, { signal })
  if (!response.ok) throw new Error('Polymarket feed unavailable')
  return response.json() as Promise<PolymarketFeedPage>
}
