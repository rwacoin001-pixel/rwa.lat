'use client'

import { useSyncExternalStore } from 'react'

/**
 * "Hide balances" is one setting for the whole app (2026-10-28): the eye on Home and the eye on Me flip the same switch,
 * and every amount that belongs to the person (total, today, available, pending deposit, rewards) follows it.
 * Read on the client only; the server render shows nothing until the setting is known, so a hidden balance never flashes.
 */
const KEY = 'rwa.home.hide-balance'
const EVENT = 'rwa-hide-balance'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const subscribe = (onChange: () => void) => {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) onChange() }
  window.addEventListener(EVENT, onChange); window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener('storage', onStorage) }
}
export function setBalancesHidden(hidden: boolean) {
  try { localStorage.setItem(KEY, hidden ? '1' : '0') } catch { /* this session only */ }
  window.dispatchEvent(new Event(EVENT))
}
/** `null` until known on the client (treat as hidden while rendering figures). */
export function useBalancesHidden(): boolean | null {
  return useSyncExternalStore(subscribe, read, () => null)
}
export const MASK = '••••'
