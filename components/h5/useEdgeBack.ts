'use client'

import { useEffect } from 'react'
import { forgetPrevious, skipNextTransition, stackPrevious } from '../motion-effects'

const EDGE = 22
const EASE = 'cubic-bezier(.32, .72, 0, 1)'

/** Only the installed app: in a browser tab Safari and Chrome already own the edge swipe back. */
function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
    || document.documentElement.dataset.shell === 'android'
}

/**
 * Swipe from the leading edge to go back, following the finger (2026-11-04, user: page changes should feel like an app).
 * The page you came from waits underneath as the frozen copy the forward slide kept; the current page moves with the
 * finger. Past a third of the width or on a flick it goes back (history.back, with the pop animation skipped because
 * the finger already did it); otherwise both spring back.
 */
export function useEdgeBack(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let sx = 0, sy = 0, st = 0, dx = 0, armed = false, live: HTMLElement | null = null, under: HTMLElement | null = null, locked = false
    const rtl = () => document.documentElement.dir === 'rtl'
    const width = () => window.innerWidth
    const paint = (x: number, ms = 0) => {
      const p = Math.min(1, Math.max(0, x / width()))
      const sign = rtl() ? -1 : 1
      const ease = ms ? `transform ${ms}ms ${EASE}, opacity ${ms}ms ${EASE}` : 'none'
      if (live) { live.style.transition = ease; live.style.transform = `translate3d(${sign * x}px, 0, 0)` }
      if (under) { under.style.transition = ease; under.style.transform = `translate3d(${sign * -28 * (1 - p)}%, 0, 0)`; under.style.opacity = String(.72 + .28 * p) }
    }
    const reset = () => {
      if (live) for (const key of ['transition', 'transform', 'position', 'zIndex', 'boxShadow', 'background'] as const) live.style[key] = ''
      under?.remove()
      if (under) { under.style.transition = ''; under.style.transform = 'translateZ(0)'; under.style.opacity = '' }
      live = null; under = null; locked = false
    }
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      const fromEdge = rtl() ? window.innerWidth - t.clientX : t.clientX
      armed = e.touches.length === 1 && fromEdge < EDGE && installed() && Boolean(stackPrevious()) && Boolean(window.history.state?.rwaNavigation)
        && !document.documentElement.dataset.aiOpen && !(e.target as HTMLElement | null)?.closest('[role="dialog"]')
      sx = t.clientX; sy = t.clientY; st = performance.now(); dx = 0; locked = false
    }
    const move = (e: TouchEvent) => {
      if (!armed) return
      const t = e.touches[0]
      dx = Math.max(0, (rtl() ? -1 : 1) * (t.clientX - sx))
      if (!locked) {
        if (dx < 8 && Math.abs(t.clientY - sy) < 8) return
        if (dx <= Math.abs(t.clientY - sy)) { armed = false; return }
        locked = true
        live = document.querySelector<HTMLElement>('.rwa-mobile > .rwa-screen-transition:not(.rwa-snap)')
        under = stackPrevious()
        if (!live || !under) { armed = false; reset(); return }
        live.parentElement!.insertBefore(under, live)
        Object.assign(live.style, { position: 'relative', zIndex: '1', boxShadow: '0 0 40px rgba(10, 12, 16, .18)', background: getComputedStyle(document.body).backgroundColor })
      }
      paint(dx)
    }
    const end = () => {
      if (!armed || !locked) { armed = false; return }
      armed = false
      const speed = dx / Math.max(1, performance.now() - st)
      if (dx > width() / 3 || (speed > .5 && dx > 40)) {
        paint(width(), 220)
        window.setTimeout(() => {
          const copy = under
          skipNextTransition()
          window.history.back()
          // The real page mounts where the copy is; drop the copy once the new page is in and has painted.
          const leaving = live, began = performance.now()
          const wait = window.setInterval(() => {
            const now = document.querySelector('.rwa-mobile > .rwa-screen-transition:not(.rwa-snap)')
            if ((now && now !== leaving) || performance.now() - began > 1500) {
              window.clearInterval(wait)
              requestAnimationFrame(() => requestAnimationFrame(() => { reset(); copy?.remove(); forgetPrevious() }))
              window.setTimeout(() => { reset(); copy?.remove() }, 400)
            }
          }, 30)
        }, 200)
      } else {
        paint(0, 260)
        window.setTimeout(reset, 280)
      }
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end)
    }
  }, [enabled])
}
