'use client'
import { AiOverlay } from './AiOverlay'
import { ProfileOverlay } from './ProfileOverlay'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { ToastHost } from '@/components/ui/ToastHost'
import { useI18n } from '@/lib/i18n'
import { useFreshBuild } from '@/hooks/useFreshBuild'
import { rwaH5Copy } from '@/lib/rwa-h5-copy'
import { ScreenTransition } from '../motion-effects'
import { BottomDock } from './BottomDock'
import type { H5Controller } from './useH5Controller'

export function H5Shell({ h, children }: { h: H5Controller; children: ReactNode }) {
  const { locale } = useI18n()
  useFreshBuild()
  const shellCopy = rwaH5Copy[locale].shell
  const { screen, go, isOnline, theme, mode, showDock, isFloatingSheet, dockActiveScreen, navigationMotion } = h
  return (
    <>
      <a className="skip-link" href="#main-content">{shellCopy.skipContent}</a>
      <main id="main-content" className="rwa-shell" tabIndex={-1}>
      {!isOnline && <div className="connection-banner" role="status"><AlertTriangle size={16} /><span><b>{shellCopy.offlineTitle}</b><small>{shellCopy.offlineBody}</small></span></div>}
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
