'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Height of the topbar; the pinned bar always sits under it, whether or not the topbar is showing. */
const TOP = 48
/** Height of the pinned bar: the compact dial, plus the strip under it. The menu sticks just below it. */
const BAR_H = 132
const GUTTER = 14
const DIAL_SIZE = 116
const DIAL_TOP = 6
/** The title's final width and the top of its row, in the topbar's line. */
const TITLE_WIDTH = 150
const TITLE_TOP = 16
/** Distance from the top of the page over which a downward scroll lets the pinned dial return to rest. */
const HOLD_PX = 80

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * The page's top block. The dial and the title scroll with the page. Once the menu reaches its sticky line, the dial
 * and the title have travelled to their pinned slots (the dial to the top-left, the title to the top-right), and the
 * menu stays on screen beneath them while the content scrolls under it. Progress is the scroll position over the
 * distance the menu has to travel; scrolling back down holds the pinned state until the last HOLD_PX before the top.
 * Each frame writes only transform and opacity, never layout.
 */
export function QuantPin({ children, dial, title, menu, body }: {
  children: ReactNode; dial?: ReactNode; title?: ReactNode; menu?: ReactNode; body?: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const dialCopy = useRef<HTMLDivElement>(null)
  const titleCopy = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = root.current, anchorEl = anchor.current, b = bar.current, dc = dialCopy.current, tc = titleCopy.current
    if (!r || !anchorEl || !b || !dc || !tc) return
    const dialEl = r.querySelector<HTMLElement>('[data-pin-dial]')
    const titleEl = r.querySelector<HTMLElement>('[data-pin-title]')
    if (!dialEl || !titleEl) return
    dc.style.width = `${dialEl.offsetWidth}px`
    tc.style.width = `${titleEl.offsetWidth}px`
    let last = -1
    let prevY = window.scrollY
    let frame = 0
    const apply = () => {
      frame = 0
      const y = window.scrollY
      const travel = Math.max(1, anchorEl.getBoundingClientRect().top + y - (TOP + BAR_H))
      const raw = Math.min(1, Math.max(0, y / travel))
      // Scrolling back down holds the pinned state; only the last HOLD_PX before the top lets it return to rest.
      const k = y < prevY && last > 0 ? Math.max(raw, last * Math.min(1, y / HOLD_PX)) : raw
      prevY = y
      if (k === last) return
      last = k
      const live = k > 0
      r.dataset.live = live ? 'true' : 'false'
      b.dataset.active = live ? 'true' : 'false'
      b.dataset.settled = k >= 1 ? 'true' : 'false'
      b.style.setProperty('--k', k.toFixed(3))
      b.style.pointerEvents = k > .9 ? 'auto' : 'none'
      if (!live) { tc.style.visibility = 'hidden'; return }
      tc.style.visibility = 'visible'
      const d = dialEl.getBoundingClientRect()
      const barTop = b.getBoundingClientRect().top
      const dialScale = DIAL_SIZE / dialEl.offsetWidth
      dc.style.transform = `translate(${lerp(d.left, GUTTER, k).toFixed(2)}px, ${lerp(d.top - barTop, DIAL_TOP, k).toFixed(2)}px) scale(${lerp(1, dialScale, k).toFixed(4)})`
      const t = titleEl.getBoundingClientRect()
      const titleScale = TITLE_WIDTH / titleEl.offsetWidth
      tc.style.transform = `translate(${lerp(t.left, window.innerWidth - GUTTER - TITLE_WIDTH, k).toFixed(2)}px, ${lerp(t.top, TITLE_TOP, k).toFixed(2)}px) scale(${lerp(1, titleScale, k).toFixed(4)})`
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return <div ref={root} className={styles.pinRoot} data-live="false">
    <div className={styles.pinDial}>{children}</div>
    <div ref={anchor} className={styles.pinMenu}>{menu}</div>
    {body}
    <div ref={bar} className={styles.pinBar} data-active="false" data-settled="false" aria-hidden="true">
      <div className={styles.pinBarBg} />
      <div ref={dialCopy} className={styles.pinCopy}>{dial}</div>
    </div>
    <div ref={titleCopy} className={styles.pinTitle} aria-hidden="true">{title}</div>
  </div>
}
