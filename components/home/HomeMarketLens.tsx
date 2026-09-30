'use client'

import { ArrowUpRight, Activity, Globe2 } from 'lucide-react'
import { useQuery } from '@/lib/api/_query'
import { getMarketContextView } from '@/lib/api/market-context'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { MarketQuote } from '@/lib/p0a-data'
import styles from './HomeMarketLens.module.css'

const copy: Record<AppLocale, { title: string; eyebrow: string; note: string; unavailable: string; retrieved: string; stale: string }> = {
  en: { title: 'Market lens', eyebrow: 'THE WORLD IN MOTION', note: 'Context only · not an executable quote', unavailable: 'Market data unavailable', retrieved: 'Retrieved', stale: 'Delayed' },
  'zh-CN': { title: '宏观镜头', eyebrow: '观察世界的脉搏', note: '仅供参考 · 非可执行报价', unavailable: '行情暂不可用', retrieved: '获取时间', stale: '延迟' },
  hi: { title: 'बाज़ार पर नज़र', eyebrow: 'बदलती दुनिया', note: 'केवल संदर्भ · निष्पादन योग्य भाव नहीं', unavailable: 'बाज़ार डेटा उपलब्ध नहीं', retrieved: 'प्राप्त', stale: 'विलंबित' },
  es: { title: 'Pulso global', eyebrow: 'EL MUNDO EN MOVIMIENTO', note: 'Solo contexto · no es una cotización ejecutable', unavailable: 'Datos no disponibles', retrieved: 'Consultado', stale: 'Retrasado' },
  ar: { title: 'المشهد الكلي', eyebrow: 'العالم يتحرك', note: 'للاسترشاد فقط · ليس سعراً قابلاً للتنفيذ', unavailable: 'بيانات السوق غير متاحة', retrieved: 'تم الجلب', stale: 'متأخر' },
  fr: { title: 'Vue des marchés', eyebrow: 'LE MONDE EN MOUVEMENT', note: 'Contexte uniquement · cotation non exécutable', unavailable: 'Données indisponibles', retrieved: 'Relevé', stale: 'Différé' },
  pt: { title: 'Visão do mercado', eyebrow: 'O MUNDO EM MOVIMENTO', note: 'Apenas contexto · cotação não executável', unavailable: 'Dados indisponíveis', retrieved: 'Consultado', stale: 'Atrasado' },
}

const symbolLabels: Record<string, string> = { '^TNX': 'US 10Y', 'DX-Y.NYB': 'DXY', 'GC=F': 'GOLD', '^GSPC': 'S&P 500', BTC: 'BTC', ETH: 'ETH' }

function quoteValue(quote: MarketQuote, locale: AppLocale) {
  if (quote.value === null) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: quote.unit === 'yield%' ? 3 : 2 }).format(quote.value) + (quote.unit === 'yield%' ? '%' : '')
}

function changeValue(quote: MarketQuote) {
  if (quote.changePct === null) return '—'
  return `${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%`
}

function quoteMeta(quote: MarketQuote, locale: AppLocale, staleLabel: string) {
  const timestamp = quote.asOf ?? quote.receivedAt
  const time = timestamp && !Number.isNaN(Date.parse(timestamp))
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp)) : '—'
  return `${quote.source} · ${time}${quote.stale ? ` · ${staleLabel}` : ''}`
}

export function HomeMarketLens() {
  const { locale } = useI18n()
  const label = copy[locale]
  const result = useQuery('market-context:home', getMarketContextView, { staleTime: 45_000 })
  const featured = result.data?.anchors.filter(quote => ['^TNX', 'GC=F'].includes(quote.symbol)) ?? []
  const rest = [result.data?.anchors.find(quote => quote.symbol === 'DX-Y.NYB'), result.data?.anchors.find(quote => quote.symbol === '^GSPC'), result.data?.secondary.find(quote => quote.symbol === 'BTC'), result.data?.secondary.find(quote => quote.symbol === 'ETH')].filter((quote): quote is MarketQuote => Boolean(quote))
  const latestTime = result.data?.serverTime && !Number.isNaN(Date.parse(result.data.serverTime))
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(result.data.serverTime)) : '—'

  return <section className={styles.root} aria-label={label.title}>
    <div className={styles.heading}><div><span className={styles.eyebrow}><Globe2 size={13} />{label.eyebrow}</span><h2>{label.title}</h2></div><Activity size={21} strokeWidth={1.5} aria-hidden="true" /></div>
    {result.loading && !result.data ? <div className={styles.loading}><span /><span /><span /></div> : result.error && !result.data ? <button type="button" className={styles.error} onClick={() => void result.refetch()}>{label.unavailable}</button> : <>
      <div className={styles.featured}>
        {featured.map(quote => <div className={styles.featuredQuote} key={quote.symbol}>
          <span className={styles.quoteName}>{symbolLabels[quote.symbol] ?? quote.name}</span>
          <strong dir="ltr">{quoteValue(quote, locale)}</strong>
          <span className={quote.changePct !== null && quote.changePct < 0 ? styles.down : styles.up} dir="ltr">{changeValue(quote)} <ArrowUpRight size={14} /></span>
          <small>{quoteMeta(quote, locale, label.stale)}</small>
        </div>)}
      </div>
      <div className={styles.list}>{rest.map(quote => <div className={styles.row} key={quote.symbol}><span className={styles.symbolCell}><span className={styles.symbol}>{symbolLabels[quote.symbol] ?? quote.name}</span><small>{quoteMeta(quote, locale, label.stale)}</small></span><span className={styles.value} dir="ltr">{quoteValue(quote, locale)}</span><span className={quote.changePct !== null && quote.changePct < 0 ? styles.down : styles.up} dir="ltr">{changeValue(quote)}</span></div>)}</div>
      <p className={styles.foot}>{label.retrieved} {latestTime}<br />{label.note}</p>
    </>}
  </section>
}
