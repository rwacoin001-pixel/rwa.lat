'use client'

import { useEffect, useId, useRef, useState } from 'react'
import s from './prismatic-band.module.css'

/** Sculpted colour ribbons; transforms only, with no canvas or rank-dependent palette. */
export function PrismaticBand({ className }: { className?: string }) {
  const id = useId().replaceAll(':', '')
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let visible = true
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPaused(!visible || document.hidden || motion.matches)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    if (ref.current) observer?.observe(ref.current)
    motion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    update()
    return () => { observer?.disconnect(); motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  return <div ref={ref} className={`${s.band} ${className ?? ''}`} data-prismatic-band data-paused={paused || undefined} aria-hidden="true">
    <svg viewBox="0 0 1000 360" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#28c9e8" /><stop offset=".44" stopColor="#306af0" /><stop offset="1" stopColor="#b7d9f3" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#b0f3d9" /><stop offset=".38" stopColor="#5fe4db" /><stop offset=".75" stopColor="#f3e09b" /><stop offset="1" stopColor="#ffa88b" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#f4c3c8" /><stop offset=".35" stopColor="#9ca6ea" /><stop offset=".68" stopColor="#ffd28f" /><stop offset="1" stopColor="#f79b85" /></linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#4c8bda" /><stop offset=".45" stopColor="#b9d9e4" /><stop offset="1" stopColor="#fff0c9" /></linearGradient>
      </defs>
      <rect width="1000" height="360" fill={`url(#${id}a)`} />
      <g className={s.far}><path d="M360-180C280 20 425 375 786 412L1120 460V-160Z" fill={`url(#${id}b)`} /><path d="M437-130C319 79 558 351 1017 221" fill="none" stroke="#effff4" strokeOpacity=".5" strokeWidth="2" /></g>
      <g className={s.near}><path d="M163-160C212 40 206 336 626 442L1120 490V301C592 309 418 164 425-170Z" fill={`url(#${id}c)`} /><path d="M199-105C242 142 290 344 706 411" fill="none" stroke="#fff2ed" strokeOpacity=".7" strokeWidth="2" /></g>
      <g className={s.front}><path d="M205-180C162 76 367 383 1024 335L1120 452C360 503 127 278 132-160Z" fill={`url(#${id}d)`} fillOpacity=".77" /><path d="M166-115C169 98 329 386 1052 374" fill="none" stroke="#effbff" strokeOpacity=".65" strokeWidth="2" /></g>
    </svg>
    <span className={s.sheen} />
  </div>
}
