'use client'
import { useEffect, useRef } from 'react'

// iOS interactive pop: a drag that starts on the leading screen edge returns to the previous page.
// Only the most recently mounted back-capable bar owns the gesture (a sheet over a page wins).
const EDGE = 24
const COMMIT = 72
const MAX_PULL = 96
type Entry = { back: () => void }
const stack: Entry[] = []
let indicator: HTMLDivElement | null = null

function ensureIndicator() {
  if (indicator?.isConnected) return indicator
  indicator = document.createElement('div')
  indicator.className = 'rwa-edge-back'
  indicator.setAttribute('aria-hidden', 'true')
  indicator.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'
  ;(document.querySelector('.rwa-mobile') ?? document.body).appendChild(indicator)
  return indicator
}

let startX = 0
let startY = 0
let tracking = false
let armed = false
let rtl = false

function pull(x: number) { return rtl ? startX - x : x - startX }
function show(distance: number) {
  const el = ensureIndicator()
  const progress = Math.min(distance, MAX_PULL) / MAX_PULL
  el.dataset.state = 'drag'
  el.dataset.armed = String(distance >= COMMIT)
  el.style.setProperty('--edge-pull', `${Math.min(distance, MAX_PULL) * .5}px`)
  el.style.setProperty('--edge-progress', String(progress))
}
function hide() {
  if (!indicator) return
  indicator.dataset.state = 'rest'
  indicator.dataset.armed = 'false'
}

function onStart(event: TouchEvent) {
  if (!stack.length || event.touches.length !== 1) return
  const touch = event.touches[0]
  rtl = document.documentElement.dir === 'rtl'
  const fromEdge = rtl ? window.innerWidth - touch.clientX : touch.clientX
  if (fromEdge > EDGE) return
  tracking = true
  armed = false
  startX = touch.clientX
  startY = touch.clientY
}
function onMove(event: TouchEvent) {
  if (!tracking) return
  const touch = event.touches[0]
  const distance = pull(touch.clientX)
  // A vertical drag is a scroll, not a pop.
  if (Math.abs(touch.clientY - startY) > Math.max(24, distance)) { tracking = false; hide(); return }
  if (distance <= 0) { hide(); return }
  const next = distance >= COMMIT
  if (next && !armed) navigator.vibrate?.(6)
  armed = next
  show(distance)
}
function onEnd() {
  if (!tracking) return
  tracking = false
  hide()
  if (armed) stack[stack.length - 1]?.back()
  armed = false
}
function onCancel() { tracking = false; armed = false; hide() }

function attach() {
  window.addEventListener('touchstart', onStart, { passive: true })
  window.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onEnd)
  window.addEventListener('touchcancel', onCancel)
}
function detach() {
  window.removeEventListener('touchstart', onStart)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
  window.removeEventListener('touchcancel', onCancel)
  indicator?.remove()
  indicator = null
}

export function useEdgeSwipeBack(enabled: boolean, back: () => void) {
  const latest = useRef(back)
  useEffect(() => { latest.current = back })
  useEffect(() => {
    if (!enabled) return
    const entry: Entry = { back: () => latest.current() }
    if (!stack.length) attach()
    stack.push(entry)
    return () => {
      stack.splice(stack.indexOf(entry), 1)
      if (!stack.length) { onCancel(); detach() }
    }
  }, [enabled])
}
