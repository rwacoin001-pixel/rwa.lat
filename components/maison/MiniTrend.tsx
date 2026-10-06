'use client'

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import h from './hero-card.module.css'

export type TrendPoint = { time: number; value: number }

const MAX_POINTS = 120
const PAD_TOP = 12
const PAD_BOTTOM = 8

/** Strictly increasing in time and capped in count: the curve only ever shows real samples, just fewer of them. */
function prepare(points: TrendPoint[]): TrendPoint[] {
  const ordered = points.filter((point, index) => index === 0 || point.time > points[index - 1].time)
  if (ordered.length <= MAX_POINTS) return ordered
  const step = (ordered.length - 1) / (MAX_POINTS - 1)
  return Array.from({ length: MAX_POINTS }, (_, index) => ordered[Math.round(index * step)])
}

/** Monotone cubic through the samples (Fritsch–Carlson): smooth, and never overshoots a real high or low. */
function curve(xy: Array<[number, number]>): string {
  const n = xy.length
  const f = (value: number) => value.toFixed(1)
  if (n < 3) return xy.map(([x, y], index) => `${index ? 'L' : 'M'}${f(x)},${f(y)}`).join(' ')
  const dx = xy.slice(1).map(([x], index) => x - xy[index][0] || 1e-6)
  const slope = xy.slice(1).map(([, y], index) => (y - xy[index][1]) / dx[index])
  const tangent = xy.map((_, index) => index === 0 ? slope[0] : index === n - 1 ? slope[n - 2] : slope[index - 1] * slope[index] <= 0 ? 0 : (slope[index - 1] + slope[index]) / 2)
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) { tangent[i] = 0; tangent[i + 1] = 0; continue }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const r = a * a + b * b
    if (r > 9) { const tau = 3 / Math.sqrt(r); tangent[i] = tau * a * slope[i]; tangent[i + 1] = tau * b * slope[i] }
  }
  let path = `M${f(xy[0][0])},${f(xy[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3
    path += ` C${f(xy[i][0] + third)},${f(xy[i][1] + tangent[i] * third)} ${f(xy[i + 1][0] - third)},${f(xy[i + 1][1] - tangent[i + 1] * third)} ${f(xy[i + 1][0])},${f(xy[i + 1][1])}`
  }
  return path
}

type Props = {
  points: TrendPoint[]
  label: string
  height?: number
  /** Formats a sample for the axis and the scrub bubble. */
  format?: (value: number) => string
  locale?: string
  /** Show the real high and low at the left edge. */
  axis?: boolean
  /** Smallest value range the vertical scale may stretch to, so a near-flat series reads as flat instead of as a mountain. */
  minSpan?: number
  /** Replays the draw-in when it changes (period switch); ordinary polling keeps the drawn line still. */
  drawKey?: string
  flatLabel?: string
}

/** Inline SVG area line over real points only (no image, no chart library). Renders nothing below two points.
 *  The dashed baseline sits at the window's first sample, so the change figure beside the card's number has a visible anchor. */
export function MiniTrend({ points, label, height = 84, format = (value) => value.toFixed(2), locale, axis = false, minSpan = 0, drawKey = '', flatLabel }: Props) {
  const id = useId().replace(/:/g, '')
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [scrub, setScrub] = useState<number | null>(null)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const measure = () => { if (node.clientWidth > 0) setWidth(Math.round(node.clientWidth)) }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const data = useMemo(() => prepare(points), [points])
  const scale = useMemo(() => {
    if (data.length < 2) return null
    const values = data.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const raw = max - min
    const flat = raw <= Math.max(Math.abs(max), Math.abs(min)) * 1e-5
    const span = flat ? 1 : Math.max(raw, minSpan)
    const mid = (max + min) / 2
    const first = data[0].time
    const range = data[data.length - 1].time - first || 1
    const inner = height - PAD_TOP - PAD_BOTTOM
    const x = (time: number) => (time - first) / range * width
    const y = (value: number) => flat ? PAD_TOP + inner / 2 : PAD_TOP + (1 - (value - (mid - span / 2)) / span) * inner
    const xy = data.map((point) => [x(point.time), y(point.value)] as [number, number])
    return { min, max, flat, xy, range, yMax: y(max), yMin: y(min) }
  }, [data, height, minSpan, width])

  const clock = useMemo(() => {
    const span = scale?.range ?? 0
    return new Intl.DateTimeFormat(locale, span < 2 * 86_400 ? { hour: '2-digit', minute: '2-digit', hour12: false } : { month: 'short', day: 'numeric' })
  }, [locale, scale?.range])

  if (!scale) return null
  const { xy, flat } = scale
  const line = curve(xy)
  const last = xy[xy.length - 1]
  const at = scrub === null ? null : data[scrub]
  const atXY = scrub === null ? null : xy[scrub]

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    let best = 0
    for (let i = 1; i < xy.length; i++) if (Math.abs(xy[i][0] - px) < Math.abs(xy[best][0] - px)) best = i
    setScrub(best)
  }
  const tipSide = atXY && atXY[0] > width * 0.62 ? 'end' : 'start'

  return <div ref={box} className={h.trend} style={{ height }} data-flat={flat || undefined} data-scrubbing={scrub !== null || undefined}
    onPointerMove={move} onPointerDown={move} onPointerLeave={() => setScrub(null)} onPointerUp={() => setScrub(null)} onPointerCancel={() => setScrub(null)}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`mt-a-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--m-lacquer-accent)" stopOpacity=".24" />
          <stop offset="1" stopColor="var(--m-lacquer-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[1 / 3, 2 / 3].map((ratio) => <line key={ratio} className={h.trendGrid} x1="0" x2={width} y1={Math.round(PAD_TOP + (height - PAD_TOP - PAD_BOTTOM) * ratio) + .5} y2={Math.round(PAD_TOP + (height - PAD_TOP - PAD_BOTTOM) * ratio) + .5} />)}
      {!flat && <line className={h.trendBase} x1="0" x2={width} y1={Math.round(xy[0][1]) + .5} y2={Math.round(xy[0][1]) + .5} />}
      <g key={drawKey}>
        {!flat && <path className={h.trendArea} d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#mt-a-${id})`} />}
        <path className={h.trendLine} d={line} pathLength={1} />
      </g>
      {atXY && <line className={h.trendCursor} x1={atXY[0]} x2={atXY[0]} y1="0" y2={height} />}
    </svg>
    {axis && !flat && <>
      <span className={`${h.trendAxis} ${h.num}`} style={{ insetBlockStart: Math.max(0, Math.min(height - 15, scale.yMax - 15)) }}>{format(scale.max)}</span>
      <span className={`${h.trendAxis} ${h.num}`} style={{ insetBlockStart: Math.max(0, Math.min(height - 15, scale.yMin + 2)) }}>{format(scale.min)}</span>
    </>}
    {flat && flatLabel && <span className={h.trendFlat}>{flatLabel}</span>}
    <i key={`dot-${drawKey}`} className={h.trendDot} style={{ left: last[0], top: last[1] }} aria-hidden="true" />
    {at && atXY && <>
      <i className={h.trendProbe} style={{ left: atXY[0], top: atXY[1] }} aria-hidden="true" />
      <span className={`${h.trendTip} ${h.num}`} data-side={tipSide} style={{ left: atXY[0] }}><b>{format(at.value)}</b>{clock.format(new Date(at.time * 1000))}</span>
    </>}
  </div>
}
