'use client'
import { AiOverlay } from './AiOverlay'
import { ProfileOverlay } from './ProfileOverlay'
import { pullProfile, releaseProfile } from '@/lib/profile-overlay'
import { useEffect, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ToastHost } from '@/components/ui/ToastHost'
import { useI18n } from '@/lib/i18n'
import { useFreshBuild } from '@/hooks/useFreshBuild'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import { ScreenTransition } from '../motion-effects'
import { BottomDock } from './BottomDock'
import { NewVersionPrompt } from './NewVersionPrompt'
import type { H5Controller } from './useH5Controller'

/** A horizontally scrollable ancestor owns the swipe (carousels, chip rows, charts). */
const scrollsSideways = (from: HTMLElement | null) => {
  for (let el = from; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true
  }
  return false
}

/**
 * On the main pages a swipe toward the leading side draws the personal centre in from the trailing edge, following the
 * finger (2026-11-01, user: the direction was reversed, and it must follow the hand). Past a third of the width, or a
 * quick flick, it stays open; otherwise it slides back out. RTL mirrors it.
 */
function useProfileSwipe(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    // Warm the personal centre so the first pull has something to follow.
    void import('../maison/AccountScreen')
    let sx = 0, sy = 0, st = 0, pulled = 0, armed = false, on: boolean | null = null
    const rtl = () => document.documentElement.dir === 'rtl'
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      const target = e.target as HTMLElement | null
      sx = t.clientX; sy = t.clientY; st = performance.now(); pulled = 0; on = null
      // Keep the system's edge gestures, an open layer, fields and side-scrolling rows out of it.
      armed = e.touches.length === 1 && sx > 16 && sx < window.innerWidth - 16 && !document.documentElement.dataset.aiOpen
        && !target?.closest('input,textarea,select,canvas,video,[role="dialog"],[data-no-swipe]') && !scrollsSideways(target)
    }
    const move = (e: TouchEvent) => {
      if (!armed) return
      const t = e.touches[0]
      const dx = (rtl() ? 1 : -1) * (t.clientX - sx), dy = t.clientY - sy
      if (on === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        on = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2
        if (!on) { armed = false; return }
        sx = t.clientX; st = performance.now()
      }
      pulled = Math.max(0, (rtl() ? 1 : -1) * (t.clientX - sx))
      pullProfile(pulled)
    }
    const end = () => {
      if (!armed || !on) { armed = false; return }
      armed = false
      const speed = pulled / Math.max(1, performance.now() - st)
      releaseProfile(pulled > Math.min(window.innerWidth, 480) / 3 || (speed > .5 && pulled > 40))
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end)
    }
  }, [enabled])
}

export function H5Shell({ h, children }: { h: H5Controller; children: ReactNode }) {
  const { locale } = useI18n()
  const update = useFreshBuild()
  const shellCopy = rwaH5Copy[locale].shell
  const { screen, go, isOnline, theme, mode, showDock, isFloatingSheet, dockActiveScreen, navigationMotion, sessionMode } = h
  useProfileSwipe(showDock && !isFloatingSheet && screen !== 'community' && sessionMode !== 'guest')
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      {!isOnline && <div className="connection-banner" role="status"><AlertTriangle size={16} /><span><b>{shellCopy.offlineTitle}</b><small>{shellCopy.offlineBody}</small></span></div>}
      {update.ready && <NewVersionPrompt onUpdate={update.apply} />}
      <div className="rwa-mobile" data-theme={theme} data-mode={mode} data-screen={screen} data-dock={showDock ? 'true' : 'false'} data-sheet={isFloatingSheet ? 'true' : 'false'}>
        <ScreenTransition screenKey={screen === 'login' || screen === 'register' ? 'auth-entry' : screen} motion={navigationMotion}>
        {children}
        </ScreenTransition>
        <AiOverlay />
        <ProfileOverlay />
        {showDock && <BottomDock screen={screen} activeScreen={dockActiveScreen} setScreen={go} showQuickActions={!isFloatingSheet && screen !== 'home' && screen !== 'invest' && screen !== 'quant' && screen !== 'community'} />}
      </div>
      <ToastHost />
      </main>
    </>
  )
}
