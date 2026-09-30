'use client'
import { useSyncExternalStore } from 'react'

// One scroll listener drives both the Home topbar and the Dock so they collapse and return together.
const TOP_ZONE = 40
const MIN_DELTA = 5
let collapsed = false
let lastY = 0
let frame = 0
const listeners = new Set<() => void>()

function set(next: boolean) {
  if (next === collapsed) return
  collapsed = next
  listeners.forEach(notify => notify())
}
function onScroll() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    const y = window.scrollY
    if (y < TOP_ZONE) { lastY = y; set(false); return }
    // Small movements accumulate until they read as a clear direction.
    if (Math.abs(y - lastY) < MIN_DELTA) return
    set(y > lastY)
    lastY = y
  })
}
function subscribe(notify: () => void) {
  if (!listeners.size) { lastY = window.scrollY; window.addEventListener('scroll', onScroll, { passive: true }) }
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
    if (!listeners.size) { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); collapsed = false }
  }
}

export function expandChrome() { set(false) }
export function useScrollChrome() {
  return useSyncExternalStore(subscribe, () => collapsed, () => false)
}
