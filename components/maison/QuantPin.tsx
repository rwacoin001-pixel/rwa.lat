'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Height of the topbar the pinned bar sits under. */
const TOP = 48

/**
 * The dial and the sub-dial row scroll with the page. Once the sub-dial row has gone above the topbar, a compact pair
 * (the dial on the left, the three sub-dials on the right) is shown pinned under it. The bar is sticky in the flow, so
 * arriving costs no layout; the observer only flips its visibility when the row crosses the topbar.
 */
export function QuantPin({ children, subs, bar }: { children: ReactNode; subs?: ReactNode; bar?: ReactNode }) {
  const row = useRef<HTMLDivElement>(null)
  const pinned = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = row.current
    const out = pinned.current
    if (!el || !out || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      const above = !entry.isIntersecting && entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0)
      out.dataset.pinned = above ? 'true' : 'false'
    }, { rootMargin: `-${TOP}px 0px 0px 0px`, threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return <>
    <div className={styles.pinDial}>{children}</div>
    <div ref={row} className={styles.pinSubs}>{subs}</div>
    {bar && <div ref={pinned} className={styles.pinBar} data-pinned="false"><div className={styles.pinBarIn}>{bar}</div></div>}
  </>
}
