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

export function openProfile() {
  if (open || typeof window === 'undefined') return
  window.history.pushState({ ...window.history.state, rwaProfile: true }, '')
  emit(true)
}

/** Close from inside (swipe, sign-out): step back over our own entry; popstate settles the state. */
export function closeProfile() {
  if (!open) return
  if (window.history.state?.rwaProfile) window.history.back()
  else emit(false)
}

/** Navigation away from inside the layer: the new page replaces it, so just drop the layer. */
export function dropProfile() { if (open) emit(false) }

export function syncProfileWithHistory() {
  if (open && !window.history.state?.rwaProfile) emit(false)
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
