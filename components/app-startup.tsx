'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Container } from '@tsparticles/engine'
import { useRwaTheme } from '@/lib/rwa-theme'
import { APP_STARTUP_KEY, shouldShowAppStartup } from '@/lib/app-startup'
import styles from './app-startup.module.css'

// The existing brand paths, translated to their own 206 × 104 coordinate box.
const paths = [
  'M0 0h51l27.3 53.1-13.1 24.4c-2.8 5.2-7.2 8.1-12.5 8.1-6.1 0-11.4-3.6-14.3-9.2L0 0Z',
  'M78.3 53.1l12.4-26.2c2.8-5.9 7.4-9.1 13.1-9.1 6.2 0 10.9 3.5 13.7 9.4L154 104h-51.2l-24.5-50.9Z',
  'M155.4 0H206l-25.9 51.9h-28.2c-5.3 0-9.5-2.2-12.2-6.3-2.8-4.2-3.1-8.9-.8-13.6l16.5-32Z',
]

let engineReady: Promise<typeof import('@tsparticles/engine')['tsParticles']> | undefined
async function particleEngine() {
  engineReady ??= (async () => {
    const [{ tsParticles }, { loadBasic }, { loadPolygonMaskPlugin }] = await Promise.all([
      import('@tsparticles/engine'), import('@tsparticles/basic'), import('@tsparticles/plugin-polygon-mask'),
    ])
    await loadBasic(tsParticles)
    await loadPolygonMaskPlugin(tsParticles)
    return tsParticles
  })().catch(error => { engineReady = undefined; throw error })
  return engineReady
}

/** Reusable visual for the dev preview; no requests, account data or navigation. */
export function ParticleStartupVisual({ theme, leaving = false }: { theme: 'light' | 'dark'; leaving?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    let container: Container | undefined
    void (async () => {
      const engine = await particleEngine()
      if (!alive || !host.current) return
      const instance = await engine.load({
        id: `rwa-startup-${id}`, element: host.current,
        options: {
          fullScreen: { enable: false }, detectRetina: false, fpsLimit: 45,
          pauseOnBlur: true, pauseOnOutsideViewport: true,
          particles: {
            number: { value: 320 }, color: { value: theme === 'dark' ? ['#f3dcac', '#e0b578', '#b8d3e4'] : ['#a17b43', '#c6a474', '#6c8995'] },
            shape: { type: 'circle' }, size: { value: { min: .7, max: 1.8 } },
            opacity: { value: { min: .35, max: .95 }, animation: { enable: true, speed: .8, sync: false } },
            move: { enable: true, speed: .45, outModes: { default: 'bounce' } },
          },
          polygon: {
            enable: true, type: 'inline', data: { path: paths, size: { width: 206, height: 104 } },
            scale: 1.1, position: { x: 50, y: 50 }, inline: { arrangement: 'equidistant' },
            move: { radius: 5 }, draw: { enable: false },
          },
        },
      })
      if (!alive) instance?.destroy(); else container = instance
    })().catch(() => { /* The same logo remains visible if the optional renderer cannot load. */ })
    return () => { alive = false; container?.destroy() }
  }, [id, theme])
  return <div className={styles.root} data-theme={theme} data-leaving={leaving || undefined} data-startup-visual aria-hidden="true">
    <div className={styles.halo} />
    <div className={styles.composition}>
      <div className={styles.logoStage}>
        <div className={styles.particles} ref={host} />
        <svg className={styles.mark} viewBox="0 0 206 104"><defs><linearGradient id={`rwa-metal-${id}`} x2=".8" y2="1"><stop stopColor="var(--start-metal-top)" /><stop offset=".55" stopColor="var(--start-metal)" /><stop offset="1" stopColor="var(--start-metal-end)" /></linearGradient></defs>{paths.map((d, index) => <path key={d} d={d} fill={`url(#rwa-metal-${id})`} data-wing={index} />)}</svg>
      </div>
      <span className={styles.wordmark}>RWA.LAT</span>
      <span className={styles.line} />
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
  return stage === 'idle' ? null : <ParticleStartupVisual theme={theme} leaving={stage === 'leaving'} />
}
