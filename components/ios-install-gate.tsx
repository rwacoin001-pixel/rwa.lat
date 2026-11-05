'use client'

/**
 * iPhone runs A-REIT as a Home Screen web app, but guests register in Safari first: the installed
 * app does not inherit Safari's storage, so an invite link opened in Safari, then the sign-up, must
 * both happen in Safari for the invite to bind. The gate therefore only covers signed-in sessions.
 *
 * - Right after a sign-up / sign-in in Safari: the "welcome" guide (registration done, add to Home
 *   Screen, sign in once more in the app), with "Later" at once.
 * - A Safari tab that was already signed in: the full guide, the exit after 30 s as before.
 *
 * Never shown: off iPhone, to guests, when standalone (opened from the icon), on auth callbacks /
 * email token links / legal pages, or after the user takes the session-only exit.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { readSession, SESSION_CHANGED } from '@/lib/api/_http'
import { referralMeQuiet } from '@/lib/api/referral'
import { detectEnv, isStandalone, type InstallEnv } from './home/install-env'
import styles from './ios-install-gate.module.css'

// The guide (copy, drawings, styles) loads only once a gate is actually due.
type ViewModule = typeof import('./ios-install-gate-view')
type Mode = 'gate' | 'welcome'

const BYPASS_KEY = 'rwa.ios-gate.bypass'
// Set when a session is created in this Safari tab; survives the full-page redirect that ends sign-in.
const FRESH_KEY = 'rwa.ios-gate.fresh'
// Links that must open in whatever browser they land in: OAuth returns, email tokens, documents, tooling.
const EXEMPT = /^\/(auth|terms|privacy|dev|design-preview|desktop)(\/|$)/
// Safari can always add to the Home Screen; the exit only appears once someone has clearly tried.
const SAFARI_EXIT_DELAY_MS = 30_000

const storage = {
  get: (key: string) => { try { return sessionStorage.getItem(key) } catch { return null } },
  set: (key: string) => { try { sessionStorage.setItem(key, '1') } catch { /* this render still decides */ } },
  drop: (key: string) => { try { sessionStorage.removeItem(key) } catch { /* nothing to drop */ } },
}

function dueMode(): Mode | null {
  if (!/iPhone|iPod/.test(navigator.userAgent) || isStandalone()) return null
  if (storage.get(BYPASS_KEY) === '1' || !readSession()) return null
  return storage.get(FRESH_KEY) === '1' ? 'welcome' : 'gate'
}

export default function IosInstallGate() {
  const pathname = usePathname()
  const { locale, setLocale } = useI18n()
  const { theme } = useRwaTheme()
  const [mode, setMode] = useState<Mode | null>(null)
  const [view, setView] = useState<ViewModule | null>(null)
  const [env, setEnv] = useState<InstallEnv | null>(null)
  // undefined = still asking the API; the welcome only says "invite bound" once it answered true.
  const [bound, setBound] = useState<boolean | undefined>(undefined)
  const [exempt, setExempt] = useState(true)
  const [exitReady, setExitReady] = useState(false)

  // Decided before paint so the App never flashes underneath; the guide fills the cover once loaded.
  useLayoutEffect(() => {
    setMode(dueMode())
    const onSession = () => {
      // A new session in this Safari tab = a sign-up or sign-in just finished; a cleared one closes the guide.
      if (readSession() && /iPhone|iPod/.test(navigator.userAgent) && !isStandalone()) storage.set(FRESH_KEY)
      else storage.drop(FRESH_KEY)
      setMode(dueMode())
    }
    window.addEventListener(SESSION_CHANGED, onSession)
    return () => window.removeEventListener(SESSION_CHANGED, onSession)
  }, [])
  useLayoutEffect(() => { setExempt(EXEMPT.test(pathname) || new URLSearchParams(location.search).has('token')) }, [pathname])

  const open = mode !== null && !exempt
  useEffect(() => {
    if (!open || view) return
    setEnv(detectEnv())
    // A chunk that never arrives must not strand the user behind a blank cover.
    void import('./ios-install-gate-view').then(setView, () => setMode(null))
  }, [open, view])
  useEffect(() => {
    if (!open || mode !== 'welcome' || bound !== undefined) return
    let live = true
    void referralMeQuiet().then(result => { if (live) setBound(result.ok && result.data.inviterBound === true) })
    return () => { live = false }
  }, [open, mode, bound])
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = previous }
  }, [open])
  useEffect(() => {
    if (!open || !env) return
    const delay = mode === 'welcome' || env.kind !== 'ios-safari' ? 0 : SAFARI_EXIT_DELAY_MS
    const timer = window.setTimeout(() => setExitReady(true), delay)
    return () => window.clearTimeout(timer)
  }, [open, env, mode])

  if (!open) return null
  const tone = theme === 'dark' ? 'dark' : 'light'
  if (!view || !env || (mode === 'welcome' && bound === undefined)) return <div className={styles.gate} data-theme={tone} aria-busy="true" />
  const leave = () => {
    storage.set(BYPASS_KEY)
    storage.drop(FRESH_KEY)
    setMode(null)
  }
  const View = view.default
  return <View env={env} locale={locale} onLocaleChange={setLocale} theme={tone} exitReady={exitReady} onLeave={leave}
    welcome={mode === 'welcome' ? { bound: bound === true } : undefined} />
}
