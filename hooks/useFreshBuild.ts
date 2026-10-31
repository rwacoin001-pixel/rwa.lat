'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Keeps a long-lived app on the current release (2026-10-30). The site is a single-page app: a phone that keeps the
 * Android app or a browser tab alive for days never loads new code, so fixes did not reach it. On start we note the
 * build named by /app-pack/manifest.json. Whenever the app comes back to the front after at least a minute away and a
 * newer build is live, we show a small "new version" prompt. The page reloads only when the user taps it, and only
 * when nothing is unsent: never on back navigation, never in a money flow, an open sheet, a form or a draft
 * (2026-10-31: the old version reloaded by itself on return, which read as the back button refreshing the page).
 */
const MANIFEST = '/app-pack/manifest.json'
const AWAY_MS = 60_000
const IDLE_CHECK_MS = 2_000
// Money flows, sign-in, KYC, and the places where people write: DM threads, community posts.
const BUSY_PATH = /\/(?:cash|deposit|withdraw|transfer|order|subscribe|redeem|kyc|security|auth|login|register|recovery|verify|community\/(?:messages|post))/

async function currentBuild(): Promise<string | null> {
  try {
    const res = await fetch(MANIFEST, { cache: 'no-store', credentials: 'omit' })
    if (!res.ok) return null
    const body = await res.json() as { build?: unknown }
    return typeof body.build === 'string' && body.build ? body.build : null
  } catch { return null }
}

const TEXT_INPUT = ':not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="range"]):not([type="color"])'

/** True while leaving the page would lose something: a money path, an open dialog or sheet, a request in flight, or text typed but not sent. */
function hasUnsent(): boolean {
  if (BUSY_PATH.test(window.location.pathname)) return true
  if (document.querySelector('[role="dialog"][aria-modal="true"], [data-sheet-open], button[aria-busy="true"], form [aria-busy="true"]')) return true
  // Text-like fields only: a checkbox or radio always reports a value ("on"), so it would look typed forever.
  const typed = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`textarea, input${TEXT_INPUT}`)).some((el) => el.value.trim() !== '')
  return typed || Array.from(document.querySelectorAll('[contenteditable="true"]')).some((el) => (el.textContent ?? '').trim() !== '')
}

/** `ready` is true when a newer build is live and the user is idle; `apply` reloads, but only if still idle. */
export function useFreshBuild(): { ready: boolean; apply: () => void } {
  const [stale, setStale] = useState(false)
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let loaded: string | null = null
    let hiddenAt = 0
    let cancelled = false
    void currentBuild().then(build => { if (!cancelled) loaded = build })
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (!loaded || !hiddenAt || Date.now() - hiddenAt < AWAY_MS) return
      hiddenAt = 0
      const latest = await currentBuild()
      if (!latest || latest === loaded || cancelled) return
      setStale(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  // While a newer build waits, keep checking whether the user has become idle, so the prompt appears then (and hides again if they start typing).
  useEffect(() => {
    if (!stale) { setIdle(false); return }
    const check = () => setIdle(!hasUnsent())
    check()
    const timer = window.setInterval(check, IDLE_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [stale])

  const apply = useCallback(() => { if (!hasUnsent()) window.location.reload() }, [])
  return { ready: stale && idle, apply }
}
