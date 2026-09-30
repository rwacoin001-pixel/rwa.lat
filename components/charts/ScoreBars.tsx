'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { DUR, EASE, STAGGER } from '@/lib/motion'
export function ScoreBars({ items }: { items: { label: string; value: string | null }[] }) {
  const reduced = useReducedMotion()
  return <div>{items.map((item, index) => {
    const score = item.value === null ? null : Number(item.value)
    const valid = score !== null && Number.isFinite(score) && score >= 0 && score <= 100
    return <div key={item.label} className="rwa-score-row"><span>{item.label}</span><span className="rwa-num">{valid ? item.value : '—'}</span><div className="rwa-score-track" role={valid ? 'meter' : undefined} aria-label={item.label} aria-valuemin={valid ? 0 : undefined} aria-valuemax={valid ? 100 : undefined} aria-valuenow={valid ? score : undefined}><motion.span className="rwa-score-fill" initial={{ width: 0 }} animate={{ width: valid ? `${score}%` : 0 }} transition={{ duration: reduced ? 0 : DUR.long / 1000, delay: reduced ? 0 : Math.min(index, STAGGER.max - 1) * STAGGER.step, ease: EASE.std }} /></div></div>
  })}</div>
}
