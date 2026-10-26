'use client'

import styles from './home-v2.module.css'

/**
 * A 7-day line: the data is the decoration (docs/design-system.md §4.2). One thin muted stroke that draws in once,
 * and a dot at today's end in the tone the caller gives. Nothing for fewer than 2 points or a flat series.
 * Decorative: the number next to it carries the meaning, so it is hidden from screen readers.
 */
export function Sparkline({ points, tone, className }: { points: number[] | null | undefined; tone?: 'up' | 'down' | null; className?: string }) {
  const values = (points ?? []).filter(Number.isFinite)
  if (values.length < 2) return null
  const min = Math.min(...values), max = Math.max(...values)
  if (max === min) return null
  // 2 units of headroom top and bottom so the stroke and the end dot are never clipped.
  const y = (v: number) => 2 + (1 - (v - min) / (max - min)) * 20
  const line = values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v).toFixed(2)}`).join(' ')
  const end = y(values[values.length - 1])
  return <span className={`${styles.spark} ${className ?? ''}`} data-tone={tone ?? undefined} aria-hidden="true">
    <svg viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points={line} pathLength={1} vectorEffect="non-scaling-stroke" /></svg>
    <i style={{ top: `${(end / 24) * 100}%` }} />
  </span>
}
