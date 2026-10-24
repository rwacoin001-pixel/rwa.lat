'use client'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import dynamic from 'next/dynamic'
import { ArrowRight } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import { useRwaTheme } from '@/lib/rwa-theme'
import { InviteCodeField, type InviteCodeState } from '../screens/InviteCodeField'
import RwaLogoMark from '../rwa-logo'
import { createSceneStore } from './OnboardingCanvas'

// three + drei load only when the guide shows.
const OnboardingCanvas = dynamic(() => import('./OnboardingCanvas'), { ssr: false })
import styles from './Onboarding.module.css'

/**
 * First-run guide v2 (palette A preview): four pages, one gesture each, no "next" buttons.
 *   0 press and hold the blob   → it squashes, glows, and lets you in
 *   1 drag the carousel         → four material-swapped objects; once you have seen all four, the guide moves on
 *   2 wipe the frosted glass    → "source · fees · risk" come into view
 *   3 pull the liquid-metal drop → invite friends; the invitation code typed here is the one signup uses
 * The sculptures are live three.js via @react-three/fiber + drei (OnboardingCanvas.tsx); Android's WebView, reduced motion and no-WebGL get still posters.
 */
const PAGES = 4
const POSTERS = ['poster-0', 'poster-1', 'poster-2', 'poster-3'].map(name => `/media/palette-a/onboard-v2/${name}.webp`)
const TILE_COLS = 6, TILE_ROWS = 7
const HOLD_MS = 900

export default function Onboarding({ locale, invite, onDone }: {
  locale: AppLocale
  invite: InviteCodeState
  onDone: (intent: 'create' | 'signin') => void
}) {
  const copy = paletteAOnboarding(locale)
  const rtl = locale === 'ar'
  const { theme } = useRwaTheme()
  const [page, setPage] = useState(0)
  const [live, setLive] = useState<'pending' | 'on' | 'off'>('pending')
  const [hold, setHold] = useState(0)
  const [focus, setFocus] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  const [wiped, setWiped] = useState<Set<number>>(() => new Set())
  const [cleared, setCleared] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const scene = useMemo(createSceneStore, [])
  const api = useRef<typeof scene.api | null>(null)
  const wipeBox = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; moved: number; t: number } | null>(null)
  const holdFrame = useRef(0)
  // A finger still moving from the last gesture must not land on the new page's buttons.
  const shownAt = useRef(0)
  useEffect(() => { shownAt.current = performance.now() }, [page])
  const done = (intent: 'create' | 'signin') => { if (performance.now() - shownAt.current > 500) onDone(intent) }

  const buzz = () => { try { navigator.vibrate?.(8) } catch { /* Haptics are optional. */ } }
  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(PAGES - 1, next))
    setPage(current => { if (current !== target) buzz(); return target })
  }, [])

  // Live 3D unless the shell, the user or the device says otherwise.
  useEffect(() => {
    const still = document.documentElement.dataset.shell === 'android' || matchMedia('(prefers-reduced-motion: reduce)').matches
    let webgl = false
    try { webgl = Boolean(document.createElement('canvas').getContext('webgl2')) } catch { /* No WebGL. */ }
    if (still || !webgl) setLive('off')
    else api.current = scene.api
  }, [scene])
  // If the scene has not come up after a while, show the posters instead of an empty stage.
  useEffect(() => {
    if (live !== 'pending') return
    const timer = setTimeout(() => setLive(current => current === 'pending' ? 'off' : current), 15000)
    return () => clearTimeout(timer)
  }, [live])

  // Page 1 moves on once all four objects have had their turn in front.
  useEffect(() => {
    if (page !== 1 || seen.size < 4) return
    const timer = setTimeout(() => go(2), 1400)
    return () => clearTimeout(timer)
  }, [page, seen, go])
  // Page 2: once most of the glass is wiped, the rest falls away and the guide moves on.
  useEffect(() => {
    if (page === 2 && !cleared && wiped.size >= TILE_COLS * TILE_ROWS * .55) { setCleared(true); buzz() }
  }, [page, wiped, cleared])
  useEffect(() => {
    if (page !== 2 || !cleared) return
    const timer = setTimeout(() => go(3), 1700)
    return () => clearTimeout(timer)
  }, [page, cleared, go])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(page + (rtl ? -1 : 1))
      if (event.key === 'ArrowLeft') go(page + (rtl ? 1 : -1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, page, rtl])

  // ── gestures on the stage ──
  const local = (event: ReactPointerEvent) => {
    const box = stage.current!.getBoundingClientRect()
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }
  }
  const startHold = () => {
    const begin = performance.now()
    const step = () => {
      const progress = Math.min(1, (performance.now() - begin) / HOLD_MS)
      setHold(progress)
      api.current?.setPress(progress * .9)
      if (progress < 1) holdFrame.current = requestAnimationFrame(step)
      else buzz()
    }
    holdFrame.current = requestAnimationFrame(step)
  }
  const endHold = () => {
    cancelAnimationFrame(holdFrame.current)
    setHold(current => {
      if (current >= 1) { api.current?.setPress(-.35); setTimeout(() => api.current?.setPress(0), 160); go(1) } else api.current?.setPress(0)
      return 0
    })
  }
  const wipeAt = (event: ReactPointerEvent) => {
    const box = wipeBox.current?.getBoundingClientRect()
    if (!box) return
    const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height
    const col = Math.floor(x * TILE_COLS), row = Math.floor(y * TILE_ROWS)
    if (col < 0 || row < 0 || col >= TILE_COLS || row >= TILE_ROWS) return
    const hit = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => (row + dr) * TILE_COLS + col + dc)
      .filter(index => index >= 0 && index < TILE_COLS * TILE_ROWS)
    setWiped(current => {
      if (hit.every(index => current.has(index))) return current
      const next = new Set(current); hit.forEach(index => next.add(index)); return next
    })
  }

  const down = (event: ReactPointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { x: event.clientX, y: event.clientY, moved: 0, t: performance.now() }
    if (page === 0) startHold()
    if (page === 2) wipeAt(event)
    if (page === 3) { const { x, y } = local(event); api.current?.pull(x, y) }
  }
  const move = (event: ReactPointerEvent) => {
    { const { x, y } = local(event); scene.api.point(x * 2 - 1, y * 2 - 1) }
    const g = gesture.current
    if (!g) return
    const dx = event.clientX - g.x
    g.moved += Math.abs(dx) + Math.abs(event.clientY - g.y)
    g.x = event.clientX; g.y = event.clientY
    if (page === 1) api.current?.spinBy(-dx * .012 * (rtl ? -1 : 1))
    if (page === 2) wipeAt(event)
    if (page === 3) { const { x, y } = local(event); api.current?.pull(x, y) }
  }
  const up = () => {
    const g = gesture.current
    gesture.current = null
    if (page === 0) endHold()
    if (page === 1) {
      api.current?.release()
      // Let the carousel settle, then note which object came to the front.
      setTimeout(() => {
        const index = api.current?.focus() ?? ((focus + 1) % 4)
        setFocus(index)
        setSeen(current => current.has(index) ? current : new Set(current).add(index))
        if (g && g.moved < 8) api.current?.pick(index)
        buzz()
      }, 260)
      if (!api.current && g && g.moved > 20) { const index = (focus + 1) % 4; setFocus(index); setSeen(current => new Set(current).add(index)) }
    }
    if (page === 3) api.current?.letGo()
  }

  const item = copy.s1.items[focus]
  const posterMode = live !== 'on'
  const hint = [copy.s0.hint, copy.s1.hint, copy.s2.hint, copy.s3.hint][page]

  return <div className={styles.root} dir={rtl ? 'rtl' : 'ltr'} data-page={page} data-live={live} role="region" aria-roledescription="carousel" aria-label="A-REIT">
    <header className={styles.top}>
      <RwaLogoMark className={styles.mark} width={36} height={20} label="A-REIT" />
      <div className={styles.progress} role="tablist">
        {Array.from({ length: PAGES }, (_, index) => <button key={index} type="button" role="tab" aria-selected={index === page} data-done={index < page || undefined}
          aria-label={copy.step.replace('{n}', String(index + 1))} onClick={() => go(index)}><i /></button>)}
      </div>
      {page < PAGES - 1 && <button type="button" className={styles.skip} onClick={() => go(PAGES - 1)}>{copy.skip}</button>}
    </header>

    <div ref={stage} className={styles.stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-holding={hold > 0 || undefined}
      style={{ '--hold': hold } as CSSProperties}>
      {live !== 'off' && <div className={styles.canvas} aria-hidden="true">
        <OnboardingCanvas store={scene.store} page={page} theme={theme === 'dark' ? 'dark' : 'light'} onReady={() => setLive('on')} />
      </div>}
      {posterMode && POSTERS.map((src, index) => <div key={src} className={styles.poster} data-on={index === page || undefined} style={{ backgroundImage: `url('${src}')` }} aria-hidden="true" />)}

      {page === 0 && <span className={styles.holdRing} aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" /></svg></span>}
      {page === 2 && <div ref={wipeBox} className={styles.wipe} data-cleared={cleared || undefined} aria-hidden="true">
        <div className={styles.tags}>{copy.s2.tags.map((tag, index) => <span key={tag} style={{ '--i': index } as CSSProperties}>{tag}</span>)}</div>
        <div className={styles.frost} style={{ gridTemplateColumns: `repeat(${TILE_COLS}, 1fr)`, gridTemplateRows: `repeat(${TILE_ROWS}, 1fr)` }}>
          {Array.from({ length: TILE_COLS * TILE_ROWS }, (_, index) => <i key={index} data-gone={cleared || wiped.has(index) || undefined} style={{ '--d': `${(index % TILE_COLS + Math.floor(index / TILE_COLS)) * 18}ms` } as CSSProperties} />)}
        </div>
      </div>}
      <p className={styles.hint} key={page} aria-hidden="true">{hint}</p>
    </div>

    <div className={styles.copy} key={page}>
      {page === 0 && <>
        <h1 className={styles.title}>{copy.s0.title[0]}<em>{copy.s0.title[1]}</em></h1>
        <p className={styles.sub}>{copy.s0.sub}</p>
      </>}
      {page === 1 && <>
        <h2 className={styles.title}>{copy.s1.title}</h2>
        <p className={styles.itemLine} key={focus}><b>{item[0]}</b><span>{item[1]}</span></p>
        <div className={styles.pips} aria-hidden="true">{copy.s1.items.map((_, index) => <i key={index} data-seen={seen.has(index) || undefined} data-focus={index === focus || undefined} />)}</div>
      </>}
      {page === 2 && <h2 className={styles.title}>{copy.s2.title}</h2>}
      {page === 3 && <>
        <h2 className={styles.title}>{copy.s3.title}</h2>
        <p className={styles.sub}>{copy.s3.body}</p>
        <div className={styles.invite}><InviteCodeField invite={invite} locale={locale} /></div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => done('create')}><span>{copy.create}</span><span className={styles.primaryIcon}><ArrowRight size={18} strokeWidth={2} /></span></button>
          <button type="button" className={styles.secondary} onClick={() => done('signin')}>{copy.signIn}</button>
        </div>
        <p className={styles.note}>{copy.s3.note}</p>
      </>}
    </div>
  </div>
}
