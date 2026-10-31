'use client'

/**
 * The community feather (2026-10-31): a small pen above the AI orb. It shows while the feed is being read (the community
 * page scrolled down, or the home page's community tabs pinned). Pulling back up pales it. Tapping it opens the composer
 * of whichever feed owns it right now (the community page, or the embedded feed on home).
 */
export type FeatherState = { visible: boolean; faded: boolean }

let state: FeatherState = { visible: false, faded: false }
let compose: (() => void) | null = null
const listeners = new Set<() => void>()

export function getFeather(): FeatherState { return state }

export function setFeather(next: FeatherState) {
  if (state.visible === next.visible && state.faded === next.faded) return
  state = next
  listeners.forEach(notify => notify())
}

export function subscribeFeather(notify: () => void) {
  listeners.add(notify)
  return () => { listeners.delete(notify) }
}

/** The feed that is on screen registers its composer; the returned function releases it on unmount. */
export function claimFeatherCompose(open: () => void) {
  compose = open
  return () => { if (compose === open) compose = null }
}

export function openFeatherCompose() { compose?.() }
