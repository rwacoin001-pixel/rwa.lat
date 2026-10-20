'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { CalendarClock, Coins, Percent, Target } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { QuantProduct } from '@/lib/api/quant'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import { formatPct, shortDate, type Tick } from '@/lib/quant-view-model'
import { usdtNumber, useTween } from './QuantParts'
import styles from './quant-charts.module.css'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** True once the element has scrolled into view (and stays true), so a chart draws itself when it is first seen. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect() } }, { rootMargin: '0px 0px -8% 0px' })
    observer.observe(el)
    const fallback = window.setTimeout(() => setSeen(true), 1800)
    return () => { observer.disconnect(); window.clearTimeout(fallback) }
  }, [])
  return [ref, seen] as const
}

/** A tweened percentage, split so the % sign can be set smaller. */
function TweenPct({ value, className }: { value: number | null; className?: string }) {
  const tween = useTween(value, 900)
  const text = value === null ? '—' : formatPct(tween ?? 0)
  const [body, sign] = text.endsWith('%') ? [text.slice(0, -1), '%'] : [text, '']
  return <b className={`${className ?? ''} ${value !== null && value < 0 ? styles.down : ''}`}>{body}{sign && <small>{sign}</small>}</b>
}

/** Scale for a sub-dial: the smallest of 1/2/5/10/20/50/100 % that leaves the figure some room before the end stop. */
function subScale(value: number | null) {
  const need = Math.abs(value ?? 0) * 1.3
  return [1, 2, 5, 10, 20, 50, 100].find((step) => step >= need) ?? 100
}
const SWEEP = 135
const at = (radius: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180
  return [50 + Math.sin(a) * radius, 50 - Math.cos(a) * radius] as const
}

/**
 * One chronograph sub-dial: a 270° scale from 0 to a round end stop, a gold arc and a needle that sweeps to the figure
 * when it first comes into view, and the figure in the lower window. Drawdown runs the same way, in the loss colour.
 */
function SubDial({ label, short, value, note, loss, index }: { label: string; short: string; value: number | null; note: string | null; loss?: boolean; index: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>()
  const [flick, setFlick] = useState(0)
  const scale = subScale(value)
  const share = value === null ? 0 : Math.min(1, Math.abs(value) / scale)
  const angle = -SWEEP + share * SWEEP * 2
  const [ax, ay] = at(37, -SWEEP)
  const [bx, by] = at(37, angle)
  const arc = share > 0 ? `M${ax.toFixed(2)},${ay.toFixed(2)} A37,37 0 ${share * 270 > 180 ? 1 : 0} 1 ${bx.toFixed(2)},${by.toFixed(2)}` : ''
  const [l0x, l0y] = at(30, -SWEEP + 30)
  const [l1x, l1y] = at(30, SWEEP - 30)
  return <div ref={ref} className={styles.sub} onClick={() => setFlick((value) => value + 1)} data-seen={seen || undefined} data-loss={loss || undefined} style={{ '--i': index, '--a': `${seen ? angle : -SWEEP}deg` } as CSSProperties}>
    <div className={styles.subDial}>
      <i className={styles.subBezel} aria-hidden="true" />
      <i className={styles.subFace} aria-hidden="true" />
      <svg viewBox="0 0 100 100" className={styles.subSvg} aria-hidden="true">
        {Array.from({ length: 55 }, (_, i) => {
          const deg = -SWEEP + i * 5
          const major = i % 9 === 0
          const [x1, y1] = at(major ? 40 : 42, deg)
          const [x2, y2] = at(45, deg)
          return <line key={i} className={styles.subTick} data-major={major || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
        {flick > 0 && <circle key={`ring-${flick}`} className={styles.subRipple} cx="50" cy="50" r="36" pathLength={1} />}
        <circle className={styles.subTrack} cx="50" cy="50" r="37" pathLength={360} strokeDasharray="270 90" transform="rotate(135 50 50)" />
        {arc && <path className={styles.subArc} d={arc} pathLength={1} />}
        <text className={styles.subNum} x={l0x} y={l0y + 3}>0</text>
        <text className={styles.subNum} x={l1x} y={l1y + 3}>{loss ? `−${scale}` : scale}</text>
        <text className={styles.subShort} x="50" y="33">{short}</text>
        <g key={flick} className={styles.subNeedle} data-needle="" data-flicked={flick > 0 || undefined}>
          <line x1="50" y1="57" x2="50" y2="15" />
          <circle cx="50" cy="50" r="3.2" />
          <circle className={styles.subPin} cx="50" cy="50" r="1.2" />
        </g>
      </svg>
      <div className={styles.subWindow}><TweenPct value={value} /></div>
    </div>
    <span className={styles.subLabel}>{label}</span>
    {note && <em className={styles.subNote}>{note}</em>}
  </div>
}

/** Three sub-dials under the main dial, like a chronograph's: the last week, the last month and the worst fall. */
export function QuantKpis({ product, c, compact }: { product: QuantProduct; c: QuantCopy; compact?: boolean }) {
  const p = product.performance
  return <div className={compact ? styles.compactSubs : styles.subs}>
    <SubDial index={0} label={c.last7} short="7D" value={p.last7d.pct} note={p.last7d.coveredDays < p.last7d.days ? c.partial(p.last7d.coveredDays) : null} />
    <SubDial index={1} label={c.last30} short="30D" value={p.last30d.pct} note={p.last30d.coveredDays < p.last30d.days ? c.partial(p.last30d.coveredDays) : null} />
    <SubDial index={2} label={c.drawdown} short="MDD" value={p.maxDrawdownPct} note={null} loss />
  </div>
}

type Point = { date: string; value: number; nav: number; tick: number | null }

/** Catmull-Rom through the points, written as cubic Béziers: a smooth line that still passes through every settled day. */
function smooth(points: Array<[number, number]>) {
  if (points.length < 2) return points.length ? `M${points[0][0]},${points[0][1]}` : ''
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [points[i - 1] ?? points[i], points[i], points[i + 1], points[i + 2] ?? points[i + 1]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return d
}

function usePoints(product: QuantProduct, ticks: Tick[]): Point[] {
  return useMemo(() => {
    const byDate = new Map(ticks.map((tick, index) => [tick.date, index]))
    return [...product.history]
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct), nav: Number(row.indexAfter), tick: byDate.get(row.tradeDate) ?? null }))
  }, [product.history, ticks])
}

/**
 * Scrubbing: a sideways drag across a chart walks the days (and turns the dial with them); an up-and-down drag is left to
 * the page so it still scrolls.
 */
function useScrub(count: number, onIndex: (index: number) => void) {
  const state = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null)
  const at = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)))
    onIndex(Math.round(ratio * (count - 1)))
  }
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      state.current = { id: event.pointerId, x: event.clientX, y: event.clientY, active: event.pointerType === 'mouse' }
      if (event.pointerType === 'mouse') at(event)
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const s = state.current
      if (!s || s.id !== event.pointerId) return
      if (!s.active) {
        const dx = Math.abs(event.clientX - s.x)
        const dy = Math.abs(event.clientY - s.y)
        if (dy > 8 && dy > dx) { state.current = null; return }
        if (dx < 6) return
        s.active = true
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
      }
      at(event)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const s = state.current
      state.current = null
      if (s && !s.active) at(event)
    },
    onPointerCancel: () => { state.current = null },
  }
}

const W = 340
const H = 150
const PAD = { top: 22, bottom: 8, left: 34, right: 8 }

/** Net value since inception as a gold line over a soft fill. The picked day (shared with the dial) is marked; drag to scrub. */
export function QuantNavChart({ product, ticks, selected, onSelect, c }: { product: QuantProduct; ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; c: QuantCopy }) {
  const points = usePoints(product, ticks)
  const [ref, seen] = useSeen<HTMLDivElement>()
  const series = useMemo(() => [{ date: '', value: 0, nav: 1, tick: null } as Point, ...points], [points])
  const navs = series.map((point) => point.nav)
  const low = Math.min(...navs)
  const high = Math.max(...navs)
  const span = Math.max(high - low, .002)
  const x = (i: number) => PAD.left + (i / Math.max(1, series.length - 1)) * (W - PAD.left - PAD.right)
  const y = (nav: number) => PAD.top + (1 - (nav - low) / span) * (H - PAD.top - PAD.bottom)
  const xy = series.map((point, i) => [x(i), y(point.nav)] as [number, number])
  const line = smooth(xy)
  const area = `${line} L${x(series.length - 1)},${H - PAD.bottom} L${x(0)},${H - PAD.bottom} Z`
  const pickedDate = selected !== null ? ticks[selected]?.date : null
  const found = pickedDate ? series.findIndex((point) => point.date === pickedDate) : -1
  const active = found >= 1 ? found : series.length - 1
  const focus = series[active] ?? series[series.length - 1]
  const scrub = useScrub(points.length, (index) => {
    const tick = points[index]?.tick
    if (tick === null || tick === undefined) return
    onSelect(tick === ticks.length - 1 ? null : tick)
  })
  if (points.length < 2) return null

  const [fx, fy] = xy[active] ?? xy[xy.length - 1]
  const left = `${(fx / W) * 100}%`
  return <section className={styles.card} aria-label={c.charts.navTitle}>
    <header className={styles.head}>
      <div><h2>{c.charts.navTitle}</h2><p>{c.charts.navSub}</p></div>
      <div className={styles.readout} key={focus.date}>
        <span>{shortDate(focus.date)}</span>
        <b>{focus.nav.toFixed(4)}</b>
      </div>
    </header>
    <div ref={ref} className={styles.plot} data-seen={seen || undefined} {...scrub}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} aria-hidden="true">
        <defs>
          <linearGradient id="qNavFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--q-gold)" stopOpacity=".32" />
            <stop offset="1" stopColor="var(--q-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, .5, 1].map((k) => {
          const gy = PAD.top + k * (H - PAD.top - PAD.bottom)
          return <g key={k}>
            <line className={styles.grid} x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} />
            <text className={styles.yLabel} x={PAD.left - 6} y={gy + 3}>{(high - k * span).toFixed(3)}</text>
          </g>
        })}
        <line className={styles.base} x1={PAD.left} x2={W - PAD.right} y1={y(1)} y2={y(1)} />
        <path className={styles.area} d={area} fill="url(#qNavFill)" />
        <path className={styles.line} d={line} pathLength={1} />
        <line className={styles.cursor} x1={fx} x2={fx} y1={PAD.top - 6} y2={H - PAD.bottom} />
        <circle className={styles.halo} cx={fx} cy={fy} r="9" />
        <circle className={styles.dot} cx={fx} cy={fy} r="3.4" />
      </svg>
      <div className={styles.tip} style={{ left, transform: `translateX(${fx / W > .84 ? -92 : fx / W < .2 ? -8 : -50}%)` }}><span className={focus.value < 0 ? styles.down : styles.up}>{formatPct(focus.value)}</span></div>
    </div>
    <DateAxis dates={points.map((point) => point.date)} left={`${(PAD.left / W) * 100}%`} right={`${(PAD.right / W) * 100}%`} />
  </section>
}

/** Five evenly spaced dates under a chart (first and last always shown). */
function DateAxis({ dates, left, right }: { dates: string[]; left: string; right: string }) {
  const marks = dates.length <= 5 ? dates.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((k / 4) * (dates.length - 1)))
  return <div className={styles.dates} style={{ marginInline: `${left} ${right}` }}>
    {marks.map((index) => <span key={index} style={{ left: `${dates.length > 1 ? (index / (dates.length - 1)) * 100 : 0}%` }}>{shortDate(dates[index])}</span>)}
  </div>
}

/** One bar per settled day on a shared zero line, gold above and terracotta below. Tap or drag picks the day for the whole page. */
export function QuantDailyBars({ product, ticks, selected, onSelect, c }: { product: QuantProduct; ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; c: QuantCopy }) {
  const points = usePoints(product, ticks)
  const [ref, seen] = useSeen<HTMLDivElement>()
  const top = Math.max(...points.map((point) => point.value), 0.05)
  const bottom = Math.min(...points.map((point) => point.value), 0)
  const range = top - bottom
  const zero = (top / range) * 100
  const pickedDate = selected !== null ? ticks[selected]?.date : null
  const activeIndex = pickedDate ? points.findIndex((point) => point.date === pickedDate) : -1
  const focus = activeIndex >= 0 ? points[activeIndex] : points[points.length - 1]
  const choose = (index: number) => {
    const tick = points[index]?.tick
    if (tick === null || tick === undefined) return
    onSelect(tick === ticks.length - 1 ? null : tick)
  }
  const scrub = useScrub(points.length, choose)
  const gains = points.filter((point) => point.value > 0).length
  if (points.length === 0) return null

  return <section className={styles.card} aria-label={c.charts.dailyTitle}>
    <header className={styles.head}>
      <div><h2>{c.charts.dailyTitle}</h2><p>{c.charts.dailySub}</p></div>
      <div className={styles.readout} key={focus.date}>
        <span>{activeIndex >= 0 ? shortDate(focus.date) : `${c.charts.latest} · ${shortDate(focus.date)}`}</span>
        <b className={focus.value < 0 ? styles.down : styles.up}>{formatPct(focus.value)}</b>
      </div>
    </header>
    <div ref={ref} className={styles.bars} data-seen={seen || undefined} data-picking={activeIndex >= 0 || undefined} style={{ '--zero': `${zero}%` } as CSSProperties} {...scrub}>
      <i className={styles.zero} />
      {points.map((point, index) => {
        const size = (Math.abs(point.value) / range) * 100
        return <button
          key={point.date}
          type="button"
          tabIndex={-1}
          className={styles.barCol}
          data-kind={point.value > 0 ? 'gain' : point.value < 0 ? 'loss' : 'flat'}
          data-on={point.date === focus.date || undefined}
          aria-label={`${point.date} · ${formatPct(point.value)}`}
          onClick={() => choose(index)}
        >
          <i style={{ '--h': `${Math.max(size, 1.2)}%`, '--i': index } as CSSProperties} />
        </button>
      })}
    </div>
    <DateAxis dates={points.map((point) => point.date)} left={`${50 / points.length}%`} right={`${50 / points.length}%`} />
    <div className={styles.axis}>
      <span className={styles.tally}><i data-kind="gain" />{c.legend.gain} {gains}<i data-kind="loss" />{c.legend.loss} {points.length - gains}</span>
      <span>{c.recorded(points.length)}</span>
    </div>
  </section>
}

/** The four facts people ask first, as tiles: target, minimum, how settlement works, and the fees. */
export function QuantHighlights({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const { locale } = useI18n()
  const pct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, '')
  const tiles = [
    product.target && { icon: Target, label: c.charts.target, value: c.charts.targetValue(product.target.annualMinPct, product.target.annualMaxPct), sub: c.targetNote },
    { icon: Coins, label: c.charts.minimum, value: `${usdtNumber(product.minSubscriptionAtomic, locale)}`, unit: 'USDT', sub: c.view.summaryMinimum },
    { icon: CalendarClock, label: c.charts.settle, value: c.charts.settleValue, sub: c.charts.settleSub(product.cutoffTime) },
    { icon: Percent, label: c.charts.fees, value: c.charts.feesValue(pct(product.fees.managementBps), pct(product.fees.performanceBps)), sub: c.charts.feesSub },
  ].filter(Boolean) as Array<{ icon: typeof Target; label: string; value: string; unit?: string; sub: string }>
  return <section className={styles.hl} aria-label={c.charts.highlightsTitle}>
    <h2 className={styles.hlTitle}>{c.charts.highlightsTitle}</h2>
    <div className={styles.tiles}>
      {tiles.map(({ icon: Icon, label, value, unit, sub }, index) => <div key={label} className={styles.tile} style={{ '--i': index } as CSSProperties}>
        <span className={styles.tileIcon}><Icon size={15} strokeWidth={1.6} aria-hidden="true" /></span>
        <small>{label}</small>
        <b>{value}{unit && <em>{unit}</em>}</b>
        <p>{sub}</p>
      </div>)}
    </div>
  </section>
}

/** Glass panel for the long-form blocks below the charts. */
export function QuantPanel({ children }: { children: React.ReactNode }) {
  return <div className={styles.panel}>{children}</div>
}

/** "Settled to …" as a small live pill with a breathing dot. */
export function QuantStatus({ product, c }: { product: QuantProduct; c: QuantCopy }) {
  const last = product.performance.lastSettledDate
  return <span className={styles.status} data-live={product.open || undefined}>
    <i aria-hidden="true" />
    {last ? `${c.settledTo} ${shortDate(last)}` : c.neverSettled}
  </span>
}
