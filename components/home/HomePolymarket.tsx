'use client'

import { ArrowUpRight, ChartNoAxesCombined, Coins, Landmark, Waves } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@/lib/api/_query'
import { POLL, request } from '@/lib/api/_http'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fmtUsdCompact } from '@/lib/money'
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

const categoryIcon = { macro: Landmark, crypto: Coins, commodities: Waves, other: ChartNoAxesCombined }

export function HomePolymarket() {
  const { locale } = useI18n()
  const router = useRouter()
  const label = copy[locale]
  const result = useQuery('polymarket:public-preview:finance', () => request<Preview>('/v1/polymarket/public-preview?scope=finance'), { staleTime: 60_000, pollInterval: POLL.quote })
  const fetched = result.data?.fetchedAt && !Number.isNaN(Date.parse(result.data.fetchedAt))
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(result.data.fetchedAt)) : null

  return <section className={styles.root} aria-label={label.title}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>{label.eyebrow}</span><h2>{label.title}</h2></div><span className={styles.mark}>P</span></div>
    {result.loading && !result.data ? <div className={styles.loading}><span /><span /><span /></div> : result.error || !result.data?.items.length ? <button type="button" className={styles.empty} onClick={() => void result.refetch()}>{label.empty} · {label.retry}</button> : <div className={styles.list}>{result.data.items.map(market => {
      const Icon = categoryIcon[market.category]
      return <button type="button" className={styles.card} key={market.id} onClick={() => router.push(`/prediction/${encodeURIComponent(market.id)}`)}>
        <span className={styles.top}><span className={styles.icon}><Icon size={18} strokeWidth={1.7} /></span><span className={styles.category}>{label[market.category]}</span><ArrowUpRight size={16} /></span>
        <strong className={styles.question} lang="en">{market.question}</strong>
        <span className={styles.outcomes}>{market.outcomes.slice(0, 2).map((outcome, index) => <span className={styles.outcome} key={`${market.id}-${index}`}><span lang="en">{outcome.label}</span><b dir="ltr">{new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(outcome.impliedProbability)}</b></span>)}</span>
        <span className={styles.probabilityBar} aria-hidden="true"><span style={{ width: `${market.outcomes[0].impliedProbability * 100}%` }} /></span>
        <span className={styles.foot}><span>{label.probability}</span><span>{label.volume} <b dir="ltr">{market.volume24hUsd === null ? '—' : fmtUsdCompact(market.volume24hUsd, { locale, digits: 1 })}</b></span></span>
      </button>
    })}</div>}
    <p className={styles.source}>{label.source}{fetched ? ` · ${fetched}` : ''}</p>
  </section>
}
