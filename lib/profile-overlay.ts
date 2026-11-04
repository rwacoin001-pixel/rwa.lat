'use client'

import { useSyncExternalStore } from 'react'

/**
 * The personal centre as a layer over the current page (2026-10-29, user: swiping it away should reveal the page
 * underneath, as far as the finger goes). Like the AI layer: the page stays mounted below, one history entry is pushed
 * while it is open (so system back closes it), and any in-app navigation from inside it closes it.
 */
let open = false
const listeners = new Set<() => void>()
const emit = (next: boolean) => { open = next; listeners.forEach((listener) => listener()) }

let seq = 0
export function openProfile() {
  if (open || typeof window === 'undefined') return
  seq++
  window.history.pushState({ ...window.history.state, rwaProfile: true }, '')
  emit(true)
}

/**
 * Close from inside (swipe, sign-out): step back over our own entry; popstate settles the state.
 * Watchdog (2026-11-05, user: the Android app froze after a swipe): if that popstate never arrives, the transparent
 * layer would stay over the page with its panel slid away — the screen looks normal but takes no touch. Close anyway.
 */
export function closeProfile() {
  if (!open) return
  if (window.history.state?.rwaProfile) {
    const mine = ++seq
    window.history.back()
    window.setTimeout(() => { if (open && seq === mine) emit(false) }, 700)
  } else emit(false)
}

/** Navigation away from inside the layer: the new page goes on top; the layer's own history entry stays below it. */
export function dropProfile() { if (open) { seq++; emit(false) } }

/**
 * Back/forward settles the layer on the entry it lands on (2026-11-05, user: settings opened from the personal centre
 * went back to home). Opening a page from the layer keeps the layer's history entry under the new page, so going back
 * lands on that entry again — show the personal centre there, not the page under it.
 */
export function syncProfileWithHistory() {
  const want = Boolean(window.history.state?.rwaProfile)
  if (open !== want) { seq++; emit(want) }
}

/**
 * Pulling the layer in with the finger (2026-11-01, user: it must follow the hand). The page swipe reports how far the
 * panel has come in; the panel follows once mounted (until then the distance waits here), and on release it settles
 * open or slides back out.
 */
type PanelPull = { follow: (px: number) => void; finish: (keep: boolean) => void }
let panel: PanelPull | null = null
let pending: number | null = null
export function pullProfile(px: number) {
  if (!open) { pending = px; openProfile() }
  if (panel) panel.follow(px)
  else pending = px
}
export function releaseProfile(keep: boolean) {
  const waiting = pending !== null && !panel
  pending = null
  if (panel) panel.finish(keep)
  else if (waiting && !keep) closeProfile()
}
/** The panel registers while mounted; it gets the distance the finger already covered, if any. */
export function bindProfilePanel(next: PanelPull | null): number | null {
  panel = next
  const px = pending
  pending = null
  return px
}

export function useProfileOverlay(): boolean {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => open, () => false)
}
