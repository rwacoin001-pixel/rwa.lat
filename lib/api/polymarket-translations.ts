import type { AppLocale } from '@/lib/app-locales'
import { request } from './_http'

export type PolymarketTranslation = { id: string; question: string; outcomes: string[]; rules?: string }
export type PolymarketTranslationsResponse = { locale: AppLocale; available: boolean; items: PolymarketTranslation[] }

export const translatePolymarketMarkets = (ids: string[], locale: Exclude<AppLocale, 'en'>, includeRules = false) =>
  request<PolymarketTranslationsResponse>('/v1/polymarket/translations', {
    method: 'POST',
    body: JSON.stringify({ ids, locale, includeRules }),
    timeoutMs: includeRules ? 120_000 : 90_000,
    loading: 'silent',
  })
