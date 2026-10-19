'use client'

import { useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Size of the dial once it is pinned, as a share of its full size. */
const COMPACT = .44

/**
 * Keeps the dial pinned under the topbar. As the page scrolls, the dial shrinks in place to a compact size (transform
 * only, driven by one CSS variable) and stays there while everything below passes underneath; it never scrolls away.
 * A tap on the compact dial brings the page back to the top.
 */
export function QuantPin({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const progress = useRef(0)

  useLayoutEffect(() => {
    const w = wrap.current
    const el = inner.current
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
      w.dataset.pinned = k > .98 ? 'true' : 'false'
    }
    const measure = () => {
      full = el.offsetHeight
      w.style.setProperty('--pin-full', `${full}px`)
      w.style.setProperty('--pin-h', `${Math.round(full * COMPACT)}px`)
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
    <div ref={inner} className={styles.pinInner} onClickCapture={toTop}>{children}</div>
  </div>
}
