'use client'

// Maison motion kit. Libraries: motion (layout / gestures), @number-flow/react (rolling figures),
// @formkit/auto-animate (list enter/leave), lightweight-charts (TradingView, Apache-2.0).
// Every piece honours prefers-reduced-motion and renders real values only.
import NumberFlow, { type Format } from '@number-flow/react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
// lightweight-charts (~160KB) is imported inside PriceChart, so only screens that draw a chart download it.
import type { IChartApi, Time, UTCTimestamp } from 'lightweight-charts'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useRwaTheme } from '@/lib/rwa-theme'
import { requestTilt, startTilt } from '@/lib/device-tilt'
import styles from './maison.module.css'

export { useAutoAnimate }

/** Rolling figure. Flashes up/down against the previous value so live polls read at a glance. */
export function Figure({ value, format, locale, prefix, suffix, flash = true, className }: { value: number | null | undefined; format?: Format; locale?: string; prefix?: string; suffix?: string; flash?: boolean; className?: string }) {
  const previous = useRef<number | null>(null)
  const [tick, setTick] = useState<{ dir: 'up' | 'down'; n: number } | null>(null)
  const finite = value != null && Number.isFinite(value)
  useEffect(() => {
    if (!finite) return
    const before = previous.current
    previous.current = value
    if (flash && before !== null && before !== value) setTick((current) => ({ dir: value > before ? 'up' : 'down', n: (current?.n ?? 0) + 1 }))
  }, [finite, flash, value])
  if (!finite) return <span className={`${styles.num} ${className ?? ''}`}>—</span>
  return <span className={`${styles.num} ${styles.figure} ${className ?? ''}`}>
    {tick && <i key={tick.n} className={styles.flash} data-flash={tick.dir} aria-hidden="true" />}
    <span className={styles.srOnly} data-figure-text="">{`${prefix ?? ''}${new Intl.NumberFormat(locale, format).format(value)}${suffix ?? ''}`}</span>
    <span aria-hidden="true"><NumberFlow value={value} format={format} locales={locale} prefix={prefix} suffix={suffix} willChange /></span>
  </span>
}

/** Static amount with the decimals one step down, matching <Figure>. Takes an already formatted string. */
export function Amount({ text, className }: { text: string; className?: string }) {
  const match = /^(.*\d)([.,]\d+)(\D*)$/.exec(text)
  return <span className={`${styles.num} ${className ?? ''}`}>{match ? <>{match[1]}<span className={styles.fraction}>{match[2]}</span>{match[3]}</> : text}</span>
}

/** Segmented control with a sliding thumb (shared layout animation). */
export function Segmented<T extends string>({ value, options, onChange, label, sticky = false, role = 'tablist' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void; label: string; sticky?: boolean; role?: 'tablist' | 'group' }) {
  const id = useId()
  const reduced = useReducedMotion()
  const track = <div className={styles.segment} data-sticky={sticky} role={role} aria-label={label} style={{ ['--m-seg-count' as string]: options.length }}>
      {options.map((option) => {
        const selected = option.value === value
        return <button key={option.value} type="button" role={role === 'tablist' ? 'tab' : undefined} aria-selected={role === 'tablist' ? selected : undefined} aria-pressed={role === 'group' ? selected : undefined} onClick={() => onChange(option.value)}>
          {selected && <motion.i className={styles.segThumb} layoutId="thumb" transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }} />}
          <span>{option.label}</span>
        </button>
      })}
    </div>
  // Sticky tracks sit in a full-bleed dock so nothing scrolls visibly above or beside them once pinned.
  return <LayoutGroup id={id}>{sticky ? <StickyDock>{track}</StickyDock> : track}</LayoutGroup>
}

/** Marks the dock `data-stuck` while it is pinned, so the status-bar cover above it only shows then. */
function StickyDock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const check = () => {
      frame = 0
      // Pinned once the dock's natural spot (the bottom of whatever precedes it) has scrolled above the pin line.
      const pin = parseFloat(getComputedStyle(el).top) || 0
      const before = el.previousElementSibling?.getBoundingClientRect().bottom ?? el.parentElement?.getBoundingClientRect().top ?? 0
      const stuck = before < pin - .5
      if (stuck) el.dataset.stuck = ''
      else delete el.dataset.stuck
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check) }
    check()
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule, { capture: true }); window.removeEventListener('resize', schedule) }
  }, [])
  return <div ref={ref} className={styles.segmentDock}>{children}</div>
}

/**
 * Lacquer surface: brushed texture, gyro-lit shadow and highlight, and a slight 3D lean toward a pressing finger.
 * The first press also asks iOS for motion access (it must come from a gesture).
 */
export function Lacquer({ children, className, style, as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; style?: CSSProperties; as?: 'section' | 'div'; 'aria-live'?: 'polite' }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { startTilt() }, [])
  const move = (event: PointerEvent<HTMLElement>) => {
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const fx = (event.clientX - rect.left) / rect.width
    const fy = (event.clientY - rect.top) / rect.height
    node.style.setProperty('--mx', `${(fx * 100).toFixed(1)}%`)
    node.style.setProperty('--my', `${(fy * 100).toFixed(1)}%`)
    node.style.setProperty('--px', (fx * 2 - 1).toFixed(3))
    node.style.setProperty('--py', (fy * 2 - 1).toFixed(3))
  }
  const press = (event: PointerEvent<HTMLElement>) => { move(event); requestTilt(); ref.current?.setAttribute('data-pressed', 'true') }
  const release = () => ref.current?.removeAttribute('data-pressed')
  return <Tag ref={ref as never} className={`${styles.lacquer} ${className ?? ''}`} style={style} onPointerMove={move} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onPointerLeave={release} {...rest}>{children}</Tag>
}

/** Hairline that drains until the next poll — makes "live" data honest about its cadence. */
export function PollBar({ every, stamp, label, elapsed = 0 }: { every: number; stamp: string | number | null | undefined; label?: string; elapsed?: number }) {
  return <span className={styles.pollBar} role="presentation" title={label}>
    <i key={String(stamp ?? '')} style={{ animationDuration: `${every}ms`, animationDelay: `${-Math.max(0, Math.min(elapsed, every))}ms` }} />
  </span>
}

/** Dense metric strip: label over value, hairline separators, scrolls sideways when it must. */
export function StatStrip({ items, fit = false }: { items: { label: ReactNode; value: ReactNode; tone?: 'up' | 'down' }[]; fit?: boolean }) {
  return <dl className={styles.statStrip} data-fit={fit || undefined}>{items.map((item, index) => <div key={index}>
    <dt>{item.label}</dt><dd className={`${styles.num} ${item.tone ? styles[item.tone] : ''}`}>{item.value}</dd>
  </div>)}</dl>
}

/** Continuous marquee of quotes; duplicated once so the loop is seamless. Pauses on hover / reduced motion. */
export function TickerTape({ items, label }: { items: { key: string; name: ReactNode; value: ReactNode; delta?: ReactNode; onClick?: () => void }[]; label: string }) {
  // Before the quotes arrive, an empty strip of the same height holds the place, so the page below doesn't jump.
  if (!items.length) return <div className={styles.tape} aria-hidden="true" />
  const track = (hidden: boolean) => items.map((item) => <button key={`${hidden ? 'b' : 'a'}${item.key}`} type="button" tabIndex={hidden ? -1 : 0} aria-hidden={hidden || undefined} onClick={item.onClick}>
    <b>{item.name}</b><span className={styles.num}>{item.value}</span>{item.delta}
  </button>)
  return <div className={styles.tape} role="region" aria-label={label} style={{ ['--m-tape-s' as string]: `${Math.max(18, items.length * 5)}s` }}>
    <div>{track(false)}{track(true)}</div>
  </div>
}

// ── Charts ───────────────────────────────────────────────────────────────────

export type ChartPoint = { time: number; value: number }
export type ChartCandle = { time: number; open: number; high: number; low: number; close: number; volume?: number }

function palette(node: HTMLElement) {
  const css = getComputedStyle(node)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return { accent: v('--m-accent'), up: v('--m-up'), down: v('--m-down'), faint: v('--m-faint'), line: v('--m-line-soft'), ink: v('--m-ink'), bg: v('--m-bg') }
}

function alpha(color: string, a: number) {
  return color.startsWith('#') && color.length === 7 ? `${color}${Math.round(a * 255).toString(16).padStart(2, '0')}` : color
}

function dedupe<T extends { time: number }>(rows: T[]) {
  const map = new Map<number, T>()
  for (const row of rows) if (Number.isFinite(row.time)) map.set(Math.floor(row.time), { ...row, time: Math.floor(row.time) })
  return [...map.values()].sort((a, b) => a.time - b.time)
}

/**
 * Professional price chart (TradingView lightweight-charts). Area for single-value series, candles + volume for OHLC.
 * Callers pass ≥2 real points; the legend shows the hovered value or, at rest, the last value and range change.
 */
export function PriceChart({ points, candles, height = 188, digits = 2, locale, label, unit }: { points?: ChartPoint[]; candles?: ChartCandle[]; height?: number; digits?: number; locale: string; label: string; unit?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const { theme } = useRwaTheme()
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<{ time: number; value: number } | null>(null)
  const area = useMemo(() => dedupe(points ?? []), [points])
  const ohlc = useMemo(() => dedupe(candles ?? []), [candles])
  const closes = ohlc.length ? ohlc.map((row) => ({ time: row.time, value: row.close })) : area
  const first = closes[0]?.value
  const last = closes[closes.length - 1]?.value
  const change = first && last != null ? (last - first) / first : null

  useEffect(() => {
    const node = host.current
    if (!node || closes.length < 2) return
    const c = palette(node)
    let disposed = false
    let built: IChartApi | null = null
    void import('lightweight-charts').then(({ AreaSeries, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineStyle, createChart }) => {
      if (disposed) return
      const chart = createChart(node, {
        autoSize: true,
        height,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: c.faint, fontSize: 10, fontFamily: 'var(--font-geist-sans), system-ui', attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { color: c.line, style: LineStyle.Dotted } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: .14, bottom: ohlc.length ? .24 : .08 } },
        timeScale: { borderVisible: false, timeVisible: ohlc.length > 0, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
        crosshair: { mode: CrosshairMode.Magnet, vertLine: { color: alpha(c.accent, .5), labelBackgroundColor: c.accent, style: LineStyle.Solid, width: 1 }, horzLine: { color: alpha(c.accent, .35), labelBackgroundColor: c.accent, style: LineStyle.Dashed } },
        handleScroll: { vertTouchDrag: false, horzTouchDrag: true, mouseWheel: false, pressedMouseMove: true },
        handleScale: { pinch: true, mouseWheel: false, axisPressedMouseMove: false },
        localization: { locale, priceFormatter: (price: number) => price.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits }) },
      })
      built = chart
      chartRef.current = chart
      let main
      if (ohlc.length) {
        main = chart.addSeries(CandlestickSeries, { upColor: c.up, downColor: c.down, borderVisible: false, wickUpColor: c.up, wickDownColor: c.down, priceLineColor: c.accent, priceLineStyle: LineStyle.Dotted })
        main.setData(ohlc.map((row) => ({ time: row.time as UTCTimestamp, open: row.open, high: row.high, low: row.low, close: row.close })))
        if (ohlc.some((row) => row.volume)) {
          const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false })
          chart.priceScale('vol').applyOptions({ scaleMargins: { top: .82, bottom: 0 } })
          volume.setData(ohlc.map((row) => ({ time: row.time as UTCTimestamp, value: row.volume ?? 0, color: alpha(row.close >= row.open ? c.up : c.down, .35) })))
        }
      } else {
        main = chart.addSeries(AreaSeries, { lineColor: c.accent, lineWidth: 2, topColor: alpha(c.accent, .28), bottomColor: alpha(c.accent, 0), priceLineVisible: false, lastValueVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: c.bg, crosshairMarkerBackgroundColor: c.accent })
        main.setData(area.map((row) => ({ time: row.time as UTCTimestamp, value: row.value })))
      }
      chart.timeScale().fitContent()
      const series = main
      chart.subscribeCrosshairMove((param) => {
        const data = param.time ? param.seriesData.get(series) : undefined
        if (!data || !param.time) { setHover(null); return }
        const value = 'close' in data && typeof data.close === 'number' ? data.close : 'value' in data && typeof data.value === 'number' ? data.value : null
        setHover(value == null ? null : { time: Number(param.time as Time), value })
      })
    }).catch(() => { /* The legend still shows the last value if the chart code cannot load. */ })
    return () => { disposed = true; built?.remove(); chartRef.current = null }
  }, [area, closes.length, digits, height, locale, ohlc, theme])

  const shown = hover ?? (last != null ? { time: closes[closes.length - 1].time, value: last } : null)
  const fmt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits })
  return <figure className={styles.priceChart} aria-label={label}>
    <figcaption className={styles.chartLegend} aria-live="off">
      <b className={styles.num}>{shown ? fmt(shown.value) : '—'}{unit && <small>{unit}</small>}</b>
      {!hover && change != null && Number.isFinite(change) && <span className={`${styles.num} ${change > 0 ? styles.up : change < 0 ? styles.down : styles.flat}`}>{change > 0 ? '+' : ''}{(change * 100).toFixed(2)}%</span>}
      {shown && <time className={styles.num}>{new Date(shown.time * 1000).toLocaleString(locale, ohlc.length ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' })}</time>}
    </figcaption>
    <motion.div className={styles.chartHost} initial={reduced ? false : { clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: reduced ? 0 : .9, ease: [.22, .8, .18, 1] }}>
      <div ref={host} style={{ height }} />
    </motion.div>
  </figure>
}

/** Cumulative depth curve from a real order book; bids left, asks right, mid gap in between. */
export function DepthChart({ bids, asks, label }: { bids: { price: number; quantity: number }[]; asks: { price: number; quantity: number }[]; label: string }) {
  const reduced = useReducedMotion()
  const width = 320, height = 96
  const b = [...bids].sort((x, y) => y.price - x.price)
  const a = [...asks].sort((x, y) => x.price - y.price)
  if (!b.length && !a.length) return null
  const cum = (rows: typeof b) => { let total = 0; return rows.map((row) => ({ price: row.price, total: (total += row.quantity) })) }
  const cb = cum(b), ca = cum(a)
  const prices = [...cb, ...ca].map((row) => row.price)
  const lo = Math.min(...prices), hi = Math.max(...prices), span = hi - lo || 1
  const top = Math.max(cb[cb.length - 1]?.total ?? 0, ca[ca.length - 1]?.total ?? 0) || 1
  const x = (price: number) => (price - lo) / span * width
  const y = (total: number) => height - total / top * (height - 8)
  const stepped = (rows: { price: number; total: number }[]) => rows.map((row, index) => `${index ? `L${x(row.price).toFixed(1)},${y(rows[index - 1].total).toFixed(1)} ` : ''}L${x(row.price).toFixed(1)},${y(row.total).toFixed(1)}`).join(' ')
  const bidPath = cb.length ? `M${x(cb[0].price).toFixed(1)},${height} ${stepped(cb)} L${x(cb[cb.length - 1].price).toFixed(1)},${height} Z` : ''
  const askPath = ca.length ? `M${x(ca[0].price).toFixed(1)},${height} ${stepped(ca)} L${x(ca[ca.length - 1].price).toFixed(1)},${height} Z` : ''
  return <svg className={styles.depth} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
    {bidPath && <motion.path d={bidPath} data-side="bid" initial={reduced ? false : { opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} style={{ originY: 1 }} transition={{ duration: .6, ease: [.22, .8, .18, 1] }} />}
    {askPath && <motion.path d={askPath} data-side="ask" initial={reduced ? false : { opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} style={{ originY: 1 }} transition={{ duration: .6, delay: .08, ease: [.22, .8, .18, 1] }} />}
  </svg>
}

/** Staggered entrance for a group of blocks. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion()
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '0px 0px -8% 0px' }} transition={{ duration: .55, delay, ease: [.22, .8, .18, 1] }}>{children}</motion.div>
}
