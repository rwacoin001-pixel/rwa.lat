'use client'

/**
 * Code slots (2026-10-29, after React Bits Code Slots): one box per character. Typing a character fills its box with ink
 * from the centre and the character rises in; the next box shows a caret. A wrong code tints the boxes red and nudges
 * them; a confirmed code washes the row into one ink bar, the characters sink in a cascade and a check rises.
 * Presentational only: the caller owns the value and puts its input (or keypad) beside or inside it via `children`.
 */
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import c from './code-slots.module.css'

export function CodeSlots({ value, length = 6, invalid = false, done = false, active = true, children, onClick, label }: {
  value: string; length?: number; invalid?: boolean; done?: boolean; active?: boolean; children?: ReactNode; onClick?: () => void; label?: string
}) {
  const chars = Array.from({ length }, (_, index) => value[index] ?? '')
  const current = Math.min(value.length, length - 1)
  return <label className={c.row} dir="ltr" data-invalid={invalid || undefined} data-done={done || undefined} onClick={onClick} aria-label={label}
    style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
    {chars.map((char, index) => <span key={index} className={c.slot} style={{ ['--i' as string]: index }}
      data-filled={char ? '' : undefined} data-current={active && !done && index === current && value.length < length ? '' : undefined}>
      {char && <i key={`f${char}${index}`} className={c.fill} aria-hidden="true" />}
      {char && <b key={`c${char}${index}`} className={c.char}>{char}</b>}
    </span>)}
    {done && <span className={c.wash} aria-hidden="true"><Check size={24} strokeWidth={2.4} className={c.check} /></span>}
    {children}
  </label>
}
