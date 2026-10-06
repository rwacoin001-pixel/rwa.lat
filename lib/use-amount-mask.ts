'use client'

import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'rwa:amount-mask'
const EVENT = 'rwa:amount-mask'
export const AMOUNT_MASK = '••••'

let memory = false

function read() {
  try { return window.localStorage.getItem(KEY) === '1' } catch { return memory }
}

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify)
  window.addEventListener(EVENT, notify)
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(EVENT, notify) }
}

/** Local-only privacy preference: when set, money figures on the assets page render as dots. */
export function useAmountMask() {
  const masked = useSyncExternalStore(subscribe, read, () => false)
  const toggle = useCallback(() => {
    const next = !read()
    memory = next
    try { window.localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode: memory only */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { masked, toggle }
}
