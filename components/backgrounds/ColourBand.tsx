'use client'

import { useEffect, useRef, useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import styles from './colour-band.module.css'

const COLOURS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f472b6', '#fb923c', '#fde68a']

/**
 * ColourBand (2026-11-01): the living colour band on the profile card, drawn by the open-source Paper Design mesh-gradient
 * shader (@paper-design/shaders-react): soft colour spots on their own paths, bent by organic noise, so it reads as one
 * smooth, deep surface with no seams or stripes. The canvas is small and capped in pixels; it stops while it is off
 * screen or under reduced motion, and the soft gradient behind it shows if WebGL is not available.
 */
export function ColourBand({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [still, setStill] = useState(false)
  useEffect(() => {
    setStill(matchMedia('(prefers-reduced-motion: reduce)').matches)
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={className ? `${styles.band} ${className}` : styles.band} aria-hidden="true">
    <MeshGradient className={styles.mesh} colors={COLOURS} distortion={0.85} swirl={0.55} speed={visible && !still ? 0.45 : 0} minPixelRatio={1} maxPixelCount={500 * 200} />
  </div>
}
