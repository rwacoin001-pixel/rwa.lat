'use client'

/**
 * The photo window in the sign-in card (2026-11-02): the three things inside A-REIT — Koala Quant, predictions, the
 * community — as the same photos home uses, crossfading every 4.5s with a slow push-in, a glass tag and three dots.
 * Day photos in light mode, night versions in dark mode. Reduced motion: the first photo, still.
 */
import { useEffect, useState } from 'react'
import f from './auth-focus.module.css'

const SLIDES = [
  { key: 'quant', zh: '考拉量化', en: 'Koala Quant' },
  { key: 'predict', zh: '预测市场', en: 'Predictions' },
  { key: 'invite', zh: '社区', en: 'Community' },
] as const
const STEP_MS = 4500

export function LoginWindow({ night, zh }: { night: boolean; zh: boolean }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex(value => (value + 1) % SLIDES.length), STEP_MS)
    return () => window.clearInterval(timer)
  }, [])
  const current = SLIDES[index]
  return <div className={f.window} aria-hidden="true">
    {SLIDES.map((slide, n) => <img key={slide.key} src={night ? `/media/login/${slide.key}-night.webp` : `/media/home/cards/${slide.key}-720.webp`} alt="" decoding="async" data-on={n === index || undefined} />)}
    <span className={f.windowTag} key={current.key}>{zh ? current.zh : current.en}</span>
    <span className={f.windowDots}>{SLIDES.map((slide, n) => <i key={slide.key} data-on={n === index || undefined} />)}</span>
  </div>
}
