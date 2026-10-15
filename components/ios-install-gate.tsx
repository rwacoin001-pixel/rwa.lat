'use client'

/**
 * iPhone runs A-REIT only as a Home Screen web app. In a Safari tab (or any in-app browser)
 * this full-screen gate teaches the install instead of showing the App.
 *
 * Never shown: off iPhone, when standalone (opened from the icon), on auth callbacks / email
 * token links / legal pages, or after the user takes the session-only "can't install" exit.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { useRwaTheme } from '@/lib/rwa-theme'
import { detectEnv, isStandalone, type InstallEnv } from './home/install-env'
import styles from './ios-install-gate.module.css'

// The guide (copy, drawings, styles) loads only once a gate is actually due.
type ViewModule = typeof import('./ios-install-gate-view')

const BYPASS_KEY = 'rwa.ios-gate.bypass'
// Links that must open in whatever browser they land in: OAuth returns, email tokens, documents, tooling.
const EXEMPT = /^\/(auth|terms|privacy|dev|design-preview|desktop)(\/|$)/
// Safari can always add to the Home Screen; the exit only appears once someone has clearly tried.
const SAFARI_EXIT_DELAY_MS = 30_000

export default function IosInstallGate() {
  const pathname = usePathname()
  const { locale } = useI18n()
  const { theme } = useRwaTheme()
  const [gated, setGated] = useState(false)
  const [view, setView] = useState<ViewModule | null>(null)
  const [env, setEnv] = useState<InstallEnv | null>(null)
  const [exempt, setExempt] = useState(true)
  const [exitReady, setExitReady] = useState(false)

  // Decided before paint so the App never flashes underneath; the guide fills the cover once loaded.
  useLayoutEffect(() => {
    if (!/iPhone|iPod/.test(navigator.userAgent) || isStandalone()) return
    try { if (sessionStorage.getItem(BYPASS_KEY) === '1') return } catch { /* storage blocked: still gate */ }
    setGated(true)
    setEnv(detectEnv())
    // A chunk that never arrives must not strand the user behind a blank cover.
    void import('./ios-install-gate-view').then(setView, () => setGated(false))
  }, [])
  useLayoutEffect(() => { setExempt(EXEMPT.test(pathname) || new URLSearchParams(location.search).has('token')) }, [pathname])

  const open = gated && !exempt
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => { root.style.overflow = previous }
  }, [open])
  useEffect(() => {
    if (!open || !env) return
    const timer = window.setTimeout(() => setExitReady(true), env.kind === 'ios-safari' ? SAFARI_EXIT_DELAY_MS : 0)
    return () => window.clearTimeout(timer)
  }, [open, env])

  if (!open) return null
  const tone = theme === 'dark' ? 'dark' : 'light'
  if (!view || !env) return <div className={styles.gate} data-theme={tone} aria-busy="true" />
  const leave = () => {
    try { sessionStorage.setItem(BYPASS_KEY, '1') } catch { /* this render still lets them through */ }
    setGated(false)
  }
  const View = view.default
  return <View env={env} locale={locale} theme={tone} exitReady={exitReady} onLeave={leave} />
}
