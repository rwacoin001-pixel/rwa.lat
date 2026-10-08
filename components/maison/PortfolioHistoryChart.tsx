'use client'

import { MoveHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { usePageState } from '@/lib/app-navigation'
import type { AppLocale } from '@/lib/app-locales'
import { historyInteractionCopy, type HistoryRange } from '@/lib/history-interaction-copy'
import { fill } from '@/lib/maison-market-copy'
import { portfolioCopy } from '@/lib/maison-portfolio-copy'
import { AMOUNT_MASK, useAmountMask } from '@/lib/use-amount-mask'
import { Segmented, type ChartPoint } from './motion'
import { StateBlock, maison as s } from './primitives'
import { fmtDate, fmtDateTime } from './format'
import c from './history-interaction.module.css'

const RANGES: HistoryRange[] = ['7', '30', '90', 'all']
const DAY = 86_400
const W = 340, H = 180, PAD_X = 12, PAD_Y = 14
const HOLD_MS = 280, SLOP_PX = 8, SPEAK_MS = 500

type Gesture = { id: number; x: number; y: number; lastX: number; rect: DOMRect; active: boolean; node: SVGSVGElement }

// Capture lives on the node that took it, which may already be replaced by a range switch.
const release = (g: Gesture | null) => {
  try { if (g?.node.hasPointerCapture(g.id)) g.node.releasePointerCapture(g.id) } catch { /* already released */ }
}

const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

/**
 * History chart for `/assets`. Receives the real, deduplicated snapshots from `useHistory`; it only filters them by
 * range and never adds points. Reading a value changes the chart caption only, never the totals above it.
 */
export function PortfolioHistoryChart({ points, locale, unit = 'USDT' }: { points: ChartPoint[]; locale: AppLocale; unit?: string }) {
  const t = historyInteractionCopy[locale]
  const p = portfolioCopy[locale]
  const { masked } = useAmountMask()
  const [range, setRange] = usePageState<HistoryRange>('portfolio:history-range', '30')
  const [index, setIndex] = useState<number | null>(null)
  const [mode, setMode] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [said, setSaid] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const hold = useRef<number | undefined>(undefined)
  const raf = useRef<number | undefined>(undefined)
  const source = useRef<'pointer' | 'key'>('pointer')

  // Ranges are measured back from the real current time; a stale record simply falls out of short ranges.
  const data = useMemo(() => {
    if (range === 'all') return points
    const cutoff = Date.now() / 1000 - Number(range) * DAY
    return points.filter((point) => point.time >= cutoff)
  }, [points, range])
  const n = data.length - 1
  const money = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale])
  const amount = (value: number) => masked ? AMOUNT_MASK : money.format(value)

  const geo = useMemo(() => {
    if (data.length < 2) return null
    const t0 = data[0].time, t1 = data[n].time
    const values = data.map((point) => point.value)
    let lo = Math.min(...values), hi = Math.max(...values)
    if (hi === lo) { lo -= 1; hi += 1 }
    const pts = data.map((point) => ({
      x: PAD_X + (point.time - t0) / (t1 - t0) * (W - PAD_X * 2),
      y: PAD_Y + (hi - point.value) / (hi - lo) * (H - PAD_Y * 2),
    }))
    const line = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    return { pts, line, area: `${line} L${W - PAD_X},${H} L${PAD_X},${H} Z` }
  }, [data, n])

  const reading = index !== null && index <= n
  const cur = reading ? index : n

  const clearTimers = useCallback(() => {
    window.clearTimeout(hold.current)
    if (raf.current !== undefined) cancelAnimationFrame(raf.current)
    hold.current = raf.current = undefined
  }, [])

  const endPress = useCallback((keep: boolean) => {
    clearTimers()
    const g = gesture.current
    gesture.current = null
    release(g)
    setPressing(false)
    if (!keep) setIndex(null)
  }, [clearTimers])

  const exit = useCallback(() => { endPress(false); setMode(false) }, [endPress])

  // Nearest real snapshot to the pointer, by timestamp; coalesced to one update per frame.
  const read = (clientX: number) => {
    const g = gesture.current
    if (!g || !geo) return
    const x = (clientX - g.rect.left) / g.rect.width * W
    let best = 0
    for (let i = 1; i <= n; i++) if (Math.abs(geo.pts[i].x - x) < Math.abs(geo.pts[best].x - x)) best = i
    if (raf.current !== undefined) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => { raf.current = undefined; source.current = 'pointer'; setIndex(best) })
  }

  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (!svg.current || event.button > 0 || gesture.current) return
    const g: Gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, rect: svg.current.getBoundingClientRect(), active: false, node: svg.current }
    gesture.current = g
    const go = () => {
      if (gesture.current !== g) return
      g.active = true
      setPressing(true)
      try { g.node.setPointerCapture(g.id) } catch { /* pointer gone */ }
      read(g.lastX)
    }
    // Mouse and explicit reading mode read at once; touch needs a still hold so vertical swipes keep scrolling the page.
    if (mode || event.pointerType === 'mouse') go()
    else hold.current = window.setTimeout(go, HOLD_MS)
  }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.id !== event.pointerId) return
    g.lastX = event.clientX
    if (g.active) read(event.clientX)
    else if (Math.hypot(event.clientX - g.x, event.clientY - g.y) > SLOP_PX) endPress(mode)
  }
  const up = (event: PointerEvent<SVGSVGElement>) => { if (gesture.current?.id === event.pointerId) endPress(mode) }

  const key = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!geo) return
    const k = event.key
    const next = k === 'ArrowLeft' ? cur - 1 : k === 'ArrowRight' ? cur + 1 : k === 'Home' ? 0 : k === 'End' ? n : null
    if (next === null) return
    event.preventDefault()
    source.current = 'key'
    setMode(true)
    setIndex(Math.max(0, Math.min(n, next)))
  }
  const toggle = () => {
    if (mode) return exit()
    endPress(true)
    source.current = 'pointer'
    setMode(true)
    setIndex(n)
  }
  const choose = (next: HistoryRange) => { if (next === range) return; exit(); setRange(next) }

  // Once a hold is active, stop the browser from taking the touch over as a scroll (pan-y would otherwise cancel it).
  useEffect(() => {
    const node = svg.current
    if (!node) return
    const stop = (event: TouchEvent) => { if (gesture.current?.active && event.cancelable) event.preventDefault() }
    node.addEventListener('touchmove', stop, { passive: false })
    return () => node.removeEventListener('touchmove', stop)
  }, [geo, range])

  // New geometry (refetch or range): drop any in-flight gesture so its timers and rAF never read stale points.
  useEffect(() => { if (gesture.current || hold.current !== undefined || raf.current !== undefined) endPress(false) }, [geo, endPress])

  // Release everything on unmount, including pointer capture.
  useEffect(() => () => { clearTimers(); release(gesture.current); gesture.current = null }, [clearTimers])

  // Mounted for the component's lifetime so a pending (not yet active) hold is also cleared on blur or backgrounding.
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => {
    const esc = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && (modeRef.current || gesture.current)) exit() }
    // Blur must leave reading mode too, otherwise touchAction:none keeps swallowing vertical scroll after refocus.
    const off = () => exit()
    const hidden = () => { if (document.hidden) exit() }
    window.addEventListener('keydown', esc)
    window.addEventListener('blur', off)
    document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('blur', off); document.removeEventListener('visibilitychange', hidden) }
  }, [endPress, exit])

  // Reduced motion switched on mid-gesture: stop the gesture; CSS already drops the animations.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { if (query.matches) exit() }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [exit])

  // Pointer readings are announced once they settle; keyboard moves are voiced by the slider's valuetext.
  const label = t.reading
  useEffect(() => {
    if (!reading || index === null) { setSaid(''); return }
    if (source.current === 'key') return
    const { time, value } = data[index]
    const timer = window.setTimeout(() => setSaid(`${label} ${fmtDateTime(iso(time), locale)}, ${masked ? AMOUNT_MASK : money.format(value)} ${unit}`), SPEAK_MS)
    return () => window.clearTimeout(timer)
  }, [index, reading, data, masked, money, label, locale, unit])

  const rangeSwitch = <div className={c.ranges}>
    <Segmented role="group" value={range} onChange={choose} label={t.rangeLabel} options={RANGES.map((value) => ({ value, label: t.ranges[value] }))} />
  </div>

  if (!geo) return <>
    {rangeSwitch}
    <StateBlock title={p.historyEmpty} body={p.historyEmptyBody} />
  </>

  const point = data[cur]
  const pt = geo.pts[cur]
  const delta = point.value - data[0].value
  const when = fmtDateTime(iso(point.time), locale)
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''

  return <section className={c.panel} data-active={pressing || mode || undefined}>
    <div className={c.caption}>
      <div>
        <p className={s.kicker}>{reading ? t.reading : t.latest}</p>
        <b className={`${s.num} ${c.value}`}>{amount(point.value)} <small>{unit}</small></b>
        <span className={`${s.num} ${c.delta}`} data-sign={masked || !delta ? undefined : delta > 0 ? 'up' : 'down'}>
          {fill(t.since, { d: fmtDate(iso(data[0].time), locale) })} <bdi dir="ltr">{masked ? AMOUNT_MASK : `${sign}${money.format(Math.abs(delta))}`}</bdi>
        </span>
      </div>
      <time dateTime={iso(point.time)} className={c.time}>{when}</time>
    </div>
    <div className={c.graph} dir="ltr" data-pressing={pressing || undefined}>
      <svg key={range} ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" tabIndex={0} role="slider"
        aria-label={t.chartLabel} aria-valuemin={0} aria-valuemax={n} aria-valuenow={cur} aria-valuetext={`${when}, ${amount(point.value)} ${unit}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up}
        onPointerLeave={(event) => { if (!gesture.current?.active) up(event) }}
        onContextMenu={(event) => { if (gesture.current) event.preventDefault() }}
        onKeyDown={key} style={{ touchAction: mode ? 'none' : 'pan-y' }}>
        {[0.2, 0.5, 0.8].map((f) => <line key={f} className={c.grid} x1={PAD_X} x2={W - PAD_X} y1={H * f} y2={H * f} />)}
        <path className={c.area} d={geo.area} />
        <path className={c.line} d={geo.line} pathLength={1} />
        {reading ? <g>
          <line className={c.cross} x1={pt.x} x2={pt.x} y1={4} y2={H - 4} />
          <line className={c.cross} x1={PAD_X} x2={W - PAD_X} y1={pt.y} y2={pt.y} />
          <circle className={c.dot} cx={pt.x} cy={pt.y} r={5} />
        </g> : <circle className={`${c.dot} ${c.end}`} cx={pt.x} cy={pt.y} r={3.5} />}
      </svg>
    </div>
    <div className={c.dates}>
      <span>{fmtDate(iso(data[0].time), locale)}</span>
      <span>{fill(t.points, { n: String(data.length) })}</span>
      <span>{fmtDate(iso(data[n].time), locale)}</span>
    </div>
    {rangeSwitch}
    <button type="button" className={c.toggle} aria-pressed={mode} onClick={toggle}>
      <MoveHorizontal size={16} aria-hidden="true" />
      <b>{mode ? t.endRead : t.read}</b>
      <span>{mode ? t.endHint : t.readHint}</span>
    </button>
    <p className={c.srOnly} aria-live="polite">{said}</p>
  </section>
}
