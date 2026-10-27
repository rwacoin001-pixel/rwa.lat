'use client'

/**
 * The original A-REIT mark, made solid: the ink plate and the teal panel are each extruded (a stack of thin layers,
 * darker towards the back), and the panel stands a little in front of the plate, so the two pieces separate when the
 * mark turns. Same shapes as components/rwa-logo.tsx; no new logo.
 * Motion (CSS, RwaLogo3D.module.css): a slow sway, then a rest, on a loop; the panel swings open like a door once per
 * loop. A tap spins it once. Reduced motion: still and flat-on.
 */
import { useState } from 'react'
import styles from './RwaLogo3D.module.css'

const PLATE = 'M4 78Q4 69 13 65L139 8Q146 5 153 8L213 37Q222 42 222 53V144L154 113V71L77 106V199Q77 207 70 211L16 242Q4 248 4 235Z'
const PANEL = 'M113 95L238 152Q247 156 247 167V258Q247 270 236 265L121 213Q113 210 113 199Z'
const DEPTH = 6

function Solid({ d, face, side, z, className }: { d: string; face: string; side: string; z: number; className?: string }) {
  return <span className={`${styles.solid} ${className ?? ''}`} style={{ transform: `translateZ(${z}px)` }}>
    {Array.from({ length: DEPTH }, (_, i) => <svg key={i} viewBox="0 0 252 272" style={{ transform: `translateZ(${(i - DEPTH + 1) * .7}px)` }} aria-hidden="true">
      <path d={d} fill={i === DEPTH - 1 ? face : side} />
    </svg>)}
  </span>
}

export function RwaLogo3D({ className }: { className?: string }) {
  const [spin, setSpin] = useState(0)
  return <span className={`${styles.stage} ${className ?? ''}`} aria-hidden="true" onPointerUp={() => setSpin(n => n + 1)}>
    <span key={spin} className={styles.turn} data-spin={spin > 0 ? '' : undefined}>
      <span className={styles.sway}>
        <Solid d={PLATE} face="var(--logo3d-ink, #0b1220)" side="var(--logo3d-ink-side, #3a4250)" z={0} />
        <Solid d={PANEL} face="#19c7aa" side="#0d7f6c" z={3} className={styles.panel} />
      </span>
    </span>
    <span className={styles.floor} />
  </span>
}
