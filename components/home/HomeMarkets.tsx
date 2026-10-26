'use client'

// Maison home · Markets: macro quotes and the TradingView gold chart share one module.
// Data: GET /v1/market-context → { anchors, secondary, serverTime } (MarketQuote.stale marks delayed quotes).
import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useQuery } from '@/lib/api/_query'
import { getMarketContextView } from '@/lib/api/market-context'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { MarketQuote } from '@/lib/p0a-data'
import { HomeTradingView } from './HomeTradingView'
import { HomeSectionHeading } from './HomeSectionHeading'
import { EASE } from './maison-motion'
import { RollingText } from './RollingText'
import { Sparkline } from './Sparkline'
import styles from './HomeMarkets.module.css'

const copy: Record<AppLocale, { eyebrow: string; title: string; macro: string; gold: string; unavailable: string; note: string; retrieved: string; delayed: string }> = {
  en: { eyebrow: 'The world in motion', title: 'Markets', macro: 'Macro', gold: 'Gold spot', unavailable: 'Market data unavailable · tap to retry', note: 'Context only · not an executable quote', retrieved: 'Retrieved', delayed: 'Delayed' },
  'zh-CN': { eyebrow: '观察世界的脉搏', title: '市场', macro: '宏观', gold: '黄金现货', unavailable: '行情暂不可用 · 点击重试', note: '仅供参考 · 非可执行报价', retrieved: '获取时间', delayed: '延迟' },
  hi: { eyebrow: 'बदलती दुनिया', title: 'बाज़ार', macro: 'मैक्रो', gold: 'हाजिर सोना', unavailable: 'बाज़ार डेटा उपलब्ध नहीं · फिर प्रयास करें', note: 'केवल संदर्भ · निष्पादन योग्य भाव नहीं', retrieved: 'प्राप्त', delayed: 'विलंबित' },
  es: { eyebrow: 'El mundo en movimiento', title: 'Mercados', macro: 'Macro', gold: 'Oro al contado', unavailable: 'Datos no disponibles · reintentar', note: 'Solo contexto · no es una cotización ejecutable', retrieved: 'Consultado', delayed: 'Retrasado' },
  ar: { eyebrow: 'العالم يتحرك', title: 'الأسواق', macro: 'الاقتصاد الكلي', gold: 'الذهب الفوري', unavailable: 'بيانات السوق غير متاحة · أعد المحاولة', note: 'للاسترشاد فقط · ليس سعراً قابلاً للتنفيذ', retrieved: 'تم الجلب', delayed: 'متأخر' },
  fr: { eyebrow: 'Le monde en mouvement', title: 'Marchés', macro: 'Macro', gold: 'Or au comptant', unavailable: 'Données indisponibles · réessayer', note: 'Contexte uniquement · cotation non exécutable', retrieved: 'Relevé', delayed: 'Différé' },
  pt: { eyebrow: 'O mundo em movimento', title: 'Mercados', macro: 'Macro', gold: 'Ouro à vista', unavailable: 'Dados indisponíveis · tentar novamente', note: 'Apenas contexto · cotação não executável', retrieved: 'Consultado', delayed: 'Atrasado' },
}

const goldFutures: Record<AppLocale, string> = { en: 'Gold futures', 'zh-CN': '黄金期货', hi: 'सोना फ्यूचर्स', es: 'Futuros de oro', ar: 'عقود الذهب الآجلة', fr: 'Contrats à terme or', pt: 'Futuros de ouro' }

const symbolLabels: Record<string, string> = { '^TNX': 'US 10Y', 'DX-Y.NYB': 'DXY', 'GC=F': 'GOLD', '^GSPC': 'S&P 500', BTC: 'BTC', ETH: 'ETH' }

function formatQuote(quote: MarketQuote, value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: quote.unit === 'yield%' ? 3 : 2, maximumFractionDigits: quote.unit === 'yield%' ? 3 : 2 }).format(value) + (quote.unit === 'yield%' ? '%' : '')
}

function formatChange(quote: MarketQuote) {
  if (quote.changePct === null) return '—'
  return `${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%`
}

function toneName(quote: MarketQuote) {
  return quote.changePct === null || quote.changePct === 0 ? null : quote.changePct < 0 ? 'down' as const : 'up' as const
}

function tone(quote: MarketQuote) {
  return quote.changePct === null || quote.changePct === 0 ? styles.flat : quote.changePct < 0 ? styles.down : styles.up
}

const OPEN_EVENT = 'home-markets:open'

/** Scroll to the Markets module and select a tab — used by the For You gold pick. */
export function openHomeMarkets(tab: 'macro' | 'gold') {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tab }))
}

export function HomeMarkets() {
  const { locale } = useI18n()
  const label = copy[locale]
  const reduced = useReducedMotion()
  const [tab, setTab] = useState<'macro' | 'gold'>('macro')
  const rootRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<'macro' | 'gold'>).detail
      if (next === 'macro' || next === 'gold') setTab(next)
      rootRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])
  const result = useQuery('market-context:home', getMarketContextView, { staleTime: 45_000 })
  const data = result.data
  const featured = ['^TNX', 'GC=F'].map(symbol => data?.anchors.find(quote => quote.symbol === symbol)).filter((quote): quote is MarketQuote => Boolean(quote))
  const rest = [data?.anchors.find(quote => quote.symbol === 'DX-Y.NYB'), data?.anchors.find(quote => quote.symbol === '^GSPC'), data?.secondary.find(quote => quote.symbol === 'BTC'), data?.secondary.find(quote => quote.symbol === 'ETH')].filter((quote): quote is MarketQuote => Boolean(quote))
  const retrieved = data?.serverTime && !Number.isNaN(Date.parse(data.serverTime))
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(data.serverTime)) : '—'
  const tabs = [{ id: 'macro' as const, text: label.macro }, { id: 'gold' as const, text: label.gold }]

  return <section ref={rootRef} className={styles.root} aria-label={label.title}>
    <HomeSectionHeading index="04" title={label.title}>
      <div className={styles.tabs} role="tablist" aria-label={label.title}>
        {tabs.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
          {tab === item.id && <motion.span className={styles.tabPill} layoutId="home-markets-tab" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className={styles.tabText}>{item.text}</span>
        </button>)}
      </div>
    </HomeSectionHeading>

    {tab === 'macro' ? <motion.div key="macro" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      {result.loading && !data ? <div className={styles.loading}><span /><span /><span /></div> : result.error && !data ? <button type="button" className={styles.error} onClick={() => void result.refetch()}>{label.unavailable}</button> : <>
        <div className={styles.featured}>
          {featured.map(quote => <div className={styles.featuredQuote} key={quote.symbol}>
            <span className={styles.symbol}>{quote.symbol === 'GC=F' ? goldFutures[locale] : symbolLabels[quote.symbol] ?? quote.name}{quote.stale && <i>{label.delayed}</i>}</span>
            <RollingText className={styles.bigValue} text={quote.value === null ? '—' : formatQuote(quote, quote.value, locale)} value={quote.value} />
            <span className={`${styles.change} ${tone(quote)}`} dir="ltr">{formatChange(quote)}</span>
            <Sparkline points={quote.spark} tone={toneName(quote)} className={styles.sparkWide} />
            <small>{quote.source}{quote.asOf && !Number.isNaN(Date.parse(quote.asOf)) ? ' · ' + new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(quote.asOf)) : ''}</small>
          </div>)}
        </div>
        <ul className={styles.list}>
          {rest.map((quote, index) => <motion.li key={quote.symbol} className={styles.row} initial={reduced ? false : { opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE, delay: index * 0.06 }}>
            <span className={styles.rowName}><b>{symbolLabels[quote.symbol] ?? quote.name}</b><small>{quote.source}{quote.stale ? ` · ${label.delayed}` : ''}</small></span>
            <span className={styles.rowSpark}><Sparkline points={quote.spark} tone={toneName(quote)} /></span>
            <RollingText className={styles.rowValue} text={quote.value === null ? '—' : formatQuote(quote, quote.value, locale)} value={quote.value} />
            <span className={`${styles.chip} ${tone(quote)}`} dir="ltr">{formatChange(quote)}</span>
          </motion.li>)}
        </ul>
        <p className={styles.foot}>{label.retrieved} {retrieved} · {label.note}</p>
      </>}
    </motion.div> : <motion.div key="gold" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <HomeTradingView bare />
    </motion.div>}
  </section>
}
