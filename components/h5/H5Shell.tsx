'use client'
import { AiOverlay } from './AiOverlay'
import { ProfileOverlay } from './ProfileOverlay'
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

/** On the main pages a swipe toward the trailing side draws out the personal centre (2026-11-01). */
function useProfileSwipe(enabled: boolean, open: () => void) {
  useEffect(() => {
    if (!enabled) return
    let sx = 0, sy = 0, live = false
    const rtl = document.documentElement.dir === 'rtl' || document.dir === 'rtl'
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      const target = e.target as HTMLElement | null
      sx = t.clientX; sy = t.clientY
      // Keep the system's edge gesture, an open layer, fields and canvases out of it.
      live = e.touches.length === 1 && sx > 24 && sx < window.innerWidth - 24 && !document.documentElement.dataset.aiOpen
        && !target?.closest('input,textarea,select,canvas,video,[role="dialog"],[data-no-swipe]') && !scrollsSideways(target)
    }
    const move = (e: TouchEvent) => {
      if (!live) return
      const t = e.touches[0]
      const dx = (rtl ? -1 : 1) * (t.clientX - sx), dy = t.clientY - sy
      if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx)) { live = false; return }
      if (dx > 72 && Math.abs(dy) < dx * .5) { live = false; open() }
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move) }
  }, [enabled, open])
}

export function H5Shell({ h, children }: { h: H5Controller; children: ReactNode }) {
  const { locale } = useI18n()
  const update = useFreshBuild()
  const shellCopy = rwaH5Copy[locale].shell
  const { screen, go, isOnline, theme, mode, showDock, isFloatingSheet, dockActiveScreen, navigationMotion, sessionMode } = h
  useProfileSwipe(showDock && !isFloatingSheet && screen !== 'community' && sessionMode !== 'guest', () => go('profile'))
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
