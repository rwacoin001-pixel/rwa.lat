'use client'

import { useEffect } from 'react'

/*
 * App-wide touch physics, iOS style:
 *  · press — any tappable element sinks a little under the finger and springs back with a slight overshoot on release;
 *    small controls sink more than cards so every size reads the same. Runs on the independent `scale` property,
 *    so it never fights a component's own `transform`.
 *  · sheets — any `[data-sheet]` panel scrolled to its top can be pulled down; past a distance or with enough
 *    velocity it is flung away and closed through Escape (base-ui Dialog), otherwise it springs back.
 * Opt out with `data-press="off"`. Everything is skipped under prefers-reduced-motion.
 */
const PRESSABLE = 'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], summary, label[for], [data-press]'
const SPRING = 'linear(0, .0333, .1144, .2213, .338, .4539, .5619, .6584, .7413, .8105, .8666, .9109, .9447, .9699, .9879, 1.0001, 1.008, 1.0126, 1.0147, 1.0152, 1.0145, 1.0132, 1.0115, 1.0098, 1.008, 1.0064, 1.005, 1.0037, 1)'
const SLOP = 10
const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = .6 // px per ms

function depthFor(el: HTMLElement) {
  const { width, height } = el.getBoundingClientRect()
  if (width <= 56 && height <= 56) return .88
  if (width > 240 || height > 120) return .98
  return .96
}

function pressableFrom(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  const el = target.closest<HTMLElement>(PRESSABLE)
  if (!el || el.closest('[data-press="off"]')) return null
  if (el.matches(':disabled, [aria-disabled="true"]')) return null
  return el
}

export default function PressFeedback() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let pressed: { el: HTMLElement; x: number; y: number; anim: Animation } | null = null

    const release = () => {
      if (!pressed) return
      const { el, anim } = pressed
      pressed = null
      const from = getComputedStyle(el).scale
      anim.cancel()
      el.animate([{ scale: from === 'none' ? '1' : from }, { scale: '1' }], { duration: 520, easing: SPRING })
    }

    const onDown = (event: PointerEvent) => {
      if (reduced.matches || event.button !== 0) return
      const el = pressableFrom(event.target)
      if (!el) return
      release()
      const anim = el.animate([{ scale: '1' }, { scale: String(depthFor(el)) }], { duration: 110, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' })
      pressed = { el, x: event.clientX, y: event.clientY, anim }
    }
    const onMove = (event: PointerEvent) => {
      if (pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > SLOP) release()
    }

    // ── Sheet pull-down ──
    // Route sheets (order review, wallet actions) flag the app root; the panel that moves and scrolls is the page inside it,
    // and it closes through its own topbar close slot rather than Escape.
    let drag: { sheet: HTMLElement; route: boolean; startY: number; lastY: number; lastT: number; velocity: number; active: boolean } | null = null
    const sheetFrom = (target: Element) => {
      const flagged = target.closest<HTMLElement>("[data-sheet]:not([data-sheet='false'])")
      if (!flagged?.classList.contains('rwa-mobile')) return flagged ? { sheet: flagged, route: false } : null
      const page = target.closest<HTMLElement>('.rwa-screen-transition > [data-maison-page]')
      return page && flagged.contains(page) ? { sheet: page, route: true } : null
    }
    const onTouchStart = (event: TouchEvent) => {
      if (reduced.matches || event.touches.length !== 1 || !(event.target instanceof Element)) return
      const found = sheetFrom(event.target)
      if (!found || found.sheet.scrollTop > 0) return
      const y = event.touches[0].clientY
      drag = { ...found, startY: y, lastY: y, lastT: event.timeStamp, velocity: 0, active: false }
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!drag) return
      const y = event.touches[0].clientY
      const dy = y - drag.startY
      if (!drag.active) {
        if (dy < SLOP || drag.sheet.scrollTop > 0) { if (dy < -SLOP) drag = null; return }
        drag.active = true
        drag.startY = y
        release()
        drag.sheet.style.transition = 'none'
      }
      const offset = y - drag.startY
      const dt = Math.max(1, event.timeStamp - drag.lastT)
      drag.velocity = (y - drag.lastY) / dt
      drag.lastY = y
      drag.lastT = event.timeStamp
      // Past the top edge the sheet resists like a rubber band.
      drag.sheet.style.transform = `translateY(${offset >= 0 ? offset : offset * .2}px)`
      event.preventDefault()
    }
    const onTouchEnd = () => {
      if (!drag) return
      const { sheet, route, lastY, startY, velocity, active } = drag
      drag = null
      if (!active) return
      const offset = lastY - startY
      const close = route ? sheet.querySelector<HTMLButtonElement>(".rwa-topbar [data-slot='L1']") : null
      if ((!route || close) && (offset > DISMISS_DISTANCE || (offset > 24 && velocity > DISMISS_VELOCITY))) {
        sheet.style.transition = 'transform .24s cubic-bezier(.3, .6, .4, 1)'
        sheet.style.transform = 'translateY(110%)'
        window.setTimeout(() => {
          if (close) close.click()
          else sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
          window.setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = '' }, 400)
        }, 200)
        return
      }
      sheet.style.transition = `transform 520ms ${SPRING}`
      sheet.style.transform = ''
      window.setTimeout(() => { sheet.style.transition = '' }, 540)
    }

    window.addEventListener('pointerdown', onDown, { passive: true, capture: true })
    window.addEventListener('pointermove', onMove, { passive: true, capture: true })
    window.addEventListener('pointerup', release, { passive: true, capture: true })
    window.addEventListener('pointercancel', release, { passive: true, capture: true })
    window.addEventListener('dragstart', release, { passive: true, capture: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerup', release, { capture: true })
      window.removeEventListener('pointercancel', release, { capture: true })
      window.removeEventListener('dragstart', release, { capture: true })
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchmove', onTouchMove, { capture: true })
      window.removeEventListener('touchend', onTouchEnd, { capture: true })
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true })
    }
  }, [])
  return null
}
