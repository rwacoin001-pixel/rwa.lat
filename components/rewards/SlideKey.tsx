'use client'

/**
 * Slide-to-confirm (2026-11-02, after the user's ticket reference): drag the round knob to the end. Releasing early springs
 * back. Keyboard and screen readers: the knob is a button; its click (Enter/Space, assistive tech) confirms.
 */
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import t from './ticket.module.css'

const KNOB = 44, PAD = 6

export function SlideKey({ label, disabled = false, onDone }: { label: string; disabled?: boolean; onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; max: number } | null>(null)
  const [x, setX] = useState(0)
  const [snap, setSnap] = useState(true)
  const finish = () => { navigator.vibrate?.(12); onDone(); window.setTimeout(() => { setSnap(true); setX(0) }, 450) }
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !track.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX - x, max: track.current.clientWidth - KNOB - PAD * 2 }
    setSnap(false)
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return
    setX(Math.max(0, Math.min(start.current.max, event.clientX - start.current.x)))
  }
  const up = () => {
    if (!start.current) return
    const { max } = start.current
    start.current = null
    setSnap(true)
    if (x >= max * .86) { setX(max); finish() } else setX(0)
  }
  return <div ref={track} className={t.slide} data-snap={snap || undefined} data-disabled={disabled || undefined}>
    <i className={t.fill} style={{ width: x + KNOB + PAD * 2 }} aria-hidden="true" />
    <span className={t.slideLabel} style={{ opacity: Math.max(0, 1 - x / 160) }} aria-hidden="true">{label}<span className={t.chev}><ChevronRight size={16} /><ChevronRight size={16} /><ChevronRight size={16} /></span></span>
    <button type="button" className={t.knob} style={{ transform: `translateX(${x}px)` }} disabled={disabled} aria-label={label}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onClick={(event) => { if (event.detail === 0 && !disabled) finish() }}>
      <ArrowRight size={20} aria-hidden="true" />
    </button>
  </div>
}
