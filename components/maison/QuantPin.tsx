'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './quant.module.css'

/** Height of the topbar the pinned pair sits under. */
const TOP = 48
/** Side inset of the pinned pair, and the final size of each piece. */
const GUTTER = 14
const DIAL_SIZE = 116
const ROW_WIDTH = 162
const ROW_TOP = 6
/** The title's final width and the top of its row, in the topbar's line. */
const TITLE_WIDTH = 150
const TITLE_TOP = 16

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/**
 * The dial and the sub-dial row scroll with the page. A copy of each sits in a fixed bar under the topbar, and as the
 * page scrolls up, the copies travel from where the originals are to their pinned slots: the dial to the left and
 * smaller, the sub-dials to the right and smaller. Progress is the scroll position over the distance the row has to
 * travel, so the motion follows the finger. Each frame writes only transform and opacity, never layout.
 */
export function QuantPin({ children, subs, dial, title }: { children: ReactNode; subs?: ReactNode; dial?: ReactNode; title?: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const bg = useRef<HTMLDivElement>(null)
  const dialCopy = useRef<HTMLDivElement>(null)
  const subsCopy = useRef<HTMLDivElement>(null)
  const titleCopy = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = root.current, rowEl = row.current, b = bar.current, g = bg.current, dc = dialCopy.current, sc = subsCopy.current, tc = titleCopy.current
    if (!r || !rowEl || !b || !g || !dc || !sc || !tc) return
    const dialEl = r.querySelector<HTMLElement>('[data-pin-dial]')
    const titleEl = r.querySelector<HTMLElement>('[data-pin-title]')
    if (!dialEl || !titleEl) return
    tc.style.width = `${titleEl.offsetWidth}px`
    // Copies take the originals' natural widths, so their transforms map one size onto the other.
    dc.style.width = `${dialEl.offsetWidth}px`
    sc.style.width = `${rowEl.offsetWidth}px`
    let last = -1
    let frame = 0
    const apply = () => {
      frame = 0
      const y = window.scrollY
      const travel = Math.max(1, rowEl.getBoundingClientRect().top + y - TOP)
      const k = Math.min(1, Math.max(0, y / travel))
      if (k === last) return
      last = k
      const live = k > 0
      r.dataset.live = live ? 'true' : 'false'
      b.dataset.active = live ? 'true' : 'false'
      b.dataset.settled = k >= 1 ? 'true' : 'false'
      b.style.setProperty('--k', k.toFixed(3))
      b.style.pointerEvents = k > .9 ? 'auto' : 'none'
      g.style.opacity = k.toFixed(3)
      if (!live) { tc.style.visibility = 'hidden'; return }
      const barTop = b.getBoundingClientRect().top
      const barWidth = b.clientWidth
      const d = dialEl.getBoundingClientRect()
      const s = rowEl.getBoundingClientRect()
      const dialScale = DIAL_SIZE / dialEl.offsetWidth
      const rowScale = ROW_WIDTH / rowEl.offsetWidth
      const rowHeight = rowEl.offsetHeight * rowScale
      const dialX = lerp(d.left, GUTTER, k)
      const dialY = lerp(d.top - barTop, ROW_TOP, k)
      dc.style.transform = `translate(${dialX.toFixed(2)}px, ${dialY.toFixed(2)}px) scale(${lerp(1, dialScale, k).toFixed(4)})`
      const rowX = lerp(s.left, barWidth - GUTTER - ROW_WIDTH, k)
      const rowY = lerp(s.top - barTop, ROW_TOP + DIAL_SIZE - rowHeight, k)
      sc.style.transform = `translate(${rowX.toFixed(2)}px, ${rowY.toFixed(2)}px) scale(${lerp(1, rowScale, k).toFixed(4)})`
      // The title travels from its place in the page to the top-right corner, under the topbar's row.
      const t = titleEl.getBoundingClientRect()
      const titleScale = TITLE_WIDTH / titleEl.offsetWidth
      const titleX = lerp(t.left, window.innerWidth - GUTTER - TITLE_WIDTH, k)
      const titleY = lerp(t.top, TITLE_TOP, k)
      tc.style.visibility = 'visible'
      tc.style.transform = `translate(${titleX.toFixed(2)}px, ${titleY.toFixed(2)}px) scale(${lerp(1, titleScale, k).toFixed(4)})`
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply) }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return <div ref={root} className={styles.pinRoot} data-live="false">
    <div className={styles.pinDial}>{children}</div>
    <div ref={titleCopy} className={styles.pinTitle} aria-hidden="true">{title}</div>
    <div ref={row} className={styles.pinSubs} data-pin-row="">{subs}</div>
    <div ref={bar} className={styles.pinBar} data-active="false" data-settled="false" aria-hidden="true">
      <div ref={bg} className={styles.pinBarBg} />
      <div ref={dialCopy} className={styles.pinCopy}>{dial}</div>
      <div ref={subsCopy} className={styles.pinCopy} data-copy-subs="">{subs}</div>
    </div>
  </div>
}
