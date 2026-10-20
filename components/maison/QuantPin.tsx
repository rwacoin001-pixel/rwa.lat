'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/**
 * The main dial rolls up under the topbar as the page scrolls; once it is gone, only the three sub-dials remain pinned
 * at the top for the rest of the page. The dial's box is clipped by height (one CSS variable), so the sub-dial row
 * slides up beneath the topbar and stays there.
 */
export function QuantPin({ children, subs }: { children: ReactNode; subs?: ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const dial = useRef<HTMLDivElement>(null)
  const progress = useRef(-1)

  useLayoutEffect(() => {
    const w = wrap.current
    const el = dial.current
    if (!w || !el) return
    let full = 0
    let frame = 0
    const apply = () => {
      frame = 0
      const k = full > 0 ? Math.min(1, Math.max(0, window.scrollY / full)) : 0
      if (Math.abs(k - progress.current) < .0005 && k !== 0 && k !== 1) return
      progress.current = k
      w.style.setProperty('--k', k.toFixed(4))
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

  return <div ref={wrap} className={styles.pin}>
    <div ref={dial} className={styles.pinDial}>{children}</div>
    {subs && <div className={styles.pinSubs}>{subs}</div>}
  </div>
}
