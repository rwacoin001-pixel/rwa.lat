'use client'

import { useEffect } from 'react'

/**
 * Keeps a long-lived app on the current release (2026-10-30). The site is a single-page app: a phone that keeps the
 * Android app or a browser tab alive for days never loads new code, so fixes did not reach it. On start we note the
 * build named by /app-pack/manifest.json; whenever the app comes back to the front (after at least a minute away) we
 * ask again, and if a newer build is live we reload — but never in the middle of a money flow or an open sheet.
 */
const MANIFEST = '/app-pack/manifest.json'
const AWAY_MS = 60_000
const BUSY_PATH = /\/(?:cash|deposit|withdraw|transfer|order|subscribe|redeem|kyc|security|auth|login|register|recovery|verify)/

async function currentBuild(): Promise<string | null> {
  try {
    const res = await fetch(MANIFEST, { cache: 'no-store', credentials: 'omit' })
    if (!res.ok) return null
    const body = await res.json() as { build?: unknown }
    return typeof body.build === 'string' && body.build ? body.build : null
  } catch { return null }
}

export function useFreshBuild() {
  useEffect(() => {
    let loaded: string | null = null
    let hiddenAt = 0
    let cancelled = false
    void currentBuild().then(build => { if (!cancelled) loaded = build })
    const onVisibility = async () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return }
      if (!loaded || !hiddenAt || Date.now() - hiddenAt < AWAY_MS) return
      const latest = await currentBuild()
      if (!latest || latest === loaded || cancelled) return
      const busy = BUSY_PATH.test(window.location.pathname) || document.documentElement.hasAttribute('data-sheet-open')
        || document.querySelector('form [aria-busy="true"], [role="dialog"][aria-modal="true"]')
      if (busy) return
      window.location.reload()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
}
