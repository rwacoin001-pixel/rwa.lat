'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './home-v2.module.css'

/**
 * Live numbers (quotes, balances that refresh): only the characters that changed roll up into place (220 ms) and the
 * number flashes the up/down colour for 400 ms. Nothing counts up from zero (docs/design-system.md §8). The first value
 * just appears. Screen readers read the plain text.
 */
export function RollingText({ text, value, className }: { text: string; value: number | null; className?: string }) {
  const previous = useRef<{ text: string; value: number | null } | null>(null)
  const [state, setState] = useState<{ old: string; dir: 'up' | 'down' | null; key: number }>({ old: text, dir: null, key: 0 })
  useEffect(() => {
    const before = previous.current
    previous.current = { text, value }
    if (!before || before.text === text) return
    const dir = before.value === null || value === null ? null : value > before.value ? 'up' : value < before.value ? 'down' : null
    setState(current => ({ old: before.text, dir, key: current.key + 1 }))
    const timer = window.setTimeout(() => setState(current => ({ ...current, dir: null })), 400)
    return () => window.clearTimeout(timer)
  }, [text, value])
  const chars = [...text]
  const old = [...state.old]
  // Align from the right so "9.99" → "10.01" rolls the digits that moved, not every character.
  const offset = old.length - chars.length
  return <span className={`${styles.rolling} ${className ?? ''}`} data-flash={state.dir ?? undefined} dir="ltr">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{chars.map((c, i) => c === old[i + offset] || state.key === 0
      ? <span key={i}>{c}</span>
      : <span key={`${i}-${state.key}`} className={styles.roll}>{c}</span>)}</span>
  </span>
}
