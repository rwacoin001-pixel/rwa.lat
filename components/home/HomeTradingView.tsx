'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { useQuery } from '@/lib/api/_query'
import { getMarketContextView } from '@/lib/api/market-context'
import styles from './HomeTradingView.module.css'

const localeMap: Record<string, string> = { 'zh-CN': 'zh_CN', en: 'en', hi: 'en', es: 'es', ar: 'ar_AE', fr: 'fr', pt: 'pt' }

export function HomeTradingView({ bare = false }: { bare?: boolean } = {}) {
  const { theme } = useRwaTheme()
  const { locale } = useI18n()
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
    {!bare && <div className={styles.heading}><div><span className={styles.eyebrow}>TRADINGVIEW / XAU·USD</span><h2>{locale === 'zh-CN' ? '黄金行情' : 'Gold market'}</h2></div><a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer" aria-label="TradingView XAU/USD"><ArrowUpRight size={18} /></a></div>}
    <div className={styles.chart}>
      {(!visible || (!loaded && !failed)) && <div className={styles.placeholder} />}
      <div ref={mountRef} className={styles.widget} />
      {failed && <GoldFallback />}
    </div>
    <p className={styles.source}><a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer">XAU/USD {locale === 'zh-CN' ? '图表' : 'chart'}</a> by TradingView · {locale === 'zh-CN' ? '图表数据来自 TradingView' : 'Chart data by TradingView'}</p>
  </section>
}

function GoldFallback() {
  const { locale } = useI18n()
  const quote = useQuery('market-context:tv-fallback', getMarketContextView, { staleTime: 45_000 }).data?.anchors.find(item => item.symbol === 'GC=F')
  const asOf = quote?.asOf && !Number.isNaN(Date.parse(quote.asOf)) ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(quote.asOf)) : null
  return <div className={styles.error}>
    <span>{locale === 'zh-CN' ? 'XAU/USD 嵌入图表暂不可用' : 'XAU/USD embedded chart unavailable'}</span>
    <small>{locale === 'zh-CN' ? '下方为黄金期货 GC=F 报价' : 'Gold futures GC=F quote below'}</small>
    <strong dir="ltr">{quote?.value == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(quote.value)}</strong>
    <small>{quote ? `${quote.source}${asOf ? ` · ${asOf}` : ''} · ${quote.stale ? locale === 'zh-CN' ? '延迟' : 'Delayed' : locale === 'zh-CN' ? '最新' : 'Latest'}` : ''}</small>
    <a href="https://www.tradingview.com/symbols/XAUUSD/" target="_blank" rel="noopener noreferrer">{locale === 'zh-CN' ? '在 TradingView 查看图表' : 'Open chart on TradingView'} <ArrowUpRight size={14} /></a>
  </div>
}
