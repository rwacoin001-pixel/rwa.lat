'use client'

import { useSyncExternalStore } from 'react'
import { aiPageContext, type AiPageContext } from './ai-page-context'

/**
 * The AI assistant is a layer over the current page (2026-10-28), not a page of its own: opening it keeps the page
 * where it is (blurred behind), closing it returns there untouched. One history entry is pushed while it is open, so
 * the system back gesture closes it.
 */
type State = { open: boolean; context?: AiPageContext }
let state: State = { open: false }
const listeners = new Set<() => void>()
const emit = (next: State) => { state = next; listeners.forEach((listener) => listener()) }

export function openAi(context?: AiPageContext) {
  if (state.open || typeof window === 'undefined') return
  const ctx = context ?? aiPageContext(window.location.pathname, window.location.search)
  window.history.pushState({ ...window.history.state, rwaAi: true }, '')
  emit({ open: true, context: ctx })
}

/** Close from inside (X, Escape): step back over our own history entry; the popstate then settles the state. */
export function closeAi() {
  if (!state.open) return
  if (window.history.state?.rwaAi) window.history.back()
  else emit({ open: false })
}

/** Called on popstate: the layer is open only while its history entry is current. */
export function syncAiWithHistory() {
  if (state.open && !window.history.state?.rwaAi) emit({ open: false })
}

export function useAiOverlay(): State {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => state, () => state)
}
