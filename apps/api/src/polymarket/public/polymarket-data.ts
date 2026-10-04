import {isPredictionDiscoverable} from './prediction-lifecycle'

export const HISTORY_PERIODS = ['1h','1d','1w','1m','max'] as const
export type HistoryPeriod = typeof HISTORY_PERIODS[number]
export type GammaMarketData = { conditionId?: string; id?: string; question?: string; description?: string; groupItemTitle?: string; image?: string; active?: boolean; closed?: boolean; resolved?: boolean; archived?: boolean; outcomes?: string | string[]; outcomePrices?: string | string[]; clobTokenIds?: string | string[]; volume?: number | string; volume24hr?: number | string; liquidity?: number | string; endDate?: string; endDateIso?: string; category?: string; acceptingOrders?: boolean; events?: Array<{id?: string}> }
export type GammaEventData = { tags?: Array<{id?: string; slug?: string}>; id?: string; title?: string; description?: string; slug?: string; image?: string; active?: boolean; closed?: boolean; resolved?: boolean; archived?: boolean; volume?: number | string; volume24hr?: number | string; endDate?: string; markets?: GammaMarketData[] }
export function stringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(String)
  try { const a: unknown = JSON.parse(value ?? '[]'); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}
export function eventMarkets(event: GammaEventData) {
  return (event.markets ?? []).filter(m => m.id && m.question && !m.archived && stringArray(m.outcomes).length >= 2)
}
export function activeEventMarkets(event: GammaEventData, now=Date.now()) {
  return isPredictionDiscoverable(event,now) ? eventMarkets(event).filter(m => isPredictionDiscoverable(m,now)) : []
}
export function probabilityHistoryState(curves:Array<{available:boolean;points:unknown[]}>) {
  if(curves.length&&curves.every(c=>!c.available))return 'unavailable'
  if(curves.some(c=>!c.available))return 'partial'
  return curves.some(c=>c.points.length)?'ready':'empty'
}
export function historyQuery(period: HistoryPeriod) {
  // CLOB rejects explicit start/end windows covering a month, even at coarse fidelity.
  // Its supported interval=1m means one MONTH, not one minute.
  return `interval=${period}&fidelity=${period === '1h' ? 1 : period === '1d' ? 5 : 60}`
}

export function formatProbability(value: number | undefined, locale: string) {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 1) return '—'
  if (value > 0 && value < .01) return '<1%'
  return `${(value * 100).toLocaleString(locale, {maximumFractionDigits: 1})}%`
}
