'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Height of the pinned dial area; the menu attaches directly beneath it. */
const BAR_H = 132
/** Where the menu row sits once attached, in bar coordinates. */
const MENU_TOP = 138
const GUTTER = 14
const DIAL_SIZE = 116
const DIAL_TOP = 6
/** The title's final scale, and the top of its row. */
const TITLE_SCALE = 1.25
const TITLE_TOP = 14
/** Scroll progress over which the menu row attaches; it is stuck to the pinned dial from then on. */
const MENU_ATTACH = .25
/** Distance from the top of the page over which a downward scroll lets the pinned pair return to rest. */
const HOLD_PX = 80

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * The page's top block, pinned to the top edge of the screen (the page has no topbar). The dial, the title and the menu
 * row scroll with the page. As the page scrolls, the dial moves to the top-left, the title to the top-right, and the menu
 * row attaches just beneath the dial and stays there while the content scrolls under it. Progress is the scroll position
 * over the distance the menu has to travel; scrolling back down holds the pinned state until the last HOLD_PX before the
 * top. Each frame writes only transform and opacity, never layout.
 */
export function QuantPin({ children, dial, title, menu, body }: {
  children: ReactNode; dial?: ReactNode; title?: ReactNode; menu?: ReactNode; body?: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const dialCopy = useRef<HTMLDivElement>(null)
  const menuCopy = useRef<HTMLDivElement>(null)
  const titleCopy = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = root.current, anchorEl = anchor.current, b = bar.current, dc = dialCopy.current, mc = menuCopy.current, tc = titleCopy.current
    if (!r || !anchorEl || !b || !dc || !mc || !tc) return
    const dialEl = r.querySelector<HTMLElement>('[data-pin-dial]')
    const titleEl = r.querySelector<HTMLElement>('[data-pin-title] > span')
    if (!dialEl || !titleEl) return
    dc.style.width = `${dialEl.offsetWidth}px`
    mc.style.width = `${anchorEl.offsetWidth}px`
    tc.style.width = `${titleEl.offsetWidth}px`
    let last = -1
    let prevY = window.scrollY
    let frame = 0
    const apply = () => {
      frame = 0
      const y = window.scrollY
      const travel = Math.max(1, anchorEl.getBoundingClientRect().top + y - BAR_H)
      const raw = Math.min(1, Math.max(0, y / travel))
      // Scrolling back down holds the pinned state; only the last HOLD_PX before the top lets it return to rest.
      const k = y < prevY && last > 0 ? Math.max(raw, last * Math.min(1, y / HOLD_PX)) : raw
      prevY = y
      if (k === last) return
      last = k
      const live = k > 0
      const km = Math.min(1, k / MENU_ATTACH)
      r.dataset.live = live ? 'true' : 'false'
      b.dataset.active = live ? 'true' : 'false'
      b.dataset.settled = k >= 1 ? 'true' : 'false'
      b.style.setProperty('--k', k.toFixed(3))
      dc.style.pointerEvents = k > .9 ? 'auto' : 'none'
      mc.style.pointerEvents = km >= 1 ? 'auto' : 'none'
      if (!live) { tc.style.visibility = 'hidden'; mc.style.visibility = 'hidden'; return }
      tc.style.visibility = 'visible'
      mc.style.visibility = 'visible'
      const barTop = b.getBoundingClientRect().top
      const barWidth = b.clientWidth
      const d = dialEl.getBoundingClientRect()
      const dialScale = DIAL_SIZE / dialEl.offsetWidth
      dc.style.transform = `translate(${lerp(d.left, GUTTER, k).toFixed(2)}px, ${lerp(d.top - barTop, DIAL_TOP, k).toFixed(2)}px) scale(${lerp(1, dialScale, k).toFixed(4)})`
      // The menu row starts where it is in the page and attaches beneath the dial within the first quarter of the travel.
      const m = anchorEl.getBoundingClientRect()
      mc.style.transform = `translate(${lerp(m.left, GUTTER, km).toFixed(2)}px, ${lerp(m.top - barTop, MENU_TOP, km).toFixed(2)}px)`
      mc.style.opacity = String(Math.min(1, km * 2))
      const t = titleEl.getBoundingClientRect()
      const titleWidth = titleEl.offsetWidth
      tc.style.transform = `translate(${lerp(t.left, barWidth - GUTTER - titleWidth * TITLE_SCALE, k).toFixed(2)}px, ${lerp(t.top, TITLE_TOP, k).toFixed(2)}px) scale(${lerp(1, TITLE_SCALE, k).toFixed(4)})`
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
    <div ref={bar} className={styles.pinBar} data-active="false" data-settled="false">
      <div className={styles.pinBarBg} />
      <div ref={dialCopy} className={styles.pinCopy}>{dial}</div>
      <div ref={menuCopy} className={styles.pinMenuCopy} aria-hidden={undefined}>{menu}</div>
    </div>
    <div ref={titleCopy} className={styles.pinTitle} aria-hidden="true">{title}</div>
  </div>
}
