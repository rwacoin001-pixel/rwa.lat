'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export function useReveal(text: string, on: boolean) {
  const [count, setCount] = useState(() => on && !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 0 : text.length)
  const frame = useRef(0)
  const finish = useCallback(() => { cancelAnimationFrame(frame.current); setCount(text.length) }, [text])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!on || media.matches) { finish(); return }
    setCount(0)
    const start = performance.now(), duration = Math.min(1800, Math.max(450, text.length * 14))
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      let n = Math.floor(text.length * (1 - (1 - progress) ** 3))
      // Keep an emoji's two UTF-16 units together.
      if (n > 0 && n < text.length && /[\uD800-\uDBFF]/.test(text[n - 1]) && /[\uDC00-\uDFFF]/.test(text[n])) n--
      setCount(n)
      if (progress < 1) frame.current = requestAnimationFrame(tick)
    }
    const change = () => { if (media.matches) finish() }
    media.addEventListener('change', change)
    frame.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame.current); media.removeEventListener('change', change) }
  }, [text, on, finish])
  return { visible: on ? text.slice(0, count) : text, revealing: on && count < text.length, finish }
}
