import type {PolymarketCategory,PolymarketSort,PolymarketFeedPage} from '@/apps/api/src/polymarket/public/feed-types'
export * from '@/apps/api/src/polymarket/public/feed-types'

export async function getPolymarketFeed(category: PolymarketCategory, offset: number, signal?: AbortSignal, sort:PolymarketSort='volume24hr', search=''): Promise<PolymarketFeedPage> {
  const query = new URLSearchParams({ category, offset: String(offset), sort, q:search })
  const response = await fetch(`/api/polymarket/feed?${query}`, { signal })
  if (!response.ok) throw new Error('Polymarket feed unavailable')
  return response.json() as Promise<PolymarketFeedPage>
}
