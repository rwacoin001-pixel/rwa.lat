'use client'

/**
 * Home "Maison" motion primitives — one easing, one rhythm.
 *
 *   · Rise      : section entrance (opacity + 18px lift + soft blur), once per view.
 *   · MaskLines : headline lines rise out of a clipping mask, staggered.
 *   · CountUp   : numbers count from 0 on first view; writes textContent directly so
 *                 the count never re-renders React.
 *   · useSheen  : pointer-tracked light (--mx / --my) for lacquer cards.
 *
 * Every primitive renders its final state immediately under prefers-reduced-motion.
 */

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion, type Variants } from 'motion/react'

export const EASE = [0.22, 0.8, 0.18, 1] as const

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  shown: (delay: number) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: EASE, delay } }),
}

export function Rise({ children, className, delay = 0, as = 'div', style }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section'; style?: CSSProperties }) {
  const reduced = useReducedMotion()
  const Tag = as === 'section' ? motion.section : motion.div
  if (reduced) return as === 'section' ? <section className={className} style={style}>{children}</section> : <div className={className} style={style}>{children}</div>
  return <Tag className={className} style={style} variants={riseVariants} custom={delay} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.15 }}>{children}</Tag>
}

export function MaskLines({ lines, className, lineClassName, delay = 0.15 }: { lines: ReactNode[]; className?: string; lineClassName?: (index: number) => string | undefined; delay?: number }) {
  const reduced = useReducedMotion()
  return <span className={className}>
    {lines.map((line, index) => <span key={index} style={{ display: 'block', overflow: 'hidden', padding: '0 .14em .08em 0', margin: '0 -.14em -.08em 0' }}>
      {reduced
        ? <span className={lineClassName?.(index)} style={{ display: 'block' }}>{line}</span>
        : <motion.span className={lineClassName?.(index)} style={{ display: 'block' }} initial={{ y: '108%' }} animate={{ y: '0%' }} transition={{ duration: 1.15, ease: EASE, delay: delay + index * 0.12 }}>{line}</motion.span>}
    </span>)}
  </span>
}

export function CountUp({ value, format, className, duration = 1.6 }: { value: number | null; format: (value: number) => string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const phase = useRef<'idle' | 'running' | 'done'>('idle')
  const formatRef = useRef(format)
  formatRef.current = format

  // React owns the placeholder text; once counting starts the DOM text is ours.
  // Re-assert it after every render so locale changes or refetches never flash back.
  useLayoutEffect(() => {
    const node = ref.current
    if (node && value !== null && (reduced || phase.current === 'done')) node.textContent = format(value)
  })

  useEffect(() => {
    const node = ref.current
    if (!node || value === null || reduced) return
    if (phase.current === 'done') { node.textContent = formatRef.current(value); return }
    if (!inView || phase.current === 'running') return
    phase.current = 'running'
    const controls = animate(0, value, {
      duration, ease: EASE,
      onUpdate: latest => { node.textContent = formatRef.current(latest) },
      onComplete: () => { phase.current = 'done'; node.textContent = formatRef.current(value) },
    })
    return () => { controls.stop(); if (phase.current === 'running') phase.current = 'idle' }
  }, [duration, inView, reduced, value])

  return <span ref={ref} className={className} dir="ltr">{value === null ? '—' : format(reduced ? value : 0)}</span>
}

export function useSheen<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect()
        node.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`)
        node.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`)
      })
    }
    node.addEventListener('pointermove', move)
    return () => { node.removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [])
  return ref
}
