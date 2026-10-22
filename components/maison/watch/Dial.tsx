'use client'
import React, {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {animate,useMotionValue} from 'motion/react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {RollingNumber,RollingDate} from './Rolling';
import {formatPct,tickHeight,tickScale,localToday} from '@/lib/quant-view-model';
import type {Tick} from '@/lib/quant-view-model';
import type {QuantCopy} from '@/lib/maison-quant-copy';
import type {QuantProduct} from '@/lib/api/quant';
import type {CSSProperties,KeyboardEvent as ReactKeyboardEvent,PointerEvent as ReactPointerEvent} from 'react';
import styles from './dial.module.css';
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
  return <div data-watch-part="ticks" className={styles.ticks} style={{ '--ledger-h': `${height}px` } as CSSProperties} role="group" aria-label={label}>
    {ticks.map((tick, index) => <button
      key={tick.date}
      type="button"
      className={`${styles.tick} ${kindClass[tick.kind]}`}
      aria-pressed={selected === index}
      aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
      onClick={() => onSelect(index)}
    >
      <i data-watch-part="bar" className={styles.bar} style={{ '--f': tickHeight(tick, scale), '--i': index } as CSSProperties} />
    </button>)}
  </div>
}

const CX = 150
/** Settlement ring radius. It sits near the rim so the face inside stays clear for the window, the registers and the
 * drawdown gauge (direction A: big-date window at 12, registers at 9 and 3, power-reserve-style gauge at 6). */
const R_BASE = 116
/** Longest tick, either way from the ring; keeps outward ticks inside the minute track and inward ones off the face. */
const TICK_REACH = 11
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
  const [value, setValue] = useState<number | null>(target)
  const from = useRef(target ?? 0)
  const round = useRef(restart)
  useEffect(() => {
    if (target === null) { setValue(null); return }
    // Preserve the current value even when interrupted; never reset the readout.
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
export function QuantDial({ ticks, selected, onSelect, copy, product, english = false }: {
  ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; copy: QuantCopy; product: QuantProduct
  /** Every locale but Chinese reads the dial in English; Chinese reads it in Chinese only. */
  english?: boolean
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
  const crownRef = useRef<HTMLButtonElement>(null)
  const drive = useRef<ReturnType<typeof animate> | null>(null)
  const crownAnimations = useRef<Animation[]>([])
  const drag = useRef<{ id: number; x: number; y: number; lx: number; ly: number; arc: number; start: number; moved: number; active: boolean; samples: Array<[number, number]> } | null>(null)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const reported = useRef(focus)
  const choose = useCallback((index: number) => onSelect(index === last ? null : index), [last, onSelect])
  const [mode, setMode] = useState<'return'|'nav'>('return')
  const winding = useRef(false)

  const stopDrive = () => {
    drive.current?.stop()
    drive.current = null
    winding.current = false
    dragging.current = false
    boxRef.current?.removeAttribute('data-winding')
  }
  const turnTo = (target: number, options: object) => {
    drive.current?.stop()
    drive.current = animate(rotation, target, options)
    return drive.current
  }
  useEffect(() => () => {
    drive.current?.stop()
    crownAnimations.current.forEach(a => a.cancel())
  }, [])

  // Press the crown, roll its flutes, then let the indexed ring settle.
  // Readouts remain mounted and never restart from zero.
  const windUp = () => {
    if (winding.current) return
    if ('vibrate' in navigator) navigator.vibrate([4, 40, 4, 40, 4])
    const home = 0
    if (reducedMotion()) { onSelect(null); rotation.set(home); return }
    drive.current?.stop()
    winding.current = true
    dragging.current = true
    boxRef.current?.setAttribute('data-winding', 'true')
    onSelect(null)
    crownAnimations.current.forEach(a => a.cancel())
    const cap = crownRef.current?.querySelector(`.${styles.crownCap}`)
    const knurl = crownRef.current?.querySelector(`.${styles.crownKnurl}`)
    const press = [{transform:'translateY(0)'},{transform:'translateY(3.5px)',offset:.22},{transform:'translateY(3.5px)',offset:.42},{transform:'translateY(-.45px)',offset:.8},{transform:'translateY(0)'}]
    crownAnimations.current = [cap,knurl].filter(Boolean).map(el=>el!.animate(press,{duration:580,easing:'cubic-bezier(.22,.75,.2,1)'}))
    if(knurl) crownAnimations.current.push(knurl.animate([{backgroundPosition:'0px 0, 0 0'},{backgroundPosition:'64px 0, 0 0'}],{duration:1350,easing:'cubic-bezier(.45,0,.18,1)'}))
    const from = rotation.get()
    drive.current = animate(rotation, [from, home - 357.5, home - 360.6, home - 360], { duration: 1.55, times:[0,.8,.93,1], ease: [.45, 0, .18, 1] })
    drive.current.then(() => {
      rotation.set(home)
      dragging.current = false
      winding.current = false
      boxRef.current?.removeAttribute('data-winding')
    })
  }

  useLayoutEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    const write = (value: number) => {
      ring.setAttribute('transform', `rotate(${value} ${CX} ${CX})`)
      boxRef.current?.style.setProperty('--ring-angle', `${value}deg`)
      // Directional brushed-metal reflection moves much less than the rotor itself.
      boxRef.current?.style.setProperty('--reflection-angle', `${Math.sin(value*Math.PI/180)*9}deg`)
    }
    write(rotation.get())
    return rotation.on('change', write)
  }, [rotation])

  // Follows the parent's selection (stepper, tapping the centre, a tapped tick) with a spring; the finger drives it directly.
  useEffect(() => {
    reported.current = focus
    if (winding.current && focus !== last) stopDrive()
    if (dragging.current) return
    const target = (last - focus) * STEP
    if (Math.abs(rotation.get() - target) < .01) return
    if (reducedMotion()) { rotation.set(target); return }
    const controls = turnTo(target, { type: 'spring', stiffness: 255, damping: 28, mass: 1.15 })
    return () => controls.stop()
  }, [focus, last, rotation])

  const floatIndex = () => last - rotation.get() / STEP
  const settle = (velocity: number) => {
    const index = clamp(Math.round(floatIndex() + clamp(velocity * 105,-2,2)), 0, last)
    dragging.current = false
    reported.current = index
    choose(index)
    if (reducedMotion()) rotation.set((last - index) * STEP)
    else turnTo((last - index) * STEP, { type: 'spring', stiffness: 290, damping: 27, mass: 1.1 })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    stopDrive()
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
      box.dataset.turning = 'true'
      suppressClick.current = true
      try { box.setPointerCapture(event.pointerId) } catch { /* the pointer may already be gone */ }
    }
    // Clockwise turns the ring towards earlier days; past either end it gives only a third as far.
    const raw = state.start - along / PX_PER_DEGREE / STEP
    const bounded = raw < 0 ? raw * .33 : raw > last ? last + (raw - last) * .33 : raw
    // Gentle mechanical detents; preserve 1:1 tracking while drawing towards each tooth.
    const detented = bounded - Math.sin(bounded * Math.PI * 2) * .065
    rotation.set((last - detented) * STEP)
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
    boxRef.current?.removeAttribute('data-turning')
    if (!state || state.id !== event.pointerId) return
    if (!state.active) {
      if (!reducedMotion()) turnTo((last-focus)*STEP,{type:'spring',stiffness:290,damping:27,mass:1.1})
      else rotation.set((last-focus)*STEP)
      return
    }
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

  const returnValue = picked ? picked.value : p.sinceInceptionPct
  const record = picked ? product.history.find(row => row.tradeDate === picked.date) : null
  const navValue = picked ? (record ? Number(record.indexAfter) : null) : p.days ? Number(p.index) : null
  const date = ticks[focus]?.date || localToday(product.timezone)
  const labels = english ? ['Since inception','Daily return','Latest product NAV','Historical product NAV'] : ['成立以来','当日收益','最新产品净值','当日产品净值']
  const labelIndex = mode === 'nav' ? (picked ? 3 : 2) : (picked ? 1 : 0)

  return <div
    ref={boxRef}
    data-watch-part="dialBox" className={styles.dialBox}
    data-pin-dial=""
    data-layout="datograph"
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
  >
    <div data-watch-part="bezelMetal" className={styles.bezelMetal} />
    <div data-watch-part="bezelSheen" className={styles.bezelSheen} aria-hidden="true" />
    <button ref={crownRef} type="button" data-watch-part="crown" className={styles.crown} aria-label={english?'Crown: return to today':'表冠：回到今天'} onPointerDown={(event) => event.stopPropagation()} onClick={windUp}>
      <i data-watch-part="crownCap" className={styles.crownCap} /><i data-watch-part="crownKnurl" className={styles.crownKnurl} /><i data-watch-part="crownStem" className={styles.crownStem} />
    </button>
    <button type="button" className="calendar-pusher" aria-label={english?'Switch return and NAV':'切换收益率与净值'} aria-pressed={mode==='nav'} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {e.stopPropagation();setMode(m=>m==='return'?'nav':'return');}}><span className="pusher-stem"/><span className="pusher-cap"/></button>
    <div data-watch-part="faceBg" className={styles.faceBg} />
    {/* Two finishes, as on a Lange dial: a clous-de-Paris centre inside a polished step, matte opaline outside it. */}
    <div className="clous-centre" aria-hidden="true" />
    <div className="rotor-brushing" aria-hidden="true"/>
    <div className="chapter-rehaut" aria-hidden="true"/>
    <div className="enamel-medallion" aria-hidden="true"/>
    <svg data-watch-part="dial" className={styles.dial} viewBox="0 0 300 300">
      {[101, 103].map((r) => <circle key={r} data-watch-part="engrave" className={styles.engrave} cx={CX} cy={CX} r={r} />)}
      <circle data-watch-part="baseRing" className={styles.baseRing} cx={CX} cy={CX} r={R_BASE} />
      <g ref={ringRef}>
        {/* Railroad minute track: two hairline rails with a fine tick between them every 3°, longer every 15°. */}
        <circle className="rail" cx={CX} cy={CX} r="131.2" />
        <circle className="rail" cx={CX} cy={CX} r="135.8" />
        {Array.from({ length: 120 }, (_, i) => {
          const major = i % 5 === 0
          const [x1, y1] = polar(major ? 129.6 : 131.2, i * 3)
          const [x2, y2] = polar(major ? 137.4 : 135.8, i * 3)
          return <line key={i} data-watch-part="track" className={styles.track} data-major={major || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
        })}
        {/* Applied batons every 30°: a faceted gold bar, lit on one flank and shaded on the other, outside the rails. */}
        {Array.from({ length: 12 }, (_, i) => {
          const deg = i * 30
          const wide = i % 3 === 0 ? 1.5 : 1.05
          const a = (deg * Math.PI) / 180, n = [-Math.sin(a), Math.cos(a)]
          const [ix, iy] = polar(137.9, deg), [ox, oy] = polar(i % 3 === 0 ? 141.4 : 140.6, deg)
          const side = (sign: number) => `${ix + n[0] * wide * sign},${iy + n[1] * wide * sign} ${ox + n[0] * wide * sign},${oy + n[1] * wide * sign}`
          return <g key={`b${i}`} className="baton">
            <polygon className="baton-lit" points={`${ix},${iy} ${side(1)} ${ox},${oy}`} />
            <polygon className="baton-shade" points={`${ix},${iy} ${side(-1)} ${ox},${oy}`} />
          </g>
        })}
        <g>
        {ticks.map((tick, index) => {
          const angle = angleOf(index)
          const [bx, by] = polar(R_BASE, angle)
          const length = tick.value === null || tick.value === 0 ? 5 : 2 + (Math.abs(tick.value) / scale) * (TICK_REACH - 2)
          const outward = tick.value === null || tick.value >= 0
          const [x1, y1] = polar(tick.kind === 'missing' ? R_BASE - 7 : R_BASE, angle)
          const [x2, y2] = polar(tick.kind === 'missing' ? R_BASE + 7 : tick.kind === 'flat' ? R_BASE + 3 : outward ? R_BASE + length : R_BASE - length, angle)
          const choosing = () => { if (!suppressClick.current) choose(index) }
          return <g
            key={tick.date}
            data-watch-part="t" className={styles.t}
            data-kind={tick.kind}
            data-focus={focus === index || undefined}
            role="button"
            tabIndex={-1}
            aria-pressed={selected === index}
            aria-label={`${tick.date} · ${kindLabel(copy, tick.kind)}${tick.value !== null ? ` · ${formatPct(tick.value)}` : ''}`}
            onClick={choosing}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choosing() } }}
          >
            <circle data-watch-part="hit" className={styles.hit} cx={bx} cy={by} r="11" />
            {tick.kind === 'today' ? <circle cx={bx} cy={by} r="4" /> : <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ '--i': index } as CSSProperties} />}
          </g>
        })}
        </g>
      </g>
      <path className="day-index-marker" d="M147 33 L150 39 L153 33Z" />
      <DrawdownGauge value={p.maxDrawdownPct} label={english ? 'MDD' : '最大回撤'} />
    </svg>
    {/* One language on the face: Chinese engraving in Chinese, the English name everywhere else. */}
    <div className="engraved-brand" data-lang={english ? 'en' : 'zh'}>{english ? <span>KOALA QUANT</span> : <h2>{copy.title}</h2>}</div>
    <div className="watch-readout" data-mode={mode}>
      <div className="readout-legend" aria-label={labels[labelIndex]}>
        <div className="legend-strip" style={{transform:`translateY(${-labelIndex*100/4}%)`}} aria-hidden="true">
          {labels.map(label=><span key={label}>{label}</span>)}
        </div>
      </div>
      <div className="readout-window">
        <div className="readout-drum" style={{transform:`translateY(${mode==='nav'?-50:0}%)`}}>
          <div className="readout-row return-row" aria-hidden={mode!=='return'} data-negative={returnValue!==null&&returnValue<0}><RollingNumber value={returnValue} signed/><sup>%</sup></div>
          <div className="readout-row nav-row" aria-hidden={mode!=='nav'}><RollingNumber value={navValue} decimals={4}/></div>
        </div>
      </div>
    </div>
    <div className="watch-date" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <button aria-label={english?'Previous day':'前一天'} disabled={focus<=0} onClick={()=>choose(focus-1)}><ChevronLeft size={12}/></button>
      <div className="date-aperture"><RollingDate date={date}/></div>
      <button aria-label={english?'Next day':'后一天'} disabled={focus>=last} onClick={()=>choose(focus+1)}><ChevronRight size={12}/></button>
    </div>
    <div className="sapphire-crystal" aria-hidden="true"/>
    <div className="rim-reflection" aria-hidden="true"/>
  </div>
}

/** Scale for the drawdown gauge: the smallest of 1/2/5/10/20/50/100 % that leaves the figure some room before the stop. */
const gaugeScale = (value: number) => [1, 2, 5, 10, 20, 50, 100].find((step) => step >= Math.abs(value) * 1.3) ?? 100

/**
 * Maximum drawdown at 6 o'clock, set like a power-reserve indicator: a half-circle scale from 0 to a round stop, a slim
 * hand at the figure, the figure engraved underneath. A fall is spent reserve, so the metaphor reads without a legend.
 */
function DrawdownGauge({ value, label }: { value: number | null; label: string }) {
  const cx = 150, cy = 190, r = 17
  const scale = gaugeScale(value ?? 0)
  const share = value === null ? 0 : Math.min(1, Math.abs(value) / scale)
  const angle = 180 + share * 180
  const point = (radius: number, degrees: number) => {
    const a = (degrees * Math.PI) / 180
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as const
  }
  const [hx, hy] = point(r - 3, angle)
  return <g className="mdd-gauge" aria-hidden="true">
    <path className="mdd-arc" d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} />
    {Array.from({ length: 11 }, (_, i) => {
      const deg = 180 + i * 18
      const [x1, y1] = point(r - (i % 5 === 0 ? 4.5 : 2.6), deg)
      const [x2, y2] = point(r + .2, deg)
      return <line key={i} className="mdd-tick" data-major={i % 5 === 0 || undefined} x1={x1} y1={y1} x2={x2} y2={y2} />
    })}
    {share > 0 && <path className="mdd-spent" d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${point(r, angle)[0].toFixed(2)} ${point(r, angle)[1].toFixed(2)}`} />}
    <text className="mdd-end" x={cx - r - 1} y={cy + 8}>0</text>
    <text className="mdd-end" x={cx + r + 1} y={cy + 8}>{`−${scale}`}</text>
    <text className="mdd-label" x={cx} y={cy - r - 4}>{label}</text>
    <line className="mdd-hand" x1={cx} y1={cy} x2={hx} y2={hy} />
    <circle className="mdd-hub" cx={cx} cy={cy} r="2.1" />
    <text className="mdd-value" x={cx} y={cy + 10.5}>{value === null ? '—' : formatPct(value)}</text>
  </g>
}

/** Previous / next day under the dial: a thumb-sized way to walk the ticks. */
export function QuantStepper({ ticks, selected, onSelect }: { ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void }) {
  if (ticks.length === 0) return null
  const last = ticks.length - 1
  const current = selected ?? last
  const go = (index: number) => onSelect(index === last ? null : index)
  return <div data-watch-part="stepper" className={styles.stepper}>
    <button type="button" aria-label="‹" disabled={current <= 0} onClick={() => go(current - 1)}>‹</button>
    <span key={ticks[current]?.date}>{ticks[current]?.date}</span>
    <button type="button" aria-label="›" disabled={current >= last} onClick={() => go(current + 1)}>›</button>
  </div>
}

