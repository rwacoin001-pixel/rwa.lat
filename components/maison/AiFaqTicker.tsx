'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUpLeft, Sparkles } from 'lucide-react'
import s from './ai-composer.module.css'

/** One tappable subtitle at a time; hover/focus pauses rotation and selection fills a draft. */
export default function AiFaqTicker({ questions, label, onSelect }: { questions: string[]; label: string; onSelect(question: string): void }) {
  const [index, setIndex] = useState(0), [paused, setPaused] = useState(false)
  const reduced = useReducedMotion(), question = questions[index % questions.length]
  useEffect(() => {
    if (paused || reduced || questions.length < 2) return
    const timer = window.setInterval(() => { if (!document.hidden) setIndex(value => (value + 1) % questions.length) }, 5200)
    return () => window.clearInterval(timer)
  }, [paused, reduced, questions.length])
  if (!question) return null
  return <div className={s.faq} aria-label={label} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <Sparkles size={13} aria-hidden="true"/>
    <button type="button" onClick={() => onSelect(question)} aria-label={`${label}: ${question}`}><AnimatePresence mode="wait" initial={false}><motion.span key={question} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -8 }} transition={{ duration: reduced ? 0 : .26 }}>{question}</motion.span></AnimatePresence></button>
    <ArrowUpLeft size={14} aria-hidden="true"/>
  </div>
}
