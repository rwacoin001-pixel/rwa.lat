'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { animate, useMotionValue } from 'motion/react'
import { fmtUsdt } from '@/lib/money'
import { formatPct, shortDate, tickHeight, tickScale, type Tick } from '@/lib/quant-view-model'
import type { QuantCopy } from '@/lib/maison-quant-copy'
import type { QuantPayout, QuantProduct } from '@/lib/api/quant'
import styles from './quant.module.css'

/** The bottom dock sits above Maison sheets, so it steps out of the way while one is open. */
export function useHideDock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const dock = document.querySelector<HTMLElement>('.liquid-dock')
    if (!dock) return
    const before = { opacity: dock.style.opacity, pointerEvents: dock.style.pointerEvents, visibility: dock.style.visibility }
    dock.style.opacity = '0'
    dock.style.pointerEvents = 'none'
    dock.style.visibility = 'hidden'
    return () => { dock.style.opacity = before.opacity; dock.style.pointerEvents = before.pointerEvents; dock.style.visibility = before.visibility }
  }, [open])
}

/** `1,234.50` from atomic USDT (no unit); `+`/`−` signs are added by the caller where the sign matters. */
export function usdtNumber(atomic: string | null | undefined, locale: string): string {
  return fmtUsdt(atomic, { locale }).replace(/\s?USDT$/, '')
}

export function signedUsdt(atomic: string | null | undefined, locale: string): string {
  if (atomic === null || atomic === undefined) return '—'
  const negative = atomic.startsWith('-')
  const body = usdtNumber(negative ? atomic.slice(1) : atomic, locale)
  if (body === '—' || /^0(?:[.,]0+)?$/.test(body)) return body
  return negative ? `−${body}` : atomic === '0' ? body : `+${body}`
}

const kindClass: Record<Tick['kind'], string> = { gain: styles.gain, loss: styles.loss, flat: styles.flat, missing: styles.missing, today: styles.today }
const kindLabel = (copy: QuantCopy, kind: Tick['kind']) => kind === 'gain' ? copy.tickGain : kind === 'loss' ? copy.tickLoss : kind === 'flat' ? copy.tickFlat : kind === 'today' ? copy.tickToday : copy.tickMissing

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Linear settlement ledger (position card): one column per calendar day on a shared scale. Every column is a real button
 * so a day can be picked without aiming at a thin bar.
 */
export function QuantLedger({ ticks, selected, onSelect, height = 56, copy, label }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number) => void; height?: number; copy: QuantCopy; label: string
}) {
  const scale = tickScale(ticks)
  return <div className={styles.ticks} style={{ '--ledger-h': `${height}px` } as CSSProperties} role="group" aria-label={label}>
    {ticks.map((tick, index) => <button
      key={tick.date}
      type="button"
      className={`${styles.tick} ${kindClass[tick.kind]}`}
      aria-pressed={selected === index}
      aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
      onClick={() => onSelect(index)}
    >
      <i className={styles.bar} style={{ '--f': tickHeight(tick, scale), '--i': index } as CSSProperties} />
    </button>)}
  </div>
}

const CX = 150
const R_BASE = 104
/** One tick every 12°: 30 days make one full turn. On screen that is 24px of arc, so a finger moves the ring 1:1. */
const STEP = 12
const PX_PER_DEGREE = 2
const polar = (radius: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180
  return [CX + Math.cos(a) * radius, CX + Math.sin(a) * radius] as const
}
const splitPct = (text: string) => (text.endsWith('%') ? [text.slice(0, -1), '%'] as const : [text, ''] as const)
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Eases a number towards its target (a count-up on first show, a quick tween when the picked day changes). */
export function useTween(target: number | null, duration = 520, restart = 0): number | null {
  const [value, setValue] = useState<number | null>(null)
  const from = useRef(0)
  const round = useRef(restart)
  useEffect(() => {
    if (target === null) { setValue(null); return }
    // A new round counts up from zero again (the crown winds the dial).
    if (round.current !== restart) { round.current = restart; from.current = 0 }
    if (reducedMotion()) { from.current = target; setValue(target); return }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      from.current = origin + (target - origin) * eased
      setValue(from.current)
      if (k < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, duration, restart])
  return value
}

/**
 * The settlement dial. One tick per calendar day on a ring, oldest to today clockwise, today at twelve. A gain day reaches
 * outward, a loss day inward, a day with no record is a dashed slot, today is a hollow ring. The ring turns under a fixed
 * marker: drag it with a finger (swipe left/right, or follow the circle), tap a tick, or use the arrows, and it springs to
 * the nearest day while the centre shows that day; at today the centre shows the figure since inception.
 */
export function QuantDial({ ticks, selected, onSelect, copy, product }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; copy: QuantCopy; product: QuantProduct
}) {
  const scale = tickScale(ticks)
  const last = ticks.length - 1
  const focus = selected ?? last
  const picked = selected !== null ? ticks[selected] : null
  const p = product.performance
  const angleOf = (index: number) => -90 - (last - index) * STEP
  const rotation = useMotionValue((last - focus) * STEP)
  const ringRef = useRef<SVGGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; lx: number; ly: number; arc: number; start: number; moved: number; active: boolean; samples: Array<[number, number]> } | null>(null)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const [ripple, setRipple] = useState(0)
  const reported = useRef(focus)
  const choose = useCallback((index: number) => onSelect(index === last ? null : index), [last, onSelect])
  const [wind, setWind] = useState(0)
  const winding = useRef(false)

  // The crown winds the watch: the ring makes one full turn and settles on today, the ticks grow back in and the centre
  // counts up again from zero.
  const windUp = () => {
    if (winding.current) return
    setWind((value) => value + 1)
    if ('vibrate' in navigator) navigator.vibrate([4, 40, 4, 40, 4])
    onSelect(null)
    const home = 0
    if (reducedMotion()) { rotation.set(home); return }
    winding.current = true
    dragging.current = true
    const from = rotation.get()
    animate(rotation, [from, home - 360], { duration: 1.25, ease: [.65, 0, .2, 1] }).then(() => {
      rotation.set(home)
      dragging.current = false
      winding.current = false
    })
  }

  useLayoutEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    const write = (value: number) => ring.setAttribute('transform', `rotate(${value} ${CX} ${CX})`)
    write(rotation.get())
    return rotation.on('change', write)
  }, [rotation])

  // Follows the parent's selection (stepper, tapping the centre, a tapped tick) with a spring; the finger drives it directly.
  useEffect(() => {
    reported.current = focus
    if (dragging.current) return
    const target = (last - focus) * STEP
    if (Math.abs(rotation.get() - target) < .01) return
    if (reducedMotion()) { rotation.set(target); return }
    const controls = animate(rotation, target, { type: 'spring', stiffness: 220, damping: 24, mass: .9 })
    return () => controls.stop()
  }, [focus, last, rotation])

  const floatIndex = () => last - rotation.get() / STEP
  const settle = (velocity: number) => {
    const index = clamp(Math.round(floatIndex() + velocity * 180), 0, last)
    dragging.current = false
    reported.current = index
    choose(index)
    if (reducedMotion()) rotation.set((last - index) * STEP)
    else animate(rotation, (last - index) * STEP, { type: 'spring', stiffness: 240, damping: 22, mass: .8 })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lx: event.clientX, ly: event.clientY, arc: 0, start: floatIndex(), moved: 0, active: false, samples: [] }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    const box = boxRef.current
    if (!state || state.id !== event.pointerId || !box) return
    const mx = event.clientX - state.x
    const my = event.clientY - state.y
    const rect = box.getBoundingClientRect()
    const radius = Math.max(1, rect.width / 2)
    // Arc length travelled along the circle, clockwise positive: each step is projected on the tangent at the finger, so
    // following the circle and swiping straight across the top both turn the ring with the finger. Near the centre a
    // horizontal swipe is all there is to follow.
    const px = (event.clientX - (rect.left + radius)) / radius
    const py = (event.clientY - (rect.top + radius)) / radius
    const length = Math.hypot(px, py) || 1
    const dx = event.clientX - state.lx
    const dy = event.clientY - state.ly
    state.lx = event.clientX
    state.ly = event.clientY
    state.arc += length < .38 ? dx : (-py / length) * dx + (px / length) * dy
    const along = state.arc
    state.moved = Math.max(state.moved, Math.abs(mx) + Math.abs(my))
    if (!state.active) {
      if (state.moved < 7) return
      state.active = true
      dragging.current = true
      suppressClick.current = true
      try { box.setPointerCapture(event.pointerId) } catch { /* the pointer may already be gone */ }
    }
    // Clockwise turns the ring towards earlier days; past either end it gives only a third as far.
    const raw = state.start - along / PX_PER_DEGREE / STEP
    const bounded = raw < 0 ? raw * .33 : raw > last ? last + (raw - last) * .33 : raw
    rotation.set((last - bounded) * STEP)
    const now = performance.now()
    state.samples.push([now, bounded])
    while (state.samples.length > 1 && now - state.samples[0][0] > 90) state.samples.shift()
    const index = clamp(Math.round(bounded), 0, last)
    if (index !== reported.current) {
      reported.current = index
      choose(index)
      if ('vibrate' in navigator) navigator.vibrate(3)
    }
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    drag.current = null
    if (!state || state.id !== event.pointerId) return
    if (!state.active) return
    try { boxRef.current?.releasePointerCapture(event.pointerId) } catch { /* already released */ }
    const [first, last2] = [state.samples[0], state.samples[state.samples.length - 1]]
    const velocity = first && last2 && last2[0] > first[0] ? (last2[1] - first[1]) / (last2[0] - first[0]) : 0
    settle(velocity)
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const next = clamp(focus + (event.key === 'ArrowLeft' ? -1 : 1), 0, last)
      if (next !== focus) choose(next)
    }
  }

  const tweenTarget = picked ? picked.value : p.sinceInceptionPct
  const tween = useTween(tweenTarget, wind ? 1100 : 520, wind)
  const shown = tweenTarget === null ? '—' : tween === null ? formatPct(0) : formatPct(tween)
  const [numInt, numSign] = splitPct(shown)
  const negative = tweenTarget !== null && tweenTarget < 0

  return <div
    ref={boxRef}
    className={styles.dialBox}
    data-pin-dial=""
    data-no-ptr=""
    tabIndex={0}
    role="group"
    aria-roledescription="dial"
    aria-label={copy.ledgerTitle}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerEnd}
    onPointerCancel={onPointerEnd}
    onKeyDown={onKeyDown}
    onClick={() => { if (!suppressClick.current) setRipple((value) => value + 1) }}
  >
    <div className={styles.bezelMetal} />
    {ripple > 0 && <span key={ripple} className={styles.ripple} aria-hidden="true" />}
    <div className={styles.bezelSheen} aria-hidden="true" />
    {wind > 0 && <div key={wind} className={styles.windFlash} aria-hidden="true" />}
    <button type="button" className={styles.crown} key={`crown-${wind}`} data-wound={wind > 0 || undefined} aria-label={copy.windLabel} onPointerDown={(event) => event.stopPropagation()} onClick={windUp}>
      <i className={styles.crownCap} /><i className={styles.crownKnurl} /><i className={styles.crownStem} />
    </button>
    <div className={styles.faceBg} />
    <svg className={styles.dial} viewBox="0 0 300 300">
      {[58, 72, 86].map((r) => <circle key={r} className={styles.engrave} cx={CX} cy={CX} r={r} />)}
      <circle className={styles.baseRing} cx={CX} cy={CX} r={R_BASE} />
      <g ref={ringRef}>
        {Array.from({ length: 120 }, (_, i) => {
          const major = i % 5 === 0
          const [x1, y1] = polar(major ? 130.5 : 133.5, i * 3)
          const [x2, y2] = polar(137, i * 3)
          return <line key={i} className={styles.track} data-major={major || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
        {Array.from({ length: 72 }, (_, i) => {
          const [x1, y1] = polar(40, i * 5)
          const [x2, y2] = polar(56, i * 5)
          return <line key={i} className={styles.spoke} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
        <g key={wind}>
        {ticks.map((tick, index) => {
          const angle = angleOf(index)
          const [bx, by] = polar(R_BASE, angle)
          const length = tick.value === null || tick.value === 0 ? 7 : 3 + (Math.abs(tick.value) / scale) * 20
          const outward = tick.value === null || tick.value >= 0
          const [x1, y1] = polar(tick.kind === 'missing' ? R_BASE - 7 : R_BASE, angle)
          const [x2, y2] = polar(tick.kind === 'missing' ? R_BASE + 7 : tick.kind === 'flat' ? R_BASE + 3 : outward ? R_BASE + length : R_BASE - length, angle)
          const choosing = () => { if (!suppressClick.current) choose(index) }
          return <g
            key={tick.date}
            className={styles.t}
            data-kind={tick.kind}
            data-focus={focus === index || undefined}
            role="button"
            tabIndex={-1}
            aria-pressed={selected === index}
            aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
            onClick={choosing}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choosing() } }}
          >
            <circle className={styles.hit} cx={bx} cy={by} r="11" />
            {tick.kind === 'today' ? <circle cx={bx} cy={by} r="4" /> : <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--i': index } as CSSProperties} />}
          </g>
        })}
        </g>
      </g>
      {selected !== null && <g aria-hidden="true">
        <line className={styles.needle} x1={CX} y1={CX - 26} x2={CX} y2={CX - (R_BASE - 2)} />
        <circle className={styles.needleDot} cx={CX} cy={CX - (R_BASE - 2)} r="1.8" />
      </g>}
    </svg>
    <div className={styles.center}>
      {picked
        ? <button type="button" onClick={() => onSelect(null)} aria-label={copy.sinceInception} key={picked.date}>
          <span className={styles.cLabel}>{picked.date}</span>
          <span className={styles.cNum}>{numInt}{numSign && <sup>{numSign}</sup>}</span>
          <span className={styles.cSub}>{kindLabel(copy, picked.kind)}</span>
          <span className={styles.cRule} />
          <span className={styles.cFoot}>{copy.sinceInception} ›</span>
        </button>
        : <div className={styles.cStack} key="since">
          <span className={styles.cLabel}>{copy.sinceInception}</span>
          <span className={`${styles.cNum} ${negative ? styles.down : ''}`}>{numInt}{numSign && <sup>{numSign}</sup>}</span>
          <span className={styles.cSub}>{copy.indexShort} {Number(p.index).toFixed(4)}</span>
          <span className={styles.cRule} />
          <span className={styles.cFoot}>{copy.recorded(p.days)}</span>
        </div>}
    </div>
  </div>
}

/** Previous / next day under the dial: a thumb-sized way to walk the ticks. */
export function QuantStepper({ ticks, selected, onSelect }: { ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void }) {
  if (ticks.length === 0) return null
  const last = ticks.length - 1
  const current = selected ?? last
  const go = (index: number) => onSelect(index === last ? null : index)
  return <div className={styles.stepper}>
    <button type="button" aria-label="‹" disabled={current <= 0} onClick={() => go(current - 1)}>‹</button>
    <span key={ticks[current]?.date}>{ticks[current]?.date}</span>
    <button type="button" aria-label="›" disabled={current >= last} onClick={() => go(current + 1)}>›</button>
  </div>
}

/** Fades a block up the first time it scrolls into view. Never leaves it hidden: a timer shows it even if no observer fires. */
export function Reveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect() } }, { rootMargin: '0px 0px -6% 0px' })
    observer.observe(el)
    const fallback = window.setTimeout(() => setSeen(true), 1600)
    return () => { observer.disconnect(); window.clearTimeout(fallback) }
  }, [])
  return <div ref={ref} className={styles.reveal} data-in={seen || undefined} style={{ '--d': `${index * 70}ms` } as CSSProperties}>{children}</div>
}

export function QuantLegend({ copy }: { copy: QuantCopy }) {
  return <ul className={styles.legend}>
    <li><i className={styles.lgGain} />{copy.legend.gain}</li>
    <li><i className={styles.lgLoss} />{copy.legend.loss}</li>
    <li><i className={styles.lgFlat} />{copy.legend.flat}</li>
    <li><i className={styles.lgMissing} />{copy.legend.missing}</li>
    <li><i className={styles.lgToday} />{copy.legend.today}</li>
  </ul>
}

/** One day's slip: strategy return, the two fees, the net, and where the net went. Amounts are what the ledger booked. */
export function QuantReceipt({ payout, copy, locale }: { payout: QuantPayout; copy: QuantCopy; locale: string }) {
  const net = BigInt(payout.netAtomic)
  const negate = (atomic: string) => (BigInt(atomic) === BigInt(0) ? '0' : `-${atomic}`)
  return <div className={styles.slip}>
    <div className={styles.slipHead}><span>{shortDate(payout.tradeDate)} · {copy.position.receipt}</span><small>{payout.tradeDate.replace(/-/g, '')}</small></div>
    <ul className={styles.lines}>
      <li><span>{copy.position.gross}</span><i /><span>{signedUsdt(payout.grossAtomic, locale)}</span></li>
      <li><span>{copy.position.management}</span><i /><span>{signedUsdt(negate(payout.managementFeeAtomic), locale)}</span></li>
      <li><span>{copy.position.performance}</span><i /><span>{signedUsdt(negate(payout.performanceFeeAtomic), locale)}</span></li>
      <li data-total=""><span>{copy.position.net} · {net < BigInt(0) ? copy.position.reduced : copy.position.credited}</span><i /><span style={{ color: net < BigInt(0) ? 'var(--m-down)' : 'var(--m-up)' }}>{signedUsdt(payout.netAtomic, locale)}</span></li>
      <li><span>{copy.view.receiptPaid}</span><i /><span>{signedUsdt(payout.paidAtomic, locale)}</span></li>
    </ul>
  </div>
}
