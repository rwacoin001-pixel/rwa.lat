'use client'

import { useState, type CSSProperties } from 'react'
import s from './focus-title.module.css'

/**
 * The welcome line, brought into focus (2026-11-01; replaces the photo card). Like a lens pulling focus, the letters
 * start large and soft and sharpen one after another along the line, hunt once and settle; corner marks close on the
 * line and lock in the accent as the last letter settles; then the dot lights. Plays once; a tap plays it again.
 * Scripts whose letters join (Arabic, Devanagari) sharpen word by word so their shaping is never broken.
 */
export function FocusTitle({ lines, joined }: { lines: readonly string[]; joined: boolean }) {
  const [take, setTake] = useState(0)
  let index = 0
  const glyph = (text: string, key: number) => <span key={key} className={s.glyph} style={{ '--i': index++ } as CSSProperties}>{text}</span>
  return <h1 key={take} className={s.title} onClick={() => setTake(value => value + 1)}>
    <span className={s.sr}>{lines.join(' ')}</span>
    <span className={s.inner} aria-hidden="true">
      <span className={s.frame} />
      {lines.map((line, n) => <span key={n} className={s.line}>
        {line.split(/(\s+)/).map((word, w) => !word ? null : /^\s+$/.test(word) ? ' '
          : <span key={w} className={s.word}>{joined ? glyph(word, 0) : Array.from(word).map(glyph)}</span>)}
        {n === lines.length - 1 && <i className={s.dot} />}
      </span>)}
    </span>
  </h1>
}
