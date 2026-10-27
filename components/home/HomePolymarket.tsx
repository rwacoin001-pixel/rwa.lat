'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChartNoAxesCombined, Coins, Landmark, Waves } from 'lucide-react'
import { openPath } from '@/lib/maison-nav'
import { useQuery } from '@/lib/api/_query'
import { POLL, request } from '@/lib/api/_http'
import { translatePolymarketMarkets, type PolymarketTranslation } from '@/lib/api/polymarket-translations'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fmtUsdCompact } from '@/lib/money'
import { polymarketTranslationCopy } from '@/lib/polymarket-translation-copy'
import { HomeSectionHeading } from './HomeSectionHeading'
import styles from './HomePolymarket.module.css'

type Market = {
  id: string
  slug: string
  eventSlug: string | null
  question: string
  category: 'macro' | 'crypto' | 'commodities' | 'other'
  outcomes: Array<{ label: string; impliedProbability: number }>
  volume24hUsd: number | null
  providerUpdatedAt: string | null
}
type Preview = { source: 'polymarket-gamma'; fetchedAt: string; tradingEnabled: false; items: Market[] }

const copy: Record<AppLocale, { title: string; eyebrow: string; empty: string; retry: string; volume: string; probability: string; source: string; macro: string; crypto: string; commodities: string; other: string }> = {
  en: { title: 'What the market thinks', eyebrow: 'PREDICTION MARKETS', empty: 'Public markets are unavailable right now.', retry: 'Try again', volume: '24h volume', probability: 'Implied probability', source: 'Live prices · trade in app', macro: 'Macro', crypto: 'Crypto', commodities: 'Commodities', other: 'Trending' },
  'zh-CN': { title: '市场预期', eyebrow: '预测市场', empty: '公开市场数据暂不可用', retry: '重试', volume: '24 小时成交额', probability: '市场隐含概率', source: '实时行情 · 站内交易', macro: '宏观', crypto: '加密', commodities: '大宗', other: '热门' },
  hi: { title: 'बाज़ार की राय', eyebrow: 'पूर्वानुमान बाज़ार', empty: 'सार्वजनिक बाज़ार डेटा उपलब्ध नहीं है', retry: 'फिर कोशिश करें', volume: '24 घंटे का कारोबार', probability: 'निहित संभावना', source: 'लाइव भाव · ऐप में ट्रेड', macro: 'मैक्रो', crypto: 'क्रिप्टो', commodities: 'कमोडिटी', other: 'लोकप्रिय' },
  es: { title: 'Lo que anticipa el mercado', eyebrow: 'MERCADOS DE PREDICCIÓN', empty: 'Datos no disponibles', retry: 'Reintentar', volume: 'Volumen 24 h', probability: 'Probabilidad implícita', source: 'Precios en vivo · opera en la app', macro: 'Macro', crypto: 'Cripto', commodities: 'Materias primas', other: 'Tendencias' },
  ar: { title: 'توقعات السوق', eyebrow: 'أسواق التنبؤ', empty: 'بيانات السوق العامة غير متاحة', retry: 'إعادة المحاولة', volume: 'حجم 24 ساعة', probability: 'الاحتمال الضمني', source: 'أسعار مباشرة · التداول في التطبيق', macro: 'اقتصاد كلي', crypto: 'عملات رقمية', commodities: 'سلع', other: 'رائج' },
  fr: { title: 'Ce qu’anticipe le marché', eyebrow: 'MARCHÉS DE PRÉDICTION', empty: 'Données publiques indisponibles', retry: 'Réessayer', volume: 'Volume 24 h', probability: 'Probabilité implicite', source: 'Cours en direct · trade in-app', macro: 'Macro', crypto: 'Crypto', commodities: 'Matières premières', other: 'Tendance' },
  pt: { title: 'O que o mercado espera', eyebrow: 'MERCADOS DE PREVISÃO', empty: 'Dados públicos indisponíveis', retry: 'Tentar novamente', volume: 'Volume 24 h', probability: 'Probabilidade implícita', source: 'Cotações ao vivo · negocie no app', macro: 'Macro', crypto: 'Cripto', commodities: 'Commodities', other: 'Em alta' },
}

const translateAction: Record<AppLocale, string> = { en: 'Show translation', 'zh-CN': '显示翻译', hi: 'अनुवाद दिखाएँ', es: 'Mostrar traducción', ar: 'عرض الترجمة', fr: 'Afficher la traduction', pt: 'Mostrar tradução' }
const allMarkets: Record<AppLocale, string> = { en: 'All markets', 'zh-CN': '全部预测', hi: 'सभी बाज़ार', es: 'Todos los mercados', ar: 'جميع الأسواق', fr: 'Tous les marchés', pt: 'Todos os mercados' }
function translationKey(locale: AppLocale, market: Market) { return JSON.stringify([locale, market.id, market.question, market.outcomes.map(outcome => outcome.label)]) }

const categoryIcon = { macro: Landmark, crypto: Coins, commodities: Waves, other: ChartNoAxesCombined }

export function HomePolymarket() {
  const { locale } = useI18n()
  const label = copy[locale]
  const result = useQuery('polymarket:public-preview:finance', () => request<Preview>('/v1/polymarket/public-preview?scope=finance'), { staleTime: 60_000, pollInterval: POLL.quote })
  const fetched = result.data?.fetchedAt && !Number.isNaN(Date.parse(result.data.fetchedAt))
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(result.data.fetchedAt)) : null

  // Machine translation of the upstream (English) market text, reusing the same
  // backend cache as the prediction screens. The original is always kept as the
  // fallback, so a translation outage never leaves the card empty.
  const translationLabel = polymarketTranslationCopy[locale]
  const [translations, setTranslations] = useState<Record<string, PolymarketTranslation>>({})
  const attempts = useRef(new Map<string, number>())
  const inFlight = useRef(new Set<string>())
  const [pending, setPending] = useState(() => new Set<string>())
  const [originals, setOriginals] = useState(() => new Set<string>())
  const translate = useCallback(async (markets: Market[], force = false) => {
    if (locale === 'en') return
    const batch = markets.filter(market => /^\d{1,20}$/.test(market.id)).filter(market => {
      const key = translationKey(locale, market)
      return !inFlight.current.has(key) && (force || (attempts.current.get(key) ?? 0) < 2)
    }).slice(0, 20)
    if (!batch.length) return
    const keys = batch.map(market => translationKey(locale, market))
    for (const key of keys) { inFlight.current.add(key); attempts.current.set(key, (attempts.current.get(key) ?? 0) + 1) }
    setPending(previous => new Set([...previous, ...keys]))
    try {
      const response = await translatePolymarketMarkets(batch.map(market => market.id), locale)
      if (!response.ok || !response.data.available) return
      const translatedById = new Map(response.data.items.map(item => [item.id, item]))
      const additions: Record<string, PolymarketTranslation> = {}
      for (const market of batch) {
        const item = translatedById.get(market.id)
        if (item) { const key = translationKey(locale, market); additions[key] = item; attempts.current.set(key, 99) }
      }
      setTranslations(previous => ({ ...previous, ...additions }))
    } catch { /* Keep the original body and a retry action. */ }
    finally {
      for (const key of keys) inFlight.current.delete(key)
      setPending(previous => { const next = new Set(previous); for (const key of keys) next.delete(key); return next })
    }
  }, [locale])

  useEffect(() => { void translate(result.data?.items ?? []) }, [translate, result.data])

  return <section className={styles.root} aria-label={label.title}>
    <HomeSectionHeading index="05" title={label.title} more={allMarkets[locale]} onMore={() => openPath('/markets?tab=predictions')} />
    {result.loading && !result.data ? <div className={styles.loading}><span /><span /><span /></div> : (result.error && !result.data) || !result.data?.items.length ? <button type="button" className={styles.empty} onClick={() => void result.refetch()}>{label.empty} · {label.retry}</button> : <div className={styles.list}>{result.data.items.map(market => {
      const Icon = categoryIcon[market.category]
      const key = translationKey(locale, market)
      const cached = translations[key]
      const translated = originals.has(key) ? undefined : cached
      return <div className={styles.card} key={market.id}>
      <button type="button" className={styles.cardLink} onClick={() => openPath(`/prediction/${encodeURIComponent(market.id)}`)}>
        <span className={styles.top}><span className={styles.icon}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.category}>{label[market.category]}</span>{translated && <span className={styles.mt}>{translationLabel.translated}</span>}</span>
        <strong className={styles.question} lang={translated ? locale : 'en'}>{translated?.question ?? market.question}</strong>
        <span className={styles.outcomes}>{market.outcomes.slice(0, 2).map((outcome, index) => <span className={styles.outcome} key={`${market.id}-${index}`}><span lang={translated ? locale : 'en'}>{translated?.outcomes[index] ?? outcome.label}</span><b dir="ltr">{new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(outcome.impliedProbability)}</b></span>)}</span>
        <span className={styles.probabilityBar} aria-hidden="true"><span style={{ width: `${(market.outcomes[0]?.impliedProbability ?? 0) * 100}%` }} /></span>
        <span className={styles.foot}><span>{label.probability}</span><span>{label.volume} <b dir="ltr">{market.volume24hUsd === null ? '—' : fmtUsdCompact(market.volume24hUsd, { locale, digits: 1 })}</b></span></span>
      </button>
      {locale !== 'en' && <button type="button" className={styles.translate} disabled={pending.has(key)} aria-live="polite" onClick={() => {
        if (cached) setOriginals(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next })
        else void translate([market], true)
      }}>{pending.has(key) ? translationLabel.loading + '…' : translated ? translationLabel.original : translateAction[locale]}</button>}
      </div>
    })}</div>}
    <p className={styles.source}>{label.source}{fetched ? ` · ${fetched}` : ''}</p>
  </section>
}
