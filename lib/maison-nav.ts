'use client'

import { useEffect, useState } from 'react'
import { getSessionToken } from '@/lib/api/_http'

/**
 * Path-based navigation for screens that own their URL (ids, slugs, query).
 * rwa-h5 listens for PATH_EVENT, applies the guest guard with a full-path return target,
 * pushes the URL with `rwaNavigation` so topbar back can use history, then re-resolves the
 * screen from location exactly like popstate does.
 */
export const PATH_EVENT = 'rwa:navigate-path'
export type PathNavigation = { path: string; replace?: boolean }

export function openPath(path: string, options: { replace?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<PathNavigation>(PATH_EVENT, { detail: { path, replace: options.replace } }))
}

/** Back within the app when there is in-app history, otherwise to a stable parent. */
export function backOr(fallback: string) {
  if (window.history.state?.rwaNavigation) window.history.back()
  else openPath(fallback)
}

export function queryParam(query: string, key: string): string | null {
  const value = new URLSearchParams(query).get(key)
  return value && value.trim() ? value.trim() : null
}

/** Guest action on a public page: come back to this exact URL after login. */
export function signInThenReturn(returnPath = `${window.location.pathname}${window.location.search}`) {
  window.sessionStorage.setItem('rwa.return-to', returnPath)
  openPath('/login')
}

/** Session presence after mount (never during render, so hydration stays stable). */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => { setSignedIn(Boolean(getSessionToken())) }, [])
  return signedIn
}
