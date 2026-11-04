'use client'

/**
 * The lens in the sign-in card (2026-11-04, after the user's reference): the page's own background photo, sharp, laid
 * out exactly where the soft photo sits behind the card. The card reads as a lens pulling the scene into focus, which
 * is the brand line ("Bring assets into focus"): one world, not a stock photo pasted on another.
 * `background-attachment: fixed` would do this but iOS ignores it, so the cover maths of `.scene img` is repeated here.
 */
import { useEffect, useRef } from 'react'
import f from './auth-focus.module.css'

/** Must match the welcome's `.scene img` in auth-focus.module.css: object-position 62% 50%, translateY(-9%) scale(1.22). */
const POS_X = .62
const POS_Y = .5
const LIFT = -.09
const SCALE = 1.22

export function LoginWindow({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null)
  const lens = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let natural: { w: number; h: number } | null = null
    const place = () => {
      const el = box.current, image = lens.current
      if (!el || !image || !natural) return
      const vw = window.innerWidth, vh = window.innerHeight
      const cover = Math.max(vw / natural.w, vh / natural.h)
      const w0 = natural.w * cover, h0 = natural.h * cover
      // Cover placement, then the scene's transform: scale about the viewport centre, then the lift.
      const x = vw / 2 + ((vw - w0) * POS_X - vw / 2) * SCALE
      const y = vh / 2 + vh * LIFT + ((vh - h0) * POS_Y - vh / 2) * SCALE
      const rect = el.getBoundingClientRect()
      image.style.backgroundSize = `${w0 * SCALE}px ${h0 * SCALE}px`
      image.style.backgroundPosition = `${x - rect.left}px ${y - rect.top}px`
    }
    const probe = new Image()
    probe.onload = () => { natural = { w: probe.naturalWidth, h: probe.naturalHeight }; place() }
    probe.src = src
    // The card rises in (a short transform): follow it frame by frame until it settles, so the lens never slips.
    const start = performance.now()
    let frame = 0
    const follow = () => { place(); if (performance.now() - start < 1400) frame = requestAnimationFrame(follow) }
    frame = requestAnimationFrame(follow)
    window.addEventListener('resize', place)
    // The card sits on the bottom edge, so anything that changes its height (an error line) moves the lens with it.
    const card = box.current?.parentElement
    const watch = card ? new ResizeObserver(place) : null
    if (card) watch?.observe(card)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', place); watch?.disconnect() }
  }, [src])
  return <div ref={box} className={f.window} aria-hidden="true">
    <span ref={lens} className={f.lens} style={{ backgroundImage: `url(${src})` }} />
  </div>
}
