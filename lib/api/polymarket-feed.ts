import type {PolymarketCategory,PolymarketSort,PolymarketFeedPage} from '@/apps/api/src/polymarket/public/feed-types'
export * from '@/apps/api/src/polymarket/public/feed-types'

/** Polymarket-style filters (2026-11-05): ending window, active/resolved, and topics to hide. Defaults send nothing. */
export type FeedStatus = 'active' | 'resolved'
export type FeedWindow = 'all' | 'day' | 'week' | 'month'
export type FeedHide = 'sports' | 'crypto' | 'earnings'
export type FeedFilters = { status?: FeedStatus; window?: FeedWindow; hide?: FeedHide[] }

export async function getPolymarketFeed(category: PolymarketCategory, offset: number, signal?: AbortSignal, sort:PolymarketSort='volume24hr', search='', filters: FeedFilters = {}): Promise<PolymarketFeedPage> {
  const query = new URLSearchParams({ category, offset: String(offset), sort, q:search })
  if (filters.status && filters.status !== 'active') query.set('status', filters.status)
  if (filters.window && filters.window !== 'all') query.set('window', filters.window)
  if (filters.hide?.length) query.set('hide', filters.hide.join(','))
  const response = await fetch(`/api/polymarket/feed?${query}`, { signal })
  if (!response.ok) throw new Error('Polymarket feed unavailable')
  return response.json() as Promise<PolymarketFeedPage>
}
