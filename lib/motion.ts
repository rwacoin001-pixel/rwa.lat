import { animate } from 'motion/react'
export const DUR = { micro: 120, short: 200, base: 240, long: 400, reveal: 600, pulse: 1200 } as const
export const EASE = { std: [0.2, 0, 0, 1], emph: [0.05, 0.7, 0.1, 1], exit: [0.3, 0, 0.8, 0.15] } as const
export const STAGGER = { step: 0.04, max: 8 } as const
export const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const seconds = (ms: number) => reduced() ? 0 : ms / 1000
export const fadeUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: DUR.base / 1000, ease: EASE.std } }
export function countUp(el: HTMLElement, to: number, format: (n: number) => string) {
  if (reduced()) { el.textContent = format(to); return () => undefined }
  const controls = animate(0, to, { duration: seconds(DUR.reveal), ease: EASE.emph, onUpdate: value => { el.textContent = format(value) } })
  return () => controls.stop()
}
