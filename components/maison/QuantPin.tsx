'use client'

import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Size of the dial once it is pinned, as a share of its full size. */
const COMPACT = .36

/**
 * Keeps the dial and the three sub-dials pinned under the topbar. As the page scrolls, the main dial shrinks in place
 * (transform only, driven by CSS variables) and the sub-dial row stays directly beneath it for the rest of the page.
 * A tap on the compact dial brings the page back to the top.
 */
export function QuantPin({ children, subs }: { children: ReactNode; subs?: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const dial = useRef<HTMLDivElement>(null)
  const progress = useRef(0)

  useLayoutEffect(() => {
    const w = wrap.current
    const el = dial.current
    if (!w || !el) return
    let full = 0
    let frame = 0
    const apply = () => {
      frame = 0
      const range = full * (1 - COMPACT)
      const k = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0
      if (Math.abs(k - progress.current) < .0005 && k !== 0 && k !== 1) return
      progress.current = k
      w.style.setProperty('--k', k.toFixed(4))
      w.style.setProperty('--pin-scale', (1 - k * (1 - COMPACT)).toFixed(4))
      w.dataset.pinned = k > .98 ? 'true' : 'false'
    }
    const measure = () => {
      full = el.offsetHeight
      w.style.setProperty('--pin-full', `${full}px`)
      apply()
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply) }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(el)
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { observer?.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  const toTop = (event: MouseEvent) => {
    if (progress.current < .9) return
    event.preventDefault()
    event.stopPropagation()
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return <div ref={wrap} className={styles.pin}>
    <div ref={dial} className={styles.pinDial} onClickCapture={toTop}>{children}</div>
    {subs && <div className={styles.pinSubs}>{subs}</div>}
  </div>
}
