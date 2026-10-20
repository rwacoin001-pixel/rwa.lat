'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant-hero.module.css'

/** Height of the pinned hero, below the status bar (the compact dial, the title, and the strip beneath them). */
export const HERO_H = 132
/** Height of the page's resting top block: the dial, its stepper, and the room they need. The menu sits at this line. */
export const REST_H = 450
/** Scroll distance over which the hero travels from rest to pinned. The menu arrives at the same distance. */
const RANGE = REST_H - HERO_H

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The top of the Koala page: one sticky hero holding the dial, the title and the stepper. A single progress value
 * (--p, 0 at rest to 1 pinned) is written on scroll; the hero's children move and scale from that value with transform
 * only, so every frame is cheap and the motion is the same whether the page is scrolled fast or slow. The menu is sticky
 * beneath the hero and arrives exactly as the hero finishes, so the two never drift apart.
 */
export function QuantPin({ dial, title, stepper, menu, body }: {
  dial?: ReactNode; title?: ReactNode; stepper?: ReactNode; menu?: ReactNode; body?: ReactNode
}) {
  const hero = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = hero.current
    if (!el) return
    let last = -1
    let frame = 0
    const apply = () => {
      frame = 0
      const p = clamp(window.scrollY / RANGE)
      if (Math.abs(p - last) < .002 && p !== 0 && p !== 1) return
      last = p
      el.style.setProperty('--p', p.toFixed(3))
      el.dataset.pinned = p >= .5 ? 'true' : 'false'
      el.dataset.settled = p >= 1 ? 'true' : 'false'
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return <>
    <div ref={hero} className={styles.hero} data-pinned="false" data-settled="false">
      <div className={styles.heroBg} aria-hidden="true" />
      <div className={styles.heroDial}>{dial}</div>
      <div className={styles.heroTitle}>{title}</div>
    </div>
    <div className={styles.spacer}><div className={styles.stepRow}>{stepper}</div></div>
    <div className={styles.menu}>{menu}</div>
    {body}
  </>
}
