'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useQuery } from '@/lib/api/_query'
import { getMarketContextView } from '@/lib/api/market-context'
import styles from './HomeTradingView.module.css'

const localeMap: Record<string, string> = { 'zh-CN': 'zh_CN', en: 'en', hi: 'en', es: 'es', ar: 'ar_AE', fr: 'fr', pt: 'pt' }

const goldCopy: Record<AppLocale, { title: string; source: string; unavailable: string; futures: string; open: string; delayed: string; latest: string }> = {
  en: { title: 'Gold spot', source: 'XAU/USD spot · TradingView', unavailable: 'XAU/USD chart unavailable', futures: 'Gold futures GC=F quote', open: 'Open chart on TradingView', delayed: 'Delayed', latest: 'Latest' },
  'zh-CN': { title: '黄金现货', source: 'XAU/USD 现货 · TradingView', unavailable: 'XAU/USD 图表暂不可用', futures: '黄金期货 GC=F 报价', open: '在 TradingView 查看图表', delayed: '延迟', latest: '最新' },
  hi: { title: 'हाजिर सोना', source: 'XAU/USD हाजिर · TradingView', unavailable: 'XAU/USD चार्ट उपलब्ध नहीं', futures: 'सोना फ्यूचर्स GC=F भाव', open: 'TradingView पर चार्ट खोलें', delayed: 'विलंबित', latest: 'नवीनतम' },
  es: { title: 'Oro al contado', source: 'XAU/USD al contado · TradingView', unavailable: 'Gráfico XAU/USD no disponible', futures: 'Cotización de futuros GC=F', open: 'Abrir en TradingView', delayed: 'Retrasado', latest: 'Último' },
  ar: { title: 'الذهب الفوري', source: 'XAU/USD فوري · TradingView', unavailable: 'رسم XAU/USD غير متاح', futures: 'سعر عقود الذهب الآجلة GC=F', open: 'فتح الرسم في TradingView', delayed: 'متأخر', latest: 'الأحدث' },
  fr: { title: 'Or au comptant', source: 'XAU/USD au comptant · TradingView', unavailable: 'Graphique XAU/USD indisponible', futures: 'Cours des contrats à terme GC=F', open: 'Ouvrir dans TradingView', delayed: 'Différé', latest: 'Dernier' },
  pt: { title: 'Ouro à vista', source: 'XAU/USD à vista · TradingView', unavailable: 'Gráfico XAU/USD indisponível', futures: 'Cotação de futuros GC=F', open: 'Abrir no TradingView', delayed: 'Atrasado', latest: 'Mais recente' },
}

export function HomeTradingView({ bare = false }: { bare?: boolean } = {}) {
  const { theme } = useRwaTheme()
  const { locale } = useI18n()
  const label = goldCopy[locale]
  const rootRef = useRef<HTMLElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '400px 0px' })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!visible || !mount) return
    mount.replaceChildren()
    setFailed(false)
    setLoaded(false)
    // Each run gets its own `tradingview-widget-container`: the embed script resolves its host from that class,
    // and a fresh node keeps a stale (Strict Mode / theme switch) script from binding to the new chart.
    const container = document.createElement('div')
    container.className = 'tradingview-widget-container'
    container.style.cssText = 'height:100%;width:100%'
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.cssText = 'height:100%;width:100%'
    const script = document.createElement('script')
    script.async = true
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: 'D',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: localeMap[locale] ?? 'en',
      backgroundColor: theme === 'dark' ? '#15242a' : '#f6eee3',
      gridColor: theme === 'dark' ? 'rgba(221,240,239,0.07)' : 'rgba(43,61,56,0.08)',
      allow_symbol_change: true,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      withdateranges: false,
      save_image: false,
      calendar: false,
    })
    script.onerror = () => setFailed(true)
    container.append(widget, script)
    mount.append(container)
    let settled = false
    const checkFrame = window.setInterval(() => {
      const frame = mount.querySelector('iframe')
      if (!frame) return
      try {
        if (frame.contentWindow?.location.href === 'about:blank') return
      } catch { /* A cross-origin document means the widget navigated successfully. */ }
      settled = true
      setLoaded(true)
      window.clearInterval(checkFrame)
    }, 350)
    const deadline = window.setTimeout(() => { if (!settled) setFailed(true); window.clearInterval(checkFrame) }, 8_000)
    return () => { window.clearInterval(checkFrame); window.clearTimeout(deadline); mount.replaceChildren() }
  }, [visible, theme, locale])

  return <section ref={rootRef} className={styles.root} aria-label="TradingView XAU/USD">
    {!bare && <div className={styles.heading}><div><span className={styles.eyebrow}>TRADINGVIEW / XAU·USD</span><h2>{label.title}</h2></div><a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer" aria-label="TradingView XAU/USD"><ArrowUpRight size={18} /></a></div>}
    <div className={styles.chart}>
      {(!visible || (!loaded && !failed)) && <div className={styles.placeholder} />}
      <div ref={mountRef} className={styles.widget} />
      {failed && <GoldFallback />}
    </div>
    <p className={styles.source}><a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer">{label.source}</a></p>
  </section>
}

function GoldFallback() {
  const { locale } = useI18n()
  const label = goldCopy[locale]
  const quote = useQuery('market-context:tv-fallback', getMarketContextView, { staleTime: 45_000 }).data?.anchors.find(item => item.symbol === 'GC=F')
  const asOf = quote?.asOf && !Number.isNaN(Date.parse(quote.asOf)) ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(quote.asOf)) : null
  return <div className={styles.error}>
    <span>{label.unavailable}</span>
    <small>{label.futures}</small>
    <strong dir="ltr">{quote?.value == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(quote.value)}</strong>
    <small>{quote ? `${quote.source}${asOf ? ` · ${asOf}` : ''} · ${quote.stale ? label.delayed : label.latest}` : ''}</small>
    <a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer">{label.open} <ArrowUpRight size={14} /></a>
  </div>
}
