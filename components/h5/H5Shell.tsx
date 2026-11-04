'use client'
import { AiOverlay } from './AiOverlay'
import { ProfileOverlay } from './ProfileOverlay'
import { pullProfile, releaseProfile } from '@/lib/profile-overlay'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { pageTabs, place, settle, slideTab, stage } from '@/lib/page-swipe'
import { prefetchScreens } from '@/lib/prefetch-screens'
import { useEdgeBack } from './useEdgeBack'
import { markTabNavigation } from '@/lib/app-navigation'
import { ToastHost } from '@/components/ui/ToastHost'
import { useI18n } from '@/lib/i18n'
import { useFreshBuild } from '@/hooks/useFreshBuild'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import { ScreenTransition } from '../motion-effects'
import { BottomDock } from './BottomDock'
import { ConnectionBanner, NewVersionPrompt } from './NewVersionPrompt'
import type { H5Controller } from './useH5Controller'

/** A horizontally scrollable ancestor owns the swipe (carousels, chip rows, charts). */
const scrollsSideways = (from: HTMLElement | null) => {
  for (let el = from; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true
  }
  return false
}

/** Dock order, for a back swipe past a page's first tab. */
const DOCK_ORDER = ['home', 'invest', 'community', 'portfolio'] as const

/**
 * On the main pages a swipe toward the leading side draws the personal centre in from the trailing edge, following the
 * finger (2026-11-01, user: the direction was reversed, and it must follow the hand). Past a third of the width, or a
 * quick flick, it stays open; otherwise it slides back out. RTL mirrors it.
 * A page with its own top tabs (市场, 社区) takes the swipe first (2026-11-04): it steps tabs; only forward from the last
 * tab pulls the personal centre, and back from the first tab goes to the previous dock page.
 */
function usePageSwipe(enabled: boolean, profile: boolean, back: (() => void) | null) {
  const backRef = useRef(back)
  backRef.current = back
  useEffect(() => {
    if (!enabled) return
    // Warm the personal centre so the first pull has something to follow.
    if (profile) void import('../maison/AccountScreen')
    let sx = 0, sy = 0, st = 0, pulled = 0, armed = false, mode: null | 'profile' | 'tab' | 'back' = null, dir: 1 | -1 = 1
    let moving: HTMLElement[] = [], busy = false
    const rtl = () => document.documentElement.dir === 'rtl'
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      const target = e.target as HTMLElement | null
      sx = t.clientX; sy = t.clientY; st = performance.now(); pulled = 0; mode = null
      // Keep the system's edge gestures, an open layer, fields and side-scrolling rows out of it.
      armed = !busy && e.touches.length === 1 && sx > 24 && sx < window.innerWidth - 24 && !document.documentElement.dataset.aiOpen
        && !target?.closest('input,textarea,select,canvas,video,[role="dialog"],[data-no-swipe]') && !scrollsSideways(target)
    }
    const move = (e: TouchEvent) => {
      if (!armed) return
      const t = e.touches[0]
      const dx = (rtl() ? 1 : -1) * (t.clientX - sx), dy = t.clientY - sy
      if (mode === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) { armed = false; return }
        dir = dx > 0 ? 1 : -1
        const tabs = pageTabs()
        mode = tabs?.can(dir) ? 'tab' : dir === 1 && profile ? 'profile' : dir === -1 && tabs && backRef.current ? 'back' : null
        if (!mode) { armed = false; return }
        sx = t.clientX; st = performance.now()
        // The page follows the finger (2026-11-04): the tab content, or the whole page on a swipe back to the dock.
        moving = mode === 'profile' ? [] : stage(mode === 'back')
      }
      pulled = Math.max(0, dir * (rtl() ? 1 : -1) * (t.clientX - sx))
      if (mode === 'profile') pullProfile(pulled)
      else place(moving, -dir * (rtl() ? -1 : 1) * pulled)
    }
    const end = () => {
      if (!armed || !mode) { armed = false; return }
      armed = false
      const speed = pulled / Math.max(1, performance.now() - st)
      if (mode === 'profile') { releaseProfile(pulled > Math.min(window.innerWidth, 480) / 3 || (speed > .5 && pulled > 40)); return }
      const els = moving
      moving = []
      if (!(pulled > Math.min(window.innerWidth, 480) / 4 || (speed > .4 && pulled > 32))) { settle(els); return }
      const x = -dir * (rtl() ? -1 : 1) * pulled
      busy = true
      window.setTimeout(() => { busy = false }, 520)
      if (mode === 'tab') { const tabs = pageTabs(); slideTab(els, x, () => tabs?.step(dir)) }
      else { place(els, Math.sign(x) * window.innerWidth, 170); window.setTimeout(() => { backRef.current?.(); requestAnimationFrame(() => els.forEach((el) => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = '' })) }, 170) }
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', end, { passive: true })
    window.addEventListener('touchcancel', end, { passive: true })
    return () => {
      window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end)
    }
  }, [enabled, profile])
}

export function H5Shell({ h, children }: { h: H5Controller; children: ReactNode }) {
  const { locale } = useI18n()
  const update = useFreshBuild()
  const shellCopy = rwaH5Copy[locale].shell
  const { screen, go, isOnline, theme, mode, showDock, isFloatingSheet, dockActiveScreen, navigationMotion, sessionMode } = h
  const dockIndex = (DOCK_ORDER as readonly string[]).indexOf(screen)
  const backScreen = dockIndex > 0 ? DOCK_ORDER[dockIndex - 1] : null
  usePageSwipe(showDock && !isFloatingSheet, sessionMode !== 'guest', backScreen ? () => { navigator.vibrate?.(6); markTabNavigation(); go(backScreen) } : null)
  // Both notices can be put away (2026-11-01); a new offline spell shows the offline one again.
  const [offlineClosed, setOfflineClosed] = useState(false)
  const [updateLater, setUpdateLater] = useState(false)
  useEffect(() => { if (isOnline) setOfflineClosed(false) }, [isOnline])
  useEffect(() => { prefetchScreens() }, [])
  useEdgeBack(!isFloatingSheet)
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      <div className="rwa-mobile" data-theme={theme} data-mode={mode} data-screen={screen} data-dock={showDock ? 'true' : 'false'} data-sheet={isFloatingSheet ? 'true' : 'false'}>
        <ScreenTransition screenKey={screen === 'login' || screen === 'register' ? 'auth-entry' : screen} motion={navigationMotion}>
        {children}
        </ScreenTransition>
        {!isOnline && !offlineClosed ? <ConnectionBanner onClose={() => setOfflineClosed(true)} />
          : update.ready && !updateLater && <NewVersionPrompt onUpdate={update.apply} onLater={() => setUpdateLater(true)} />}
        <AiOverlay />
        <ProfileOverlay />
        {showDock && <BottomDock screen={screen} activeScreen={dockActiveScreen} setScreen={go} showQuickActions={!isFloatingSheet && screen !== 'home' && screen !== 'invest' && screen !== 'quant' && screen !== 'community'} />}
      </div>
      <ToastHost />
      </main>
    </>
  )
}
