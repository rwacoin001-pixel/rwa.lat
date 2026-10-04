'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import RwaLogoMark from '@/components/rwa-logo'
import { useRwaTheme } from '@/lib/rwa-theme'
import { APP_STARTUP_KEY, shouldShowAppStartup } from '@/lib/app-startup'
import styles from './app-startup.module.css'

/** Reusable visual for the dev preview; no requests, account data or navigation. */
export function LogoStartupVisual({ theme, leaving = false, replay = false }: { theme: 'light' | 'dark'; leaving?: boolean; replay?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    let scope: import('animejs').Scope | undefined
    // Load only for the installed-app entrance or its local preview.
    // The static brand SVG remains visible if the optional animation cannot load.
    void import('animejs').then(({ createScope, createTimeline }) => {
      if (!alive || !host.current) return
      scope = createScope({ root: host.current }).add(() => {
        const timeline = createTimeline({ defaults: { ease: 'outExpo' }, loop: replay, loopDelay: 1000 })
        timeline
          .add('[data-logo-piece="0"]', { x: [-14, 0], y: [-8, 0], rotate: [-3, 0], opacity: [0, 1], duration: 760 }, 0)
          .add('[data-logo-piece="1"]', { y: [14, 0], rotate: [2, 0], opacity: [0, 1], duration: 760 }, 110)
          .add('[data-logo-piece="2"]', { x: [14, 0], y: [-10, 0], rotate: [3, 0], opacity: [0, 1], duration: 760 }, 220)
          .add('[data-logo-sheen]', { maskPosition: ['100% 0%', '0% 0%'], opacity: [0, .28, 0], duration: 550, ease: 'inOutSine' }, 800)
      })
    }).catch(() => { /* Preserve the complete canonical logo without animation. */ })
    return () => { alive = false; scope?.revert() }
  }, [theme, replay])
  const primary = theme === 'dark' ? '#FFFFFF' : '#0D0D0D'
  const accent = theme === 'dark' ? '#2FE6BF' : '#0E8F7A'
  return <div className={styles.root} data-theme={theme} data-leaving={leaving || undefined} data-startup-visual aria-hidden="true">
    <div className={styles.logoStage} ref={host}>
      {[0, 1, 2].map(piece => <div key={piece} className={styles.piece} data-logo-piece={piece}>
        <RwaLogoMark label="" primaryColor={primary} accentColor={accent} />
      </div>)}
      <div className={styles.sheen} data-logo-sheen><RwaLogoMark label="" primaryColor="#FFFFFF" accentColor="#FFFFFF" /></div>
    </div>
  </div>
}

/** One bounded entrance per app session, independent of account/network loading. */
export default function AppStartup() {
  const pathname = usePathname()
  const { theme } = useRwaTheme()
  const attempted = useRef(false)
  const [stage, setStage] = useState<'idle' | 'visible' | 'leaving'>('idle')
  useEffect(() => {
    if (attempted.current) return
    const installed = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone) || /RwaLatAndroidTrial\//.test(navigator.userAgent)
    let seen = false
    try { seen = sessionStorage.getItem(APP_STARTUP_KEY) === '1' } catch { /* Private mode still gets a bounded entrance. */ }
    if (!shouldShowAppStartup({ pathname, installed, seen, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches })) return
    attempted.current = true
    try { sessionStorage.setItem(APP_STARTUP_KEY, '1') } catch { /* In-memory ref also prevents navigation repeats. */ }
    setStage('visible')
    const fade = window.setTimeout(() => setStage('leaving'), 1550)
    const done = window.setTimeout(() => setStage('idle'), 1830)
    const hide = () => { if (document.hidden) setStage('idle') }
    document.addEventListener('visibilitychange', hide)
    return () => { clearTimeout(fade); clearTimeout(done); document.removeEventListener('visibilitychange', hide); setStage('idle') }
  }, [pathname])
  return stage === 'idle' ? null : <LogoStartupVisual theme={theme} leaving={stage === 'leaving'} />
}
