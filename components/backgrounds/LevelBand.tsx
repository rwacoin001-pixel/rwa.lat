'use client'

/**
 * LevelBand (2026-11-05, user: the personal centre's top should show my level through its motion; mapping reviewed with
 * Codex): the profile band drawn by the Paper Design shaders, one material per level. A higher level means a finer
 * material, never more movement — two effects only (Waves looked like stripes and was dropped), all slow:
 *   L1 graphite mesh · L2 silver mesh · L3 warm-gold grain · L4 platinum mesh · L5 blue mesh · L6 graphite grain ·
 *   L7 black and gold grain. Stops off screen and under reduced motion;
 * the band's own solid colour shows before the canvas and without WebGL. Same pixel cap as ColourBand.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GrainGradient, MeshGradient } from '@paper-design/shaders-react'
import styles from './colour-band.module.css'

type Look =
  | { kind: 'mesh'; base: string; colors: string[] }
  | { kind: 'grain'; base: string; colors: string[]; shape: 'wave' | 'blob' }

const LOOKS: Record<number, Look> = {
  1: { kind: 'mesh', base: '#3a3f47', colors: ['#2a2e35', '#5b626c', '#8a919b', '#3c424a'] },
  2: { kind: 'mesh', base: '#b9c0ca', colors: ['#d9dee5', '#9aa3ae', '#eef1f4', '#b3bbc6'] },
  3: { kind: 'grain', base: '#3a2c1a', colors: ['#c9a465', '#f0dcae', '#8a6a3a', '#e2c48a'], shape: 'wave' },
  4: { kind: 'mesh', base: '#c8d1dc', colors: ['#eef2f7', '#a9b6c6', '#ffffff', '#c3ccd8'] },
  5: { kind: 'mesh', base: '#2b5b90', colors: ['#1e3a5f', '#4f7fb8', '#a9c8ea', '#2b5b90'] },
  6: { kind: 'grain', base: '#14161a', colors: ['#2a2e35', '#5b626c', '#1c1f24', '#8a919b'], shape: 'blob' },
  7: { kind: 'grain', base: '#0f0d0a', colors: ['#1a1610', '#c9a465', '#2a2216', '#8a6a3a'], shape: 'wave' },
}

export function LevelBand({ level, className }: { level: number; className?: string }) {
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
  const look = LOOKS[Math.min(7, Math.max(1, Math.round(level || 1)))]
  const speed = visible && !still ? .25 : 0
  const common = { minPixelRatio: 1, maxPixelCount: 500 * 200 }
  return <div ref={ref} className={className ? `${styles.band} ${styles.level} ${className}` : `${styles.band} ${styles.level}`} style={{ ['--base' as string]: look.base } as CSSProperties} data-level={level} aria-hidden="true">
    {look.kind === 'mesh' && <MeshGradient className={styles.mesh} colors={look.colors} distortion={.6} swirl={.3} speed={speed} {...common} />}
    {look.kind === 'grain' && <GrainGradient className={styles.mesh} colorBack={look.base} colors={look.colors} shape={look.shape} softness={.7} intensity={.3} noise={.18} speed={speed} {...common} />}
  </div>
}
