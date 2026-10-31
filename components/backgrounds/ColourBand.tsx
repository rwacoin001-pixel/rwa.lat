'use client'

import { useEffect, useRef } from 'react'
import styles from './colour-band.module.css'

/**
 * ColourBand (2026-10-31): the living colour band on the profile card, drawn with CSS only. Two saturated gradient layers
 * slide sideways on transform (composited, no repaint) on 10 s and 12 s loops, so they never line up for long. It pauses
 * while it is off screen and stays still under reduced motion. It replaces the WebGL shader of 2026-10-28, which was too
 * pale to see and redrew every frame.
 */
export function ColourBand({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute('data-paused', !entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={className ? `${styles.band} ${className}` : styles.band} aria-hidden="true">
    <span className={styles.a} />
    <span className={styles.b} />
  </div>
}
