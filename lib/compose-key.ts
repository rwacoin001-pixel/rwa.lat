'use client'

import { useSyncExternalStore } from 'react'

/**
 * The compose key (2026-11-02, replaces the community feather): on the Community page the AI orb morphs in place into
 * an ink compose key. The feed on screen claims it with what it composes ('post', or 'cards' on the 晒单 tab, which opens
 * the card picker); the dock reads the claim. Long-pressing the key still opens the AI.
 */
export type ComposeKind = 'post' | 'cards'
export type ComposeClaim = { kind: ComposeKind; open: () => void }

let claim: ComposeClaim | null = null
const listeners = new Set<() => void>()
const publish = () => listeners.forEach(notify => notify())

/** The feed that is on screen claims the key; the returned function releases it on unmount or when the claim changes. */
export function claimComposeKey(next: ComposeClaim) {
  claim = next
  publish()
  return () => { if (claim === next) { claim = null; publish() } }
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => { listeners.delete(notify) }
}
const read = () => claim
const none = () => null

export function useComposeKey() { return useSyncExternalStore(subscribe, read, none) }

/** The hint 「长按问 AI」 shows on the first three visits to Community; each visit counts once. */
const HINT_KEY = 'areit.composeKey.hints'
export const HINT_VISITS = 3
export function countComposeHintVisit(): boolean {
  try {
    const seen = Number(window.localStorage.getItem(HINT_KEY)) || 0
    if (seen >= HINT_VISITS) return false
    window.localStorage.setItem(HINT_KEY, String(seen + 1))
    return true
  } catch { return false }
}
