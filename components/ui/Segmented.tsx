'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { DUR, EASE } from '@/lib/motion'
export function Segmented({ items, value, onChange, label = '切换视图' }: { items: string[]; value: number; onChange: (index: number) => void; label?: string }) {
  const id = useId()
  const reduced = useReducedMotion()
  return <div className="rwa-segment" role="tablist" aria-label={label}>{items.slice(0, 3).map((item, index) => <button key={item} type="button" role="tab" aria-selected={index === value} tabIndex={index === value ? 0 : -1} className="rwa-sel" data-state={index === value ? 'selected' : 'rest'} onClick={() => onChange(index)} onKeyDown={event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length; onChange(next); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus() }
  }}>{index === value && <motion.span className="rwa-segment__indicator" layoutId={`seg-${id}`} transition={{ duration: reduced ? 0 : DUR.base / 1000, ease: EASE.emph }} />}<span>{item}</span></button>)}</div>
}
