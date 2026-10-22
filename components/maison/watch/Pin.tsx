'use client'

import React from 'react';

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './hero.module.css'

/** Height of the pinned hero, below the status bar: the small dial on the left and the three small sub-dials on the right. */
export const HERO_H = 112
/** Height of the page's resting top block: the dial (its sub-registers live inside the face) and its air. The menu sits here. */
export const REST_H = 440
/** Scroll distance over which the hero travels from rest to pinned. The menu arrives at the same distance. */
const RANGE = REST_H - HERO_H

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The top of the Koala page: one sticky hero holding the dial, the title and the stepper. A single progress value
 * (--p, 0 at rest to 1 pinned) is written on scroll; the hero's children move and scale from that value with transform
 * only, so every frame is cheap and the motion is the same whether the page is scrolled fast or slow. The menu is sticky
 * beneath the hero and arrives exactly as the hero finishes, so the two never drift apart.
 */
export function QuantPin({ dial, title, subs, stepper, menu, body }: {
  dial?: ReactNode; title?: ReactNode; subs?: ReactNode; stepper?: ReactNode; menu?: ReactNode; body?: ReactNode
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
    <div ref={hero} data-watch-part="hero" className={styles.hero} data-pinned="false" data-settled="false">
      <div data-watch-part="heroBg" className={styles.heroBg} aria-hidden="true" />
      <div data-watch-part="heroDial" className={styles.heroDial}>{dial}<div data-watch-part="title" className={styles.title}>{title}</div></div>
      <div data-watch-part="heroSubs" className={styles.heroSubs} data-subs="">{subs}</div>
    </div>
    <div data-watch-part="spacer" className={styles.spacer}><div data-watch-part="stepRow" className={styles.stepRow}>{stepper}</div></div>
    <div data-watch-part="menu" className={styles.menu}>{menu}</div>
    {body}
  </>
}
