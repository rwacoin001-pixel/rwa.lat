import { localeOptions, type AppLocale } from './app-locales'

export const LANGUAGE_COOKIE = 'rwa-language'

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && localeOptions.some(option => option.code === value)
}

const countriesByLanguage: Record<AppLocale, string> = {
  'zh-CN': 'CN HK MO TW',
  en: 'US GB AU NZ IE CA SG ZA',
  hi: 'IN',
  es: 'ES MX AR BO CL CO CR CU DO EC SV GQ GT HN NI PA PY PE PR UY VE',
  ar: 'AE BH DZ EG IQ JO KW LB LY MA OM PS QA SA SD SY TN YE',
  fr: 'FR MC BE CH BJ BF BI CM CF TD CG CD CI DJ GA GN HT ML NE SN TG KM',
  pt: 'PT BR AO MZ CV GW ST TL',
}

export function browserLocale(acceptLanguage: string | null | undefined): AppLocale | undefined {
  const entries = (acceptLanguage ?? '').slice(0, 4096).split(',').map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(';')
    const qualityParameter = parameters.find(value => value.trim().startsWith('q='))
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1
    const language = tag.toLowerCase().split('-')[0]
    const locale = language === 'zh' ? 'zh-CN' : language
    return { locale, quality, index }
  }).filter(entry => isAppLocale(entry.locale) && Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
  return entries[0]?.locale as AppLocale | undefined
}

export function resolveInitialLocale(input: {
  savedLocale?: string | null
  country?: string | null
  acceptLanguage?: string | null
}): AppLocale {
  if (isAppLocale(input.savedLocale)) return input.savedLocale
  const country = input.country?.trim().toUpperCase() ?? ''
  const deviceLocale = browserLocale(input.acceptLanguage)
  const regionalLocale = localeOptions.find(option => countriesByLanguage[option.code].split(' ').includes(country))?.code
  return regionalLocale ?? deviceLocale ?? 'en'
}
