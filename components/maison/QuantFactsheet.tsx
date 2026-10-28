'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppLocale } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import type { QuantProduct } from '@/lib/api/quant'
import { usdtNumber } from './QuantParts'
import { useTween } from './QuantCover'
import f from './quant-factsheet.module.css'

/**
 * Product page head as a fund factsheet (2026-10-29, with Codex): the theme photo as a slim band, the since-inception
 * figure counting up beside a NAV line that draws itself, four key figures, then the rules as ruled rows. And the
 * drawdown chart ("underwater"), computed only from the settled index — running peak to today. All figures are the
 * API's; "—" when there is none.
 */
type Copy = { kind: string; since: string; asOf: (d: string) => string; d7: string; d30: string; mdd: string; running: string; daysN: (n: number) => string; min: string; cutoff: string; cutoffV: string; settle: string; settleV: string; fee: string; feeV: (m: string, p: string) => string; basis: string; ddTitle: string; ddSub: string; ddNow: string; ddWorst: string }
const zh: Copy = { kind: '量化策略 · 每日结算', since: '成立以来', asOf: (d) => `数据截至 ${d}`, d7: '近 7 天', d30: '近 30 天', mdd: '最大回撤', running: '已运行', daysN: (n) => `${n} 天`, min: '起投金额', cutoff: '申购截止', cutoffV: '每天 15:00（新加坡）', settle: '结算', settleV: '每日结算，收益到可用余额', fee: '费用', feeV: (m, p) => `管理费 ${m}%/年 · 业绩报酬 ${p}%`, basis: '净值已扣管理费、未扣你个人的业绩报酬；你自己的到账以结算记录为准。', ddTitle: '回撤', ddSub: '每天净值距离此前最高点的距离', ddNow: '当前', ddWorst: '最深' }
const en: Copy = { kind: 'Quant strategy · settled daily', since: 'Since inception', asOf: (d) => `As of ${d}`, d7: '7 days', d30: '30 days', mdd: 'Max drawdown', running: 'Running', daysN: (n) => `${n} days`, min: 'Minimum', cutoff: 'Cut-off', cutoffV: '15:00 daily (Singapore)', settle: 'Settlement', settleV: 'Daily, to your available balance', fee: 'Fees', feeV: (m, p) => `Management ${m}%/yr · performance ${p}%`, basis: 'NAV is after management fees and before your own performance fee; your own payouts follow your settlement records.', ddTitle: 'Drawdown', ddSub: 'How far each day’s NAV sits below its earlier peak', ddNow: 'Now', ddWorst: 'Deepest' }

const pct = (v: number | null | undefined) => v === null || v === undefined || Number.isNaN(v) ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`
const tone = (v: number | null | undefined) => !v ? undefined : v > 0 ? 'up' : 'down'
const bp = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')

function useSeen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, seen] as const
}

/** NAV points from inception (1.0000) through every settled day. */
const navOf = (product: QuantProduct) => [1, ...product.history.map((row) => Number(row.indexAfter))].filter((v) => Number.isFinite(v) && v > 0)

function line(values: number[], w: number, h: number, pad = 4) {
  const lo = Math.min(...values), hi = Math.max(...values), span = Math.max(hi - lo, 1e-6)
  return values.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2)).toFixed(1)},${(pad + (1 - (v - lo) / span) * (h - pad * 2)).toFixed(1)}`).join(' ')
}

export function QuantFactsheet({ product, locale }: { product: QuantProduct; locale: AppLocale }) {
  const t = locale === 'zh-CN' ? zh : en
  const { theme } = useRwaTheme()
  const shot = theme === 'dark' ? 'dark' : 'light'
  const p = product.performance
  const [ref, seen] = useSeen<HTMLElement>()
  const since = useTween(seen ? (p.sinceInceptionPct ?? 0) : 0, 900)
  const nav = useMemo(() => navOf(product), [product])
  const asOf = p.lastSettledDate ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${p.lastSettledDate}T00:00:00Z`)) : null
  return <section ref={ref} className={f.sheet} data-seen={seen || undefined} data-quant-photo="" aria-label={product.name}>
    <div className={f.band}>
      <img key={shot} src={`/media/quant/cover-${shot}-768.webp`} alt="" width={768} height={1152} decoding="async" />
      <span className={f.kind} data-glass="">{t.kind}</span>
      <h1>{product.name}</h1>
    </div>
    <div className={f.head}>
      <div>
        <small>{t.since}{asOf && <> · {t.asOf(asOf)}</>}</small>
        <b data-tone={tone(p.sinceInceptionPct)} dir="ltr">{p.sinceInceptionPct === null ? '—' : pct(since)}</b>
      </div>
      {nav.length > 2 && <svg className={f.spark} viewBox="0 0 132 56" aria-hidden="true"><path d={line(nav, 132, 56)} pathLength={1} /></svg>}
    </div>
    <dl className={f.kpis}>
      <div><dt>{t.d7}</dt><dd data-tone={tone(p.last7d.pct)} dir="ltr">{pct(p.last7d.pct)}</dd></div>
      <div><dt>{t.d30}</dt><dd data-tone={tone(p.last30d.pct)} dir="ltr">{pct(p.last30d.pct)}</dd></div>
      <div><dt>{t.mdd}</dt><dd data-tone={p.maxDrawdownPct ? 'down' : undefined} dir="ltr">{p.maxDrawdownPct === null ? '—' : `${p.maxDrawdownPct ? '−' : ''}${Math.abs(p.maxDrawdownPct).toFixed(2)}%`}</dd></div>
      <div><dt>{t.running}</dt><dd>{t.daysN(p.days)}</dd></div>
    </dl>
    <dl className={f.rules}>
      <div><dt>{t.min}</dt><dd>{usdtNumber(product.minSubscriptionAtomic, locale)} USDT</dd></div>
      <div><dt>{t.cutoff}</dt><dd>{t.cutoffV}</dd></div>
      <div><dt>{t.settle}</dt><dd>{t.settleV}</dd></div>
      <div><dt>{t.fee}</dt><dd>{t.feeV(bp(product.fees.managementBps), bp(product.fees.performanceBps))}</dd></div>
    </dl>
    <p className={f.basis}>{t.basis}</p>
  </section>
}

/** Underwater chart: each settled day's NAV against its running peak. Needs the full history from inception. */
export function QuantDrawdown({ product, locale }: { product: QuantProduct; locale: AppLocale }) {
  const t = locale === 'zh-CN' ? zh : en
  const [ref, seen] = useSeen<HTMLElement>()
  const dd = useMemo(() => {
    let peak = 1
    return navOf(product).map((v) => { peak = Math.max(peak, v); return (v / peak - 1) * 100 })
  }, [product])
  if (dd.length < 3) return null
  const worst = Math.min(...dd), now = dd[dd.length - 1]
  const depth = Math.max(Math.abs(worst), 0.05)
  const W = 340, H = 96
  const pts = dd.map((v, i) => [(i / (dd.length - 1)) * W, (Math.abs(v) / depth) * (H - 8)] as const)
  const area = `M0,0 ${pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} L${W},0 Z`
  const edge = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return <section ref={ref} className={f.dd} data-seen={seen || undefined} aria-label={t.ddTitle}>
    <header>
      <div><h2>{t.ddTitle}</h2><p>{t.ddSub}</p></div>
      <dl><div><dt>{t.ddNow}</dt><dd dir="ltr">{pct(now)}</dd></div><div><dt>{t.ddWorst}</dt><dd dir="ltr" data-tone={worst < 0 ? 'down' : undefined}>{pct(worst)}</dd></div></dl>
    </header>
    <svg viewBox={`0 -2 ${W} ${H + 4}`} className={f.ddSvg} role="img" aria-label={`${t.ddWorst} ${pct(worst)}`}>
      <line x1="0" y1="0" x2={W} y2="0" className={f.zero} />
      <g className={f.reveal}><path d={area} className={f.ddArea} /><path d={edge} className={f.ddEdge} /></g>
    </svg>
  </section>
}
