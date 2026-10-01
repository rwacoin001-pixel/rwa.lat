'use client'

import { useEffect } from 'react'

/*
 * App-wide touch physics, iOS style:
 *  · press — any tappable element sinks a little under the finger and springs back with a slight overshoot on release;
 *    small controls sink more than cards so every size reads the same. Runs on the independent `scale` property,
 *    so it never fights a component's own `transform`.
 *  · sheets — the top grip region of a dialog sheet can be pulled down; past a distance or with enough
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
  if (width <= 56 && height <= 56) return .94
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
    // A scrolling/cancelled touch is not a tap: restore without a spring.
    const cancelPress = () => {
      pressed?.anim.cancel()
      pressed = null
    }

    const onDown = (event: PointerEvent) => {
      if (reduced.matches || event.button !== 0) return
      const el = pressableFrom(event.target)
      if (!el) return
      cancelPress()
      const anim = el.animate([{ scale: '1' }, { scale: String(depthFor(el)) }], { duration: 110, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' })
      pressed = { el, x: event.clientX, y: event.clientY, anim }
    }
    const onMove = (event: PointerEvent) => {
      if (pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > SLOP) cancelPress()
    }

    // ── Sheet pull-down ──
    let drag: { sheet: HTMLElement; startY: number; lastY: number; lastT: number; velocity: number; active: boolean } | null = null
    const sheetFrom = (target: Element) => {
      const flagged = target.closest<HTMLElement>("[data-sheet]:not([data-sheet='false'])")
      // Full route pages keep normal scrolling; only actual dialog sheets can drag.
      return flagged && !flagged.classList.contains('rwa-mobile') ? { sheet: flagged } : null
    }
    const onTouchStart = (event: TouchEvent) => {
      if (reduced.matches || event.touches.length !== 1 || !(event.target instanceof Element)) return
      const found = sheetFrom(event.target)
      if (!found || found.sheet.scrollTop > 0) return
      const y = event.touches[0].clientY
      // Preserve the existing grip without making form/content gestures draggable.
      if (y > found.sheet.getBoundingClientRect().top + 32 || pressableFrom(event.target) || event.target.closest('input, textarea, select')) return
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
        cancelPress()
        drag.sheet.style.transition = 'none'
      }
      const offset = y - drag.startY
      const dt = Math.max(1, event.timeStamp - drag.lastT)
      drag.velocity = (y - drag.lastY) / dt
      drag.lastY = y
      drag.lastT = event.timeStamp
      // Past the top edge the sheet resists like a rubber band.
      drag.sheet.style.transform = `translateY(${Math.max(0, offset)}px)`
      event.preventDefault()
    }
    const onTouchEnd = () => {
      if (!drag) return
      const { sheet, lastY, startY, velocity, active } = drag
      drag = null
      if (!active) return
      const offset = lastY - startY
      if (offset > DISMISS_DISTANCE || (offset > 24 && velocity > DISMISS_VELOCITY)) {
        sheet.style.transition = 'transform .24s cubic-bezier(.3, .6, .4, 1)'
        sheet.style.transform = 'translateY(110%)'
        window.setTimeout(() => {
          sheet.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
          window.setTimeout(() => { sheet.style.transition = ''; sheet.style.transform = '' }, 400)
        }, 200)
        return
      }
      sheet.style.transition = `transform 520ms ${SPRING}`
      sheet.style.transform = ''
      window.setTimeout(() => { sheet.style.transition = '' }, 540)
    }
    const cancelDrag = () => {
      if (drag?.active) { drag.sheet.style.transition = ''; drag.sheet.style.transform = '' }
      drag = null
      cancelPress()
    }

    window.addEventListener('pointerdown', onDown, { passive: true, capture: true })
    window.addEventListener('pointermove', onMove, { passive: true, capture: true })
    window.addEventListener('pointerup', release, { passive: true, capture: true })
    window.addEventListener('pointercancel', cancelPress, { passive: true, capture: true })
    window.addEventListener('dragstart', cancelPress, { passive: true, capture: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
    window.addEventListener('touchcancel', cancelDrag, { passive: true, capture: true })
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true })
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pointerup', release, { capture: true })
      window.removeEventListener('pointercancel', cancelPress, { capture: true })
      window.removeEventListener('dragstart', cancelPress, { capture: true })
      window.removeEventListener('touchstart', onTouchStart, { capture: true })
      window.removeEventListener('touchmove', onTouchMove, { capture: true })
      window.removeEventListener('touchend', onTouchEnd, { capture: true })
      window.removeEventListener('touchcancel', cancelDrag, { capture: true })
      cancelDrag()
    }
  }, [])
  return null
}
