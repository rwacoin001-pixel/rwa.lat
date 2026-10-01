import { resolveRoute } from './routes-v2'

/** Model text is untrusted: only navigate inside verified application routes. */
export function aiNavigationLink(value: string | undefined): string | null {
  if (!value || /[\s\\<>]/.test(value) || value.startsWith('//')) return null
  try {
    const url = new URL(value, 'https://rwa.lat')
    if (url.origin !== 'https://rwa.lat' || url.username || url.password || url.hash) return null
    if (/%(?:2f|5c|0[0-9a-f])/i.test(url.pathname) || url.pathname.includes(':')) return null
    if (!resolveRoute(url.pathname) && !['/ai-assistant','/terms','/privacy'].includes(url.pathname)) return null
    // Screen links cannot silently prefill recipients, amounts or financial consent.
    const allowed: Record<string, string[]> = { tab: ['baskets','predictions','assets','trade','cash','activity','disclosures','valuation'], section: ['marketing'], side: ['redeem'] }
    for (const [key, item] of url.searchParams) if (!allowed[key]?.includes(item)) return null
    return url.pathname + url.search
  } catch { return null }
}
