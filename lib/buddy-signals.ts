import type { BuddyMood } from './paper-buddy'

/**
 * One channel for telling the AI buddy (the paper orb in the dock) what is happening. Any screen may call
 * `buddySignal('thinking')`; the buddy shows that mood for a while and then settles back. `hold` keeps a mood until
 * the next signal (e.g. while an AI request is in flight); `ms` sets how long a passing mood lasts.
 */
export type BuddySignal = { mood: BuddyMood; hold?: boolean; ms?: number }
const EVENT = 'rwa:buddy'

export function buddySignal(mood: BuddyMood, options: { hold?: boolean; ms?: number } = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<BuddySignal>(EVENT, { detail: { mood, ...options } }))
}

export function onBuddySignal(listener: (signal: BuddySignal) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<BuddySignal>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
