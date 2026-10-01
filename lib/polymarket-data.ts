export const HISTORY_PERIODS = ['1h','1d','1w','1m','max'] as const
export type HistoryPeriod = typeof HISTORY_PERIODS[number]
export type GammaMarketData = { id?: string; question?: string; description?: string; groupItemTitle?: string; image?: string; active?: boolean; closed?: boolean; archived?: boolean; outcomes?: string | string[]; outcomePrices?: string | string[]; clobTokenIds?: string | string[]; volume?: number | string; volume24hr?: number | string; liquidity?: number | string; endDate?: string; endDateIso?: string; category?: string; acceptingOrders?: boolean; events?: Array<{id?: string}> }
export type GammaEventData = { id?: string; title?: string; description?: string; slug?: string; image?: string; active?: boolean; closed?: boolean; archived?: boolean; volume?: number | string; volume24hr?: number | string; endDate?: string; markets?: GammaMarketData[] }
export function stringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String)
  try { const a: unknown = JSON.parse(value ?? '[]'); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}
export function eventMarkets(event: GammaEventData) {
  return (event.markets ?? []).filter(m => m.id && m.question && !m.archived && stringArray(m.outcomes).length >= 2)
}
export function activeEventMarkets(event: GammaEventData) { return eventMarkets(event).filter(m => m.active !== false && !m.closed) }
export function probabilityHistoryState(curves:Array<{available:boolean;points:unknown[]}>) {
  if(curves.length&&curves.every(c=>!c.available))return 'unavailable'
  if(curves.some(c=>!c.available))return 'partial'
  return curves.some(c=>c.points.length)?'ready':'empty'
}
export function historyQuery(period: HistoryPeriod) {
  if (period === 'max') return 'interval=max&fidelity=60'
  const seconds = { '1h':3600, '1d':86400, '1w':604800, '1m':2592000 }[period]
  return `startTs=${Math.floor(Date.now()/1000)-seconds}&endTs=${Math.floor(Date.now()/1000)}&fidelity=${period === '1h' ? 1 : period === '1d' ? 5 : 60}`
}
