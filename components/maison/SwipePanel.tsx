'use client'

/**
 * A page that slides in from the trailing edge and goes back with a swipe toward it (2026-10-29, user: the personal
 * centre should come in from the right, with no top bar or back key; swiping right returns). The panel follows the
 * finger on a mostly horizontal drag; past a third of the width (or a quick flick) it slides out and calls `onClose`,
 * otherwise it springs back. Vertical scrolling is untouched. RTL mirrors the direction.
 */
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import p from './swipe-panel.module.css'

export function SwipePanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; t: number; dx: number; on: boolean | null } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const sign = () => (document.documentElement.dir === 'rtl' ? -1 : 1)
  const set = (dx: number, animate: boolean) => {
    const node = ref.current
    if (!node) return
    node.style.transition = animate ? 'transform .32s cubic-bezier(.22, 1, .36, 1)' : 'none'
    node.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : ''
  }
  const leave = () => {
    if (leaving) return
    setLeaving(true)
    set(sign() * window.innerWidth, true)
    window.setTimeout(onClose, 260)
  }
  useEffect(() => () => { drag.current = null }, [])

  const start = (event: TouchEvent) => {
    if (event.touches.length !== 1 || leaving) return
    const touch = event.touches[0]
    drag.current = { x: touch.clientX, y: touch.clientY, t: performance.now(), dx: 0, on: null }
  }
  const move = (event: TouchEvent) => {
    const d = drag.current
    if (!d) return
    const touch = event.touches[0], dx = (touch.clientX - d.x) * sign(), dy = touch.clientY - d.y
    // Decide once, after a few pixels: a horizontal drag toward the edge moves the page; anything else is a scroll.
    if (d.on === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      d.on = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2
    }
    if (!d.on) return
    d.dx = Math.max(0, dx)
    set(sign() * d.dx, false)
  }
  const end = () => {
    const d = drag.current
    drag.current = null
    if (!d?.on) return
    const speed = d.dx / Math.max(1, performance.now() - d.t)
    if (d.dx > window.innerWidth / 3 || (speed > .6 && d.dx > 40)) leave()
    else set(0, true)
  }

  // data-maison-page keeps the shell rule that drops its side padding for Maison pages (it matches direct children).
  return <div ref={ref} className={p.panel} data-maison-page="swipe-panel" onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>{children}</div>
}
