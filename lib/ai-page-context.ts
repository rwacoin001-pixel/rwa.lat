import { resolveRoute, type RouteKey } from './routes-v2'

export type AiPageContext = { pageKey: RouteKey; tab?: 'predictions' | 'baskets' | 'trade' | 'assets' }
const tabs = new Set(['predictions', 'baskets', 'trade', 'assets'])
/** Send a route key, never URL parameters, form values, balances, codes or account identifiers. */
export function aiPageContext(pathname: string, search = ''): AiPageContext | undefined {
  const page = resolveRoute(pathname)
  if (!page || page.def.domain === 'ai' || page.def.domain === 'system') return undefined
  const tab = new URLSearchParams(search).get('tab')
  return { pageKey: page.key, ...(page.key === 'markets' && tab && tabs.has(tab) ? { tab: tab as AiPageContext['tab'] } : {}) }
}
