'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Height of the pinned bar: the compact dial, the three sub-dials and the title. The menu sticks just below it. */
const BAR_H = 132
const GUTTER = 14
const DIAL_SIZE = 116
const DIAL_TOP = 6
const ROW_WIDTH = 162
/** The title's final width and the top of its row. */
const TITLE_WIDTH = 150
const TITLE_TOP = 14
/** Distance from the top of the page over which a downward scroll lets the pinned pair return to rest. */
const HOLD_PX = 80

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * The page's top block, pinned to the very top of the screen (the page has no topbar). The dial, the three sub-dials and
 * the title scroll with the page. Once the menu reaches its sticky line, they have travelled to their pinned slots: the
 * dial to the top-left, the sub-dials to the bottom-right of the bar, the title to the top-right. The menu then stays on
 * screen beneath them while the content scrolls under it. Progress is the scroll position over the distance the menu has
 * to travel; scrolling back down holds the pinned state until the last HOLD_PX before the top. Each frame writes only
 * transform and opacity, never layout.
 */
export function QuantPin({ children, dial, subs, title, menu, body }: {
  children: ReactNode; dial?: ReactNode; subs?: ReactNode; title?: ReactNode; menu?: ReactNode; body?: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const dialCopy = useRef<HTMLDivElement>(null)
  const subsCopy = useRef<HTMLDivElement>(null)
  const titleCopy = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = root.current, anchorEl = anchor.current, b = bar.current, dc = dialCopy.current, sc = subsCopy.current, tc = titleCopy.current
    if (!r || !anchorEl || !b || !dc || !sc || !tc) return
    const dialEl = r.querySelector<HTMLElement>('[data-pin-dial]')
    const rowEl = r.querySelector<HTMLElement>('[data-pin-row]')
    const titleEl = r.querySelector<HTMLElement>('[data-pin-title]')
    if (!dialEl || !rowEl || !titleEl) return
    // Copies take the originals' natural widths, so their transforms map one size onto the other.
    dc.style.width = `${dialEl.offsetWidth}px`
    sc.style.width = `${rowEl.offsetWidth}px`
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
      r.dataset.live = live ? 'true' : 'false'
      b.dataset.active = live ? 'true' : 'false'
      b.dataset.settled = k >= 1 ? 'true' : 'false'
      b.style.setProperty('--k', k.toFixed(3))
      b.style.pointerEvents = k > .9 ? 'auto' : 'none'
      if (!live) { tc.style.visibility = 'hidden'; return }
      tc.style.visibility = 'visible'
      const barTop = b.getBoundingClientRect().top
      const barWidth = b.clientWidth
      const d = dialEl.getBoundingClientRect()
      const dialScale = DIAL_SIZE / dialEl.offsetWidth
      dc.style.transform = `translate(${lerp(d.left, GUTTER, k).toFixed(2)}px, ${lerp(d.top - barTop, DIAL_TOP, k).toFixed(2)}px) scale(${lerp(1, dialScale, k).toFixed(4)})`
      const s = rowEl.getBoundingClientRect()
      const rowScale = ROW_WIDTH / rowEl.offsetWidth
      const rowHeight = rowEl.offsetHeight * rowScale
      sc.style.transform = `translate(${lerp(s.left, barWidth - GUTTER - ROW_WIDTH, k).toFixed(2)}px, ${lerp(s.top - barTop, DIAL_TOP + DIAL_SIZE - rowHeight, k).toFixed(2)}px) scale(${lerp(1, rowScale, k).toFixed(4)})`
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
      <div ref={subsCopy} className={styles.pinCopy} data-copy-subs="">{subs}</div>
    </div>
    <div ref={titleCopy} className={styles.pinTitle} aria-hidden="true">{title}</div>
  </div>
}
