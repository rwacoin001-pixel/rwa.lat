'use client'

import { useId } from 'react'
import styles from './home-v2.module.css'

/**
 * A 7-day line: the data is the decoration (docs/design-system.md §4.2). A smooth curve that draws in once, with an
 * optional soft fill fading down under it. No end dot, no colour: the change figure beside it is coloured by today,
 * and a line coloured by the week next to it would contradict it half the time.
 * Nothing for fewer than 2 points or a flat series. Decorative: the number beside it carries the meaning.
 */
export function Sparkline({ points, area, className }: { points: number[] | null | undefined; area?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const values = (points ?? []).filter(Number.isFinite)
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  if (max === min) return null
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 2 + (1 - (v - min) / (max - min)) * 20] as const)
  // Catmull-Rom through the points as cubic Béziers: smooth, and it still passes through every close.
  let d = `M${pts[0][0]},${pts[0][1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return <span className={`${styles.spark} ${className ?? ''}`} aria-hidden="true">
    <svg viewBox="0 0 100 24" preserveAspectRatio="none">
      {area && <>
        <defs><linearGradient id={`sf${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopOpacity=".2" /><stop offset="1" stopOpacity="0" /></linearGradient></defs>
        <path className={styles.sparkFill} d={`${d} L100,24 L0,24 Z`} fill={`url(#sf${id})`} />
      </>}
      <path d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  </span>
}
