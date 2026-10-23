'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import RwaLogoMark from '../rwa-logo'
import styles from './Onboarding.module.css'

/**
 * First-run guide for the palette A preview: three swipeable pages, each with one thing to touch.
 *   1 What you invest in: pick office / logistics / park, the photo follows (and drifts with the pointer).
 *   2 Where income comes from: rent flows tenant → property → trust → you; drag to fill your units of one property.
 *   3 How you are protected: the three checks tick in turn; tap one to read it.
 * Illustrative only: no amounts, no rates, no promises.
 */
const KIND_IMAGES = ['/media/palette-a/onboard-office.webp', '/media/palette-a/onboard-logistics.webp', '/media/palette-a/onboard-park.webp']
// Page 3 reuses the login pavilion (light and dark versions of the same view).
const TRUST_IMAGES = { light: '/media/palette-a/login-light.webp', dark: '/media/palette-a/login-dark.webp' }
const PAGES = 3

export default function Onboarding({ locale, onDone }: { locale: AppLocale; onDone: (intent: 'create' | 'signin') => void }) {
  const copy = paletteAOnboarding(locale)
  const rtl = locale === 'ar'
  const [page, setPage] = useState(0)
  const [kind, setKind] = useState(0)
  const [picked, setPicked] = useState(false)
  const [units, setUnits] = useState(12)
  const [open, setOpen] = useState<number | null>(null)
  const [drag, setDrag] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; t: number; axis?: 'x' | 'y' } | null>(null)
  const reduced = useRef(false)

  useEffect(() => { reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches }, [])

  const go = useCallback((next: number) => {
    const target = Math.max(0, Math.min(PAGES - 1, next))
    setPage(current => {
      if (current !== target) { try { navigator.vibrate?.(8) } catch { /* Haptics are optional. */ } }
      return target
    })
  }, [])

  // Page 1 cycles through the three kinds until the user picks one.
  useEffect(() => {
    if (page !== 0 || picked || reduced.current) return
    const timer = setInterval(() => setKind(value => (value + 1) % 3), 3200)
    return () => clearInterval(timer)
  }, [page, picked])

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(page + (rtl ? -1 : 1))
      if (event.key === 'ArrowLeft') go(page + (rtl ? 1 : -1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go, page, rtl])

  // Gentle parallax: the photos lean away from the pointer / finger.
  const lean = (event: ReactPointerEvent) => {
    const el = root.current
    if (!el || reduced.current) return
    const box = el.getBoundingClientRect()
    el.style.setProperty('--px', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3))
    el.style.setProperty('--py', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3))
  }

  const down = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('input, button, [data-no-swipe]')) return
    start.current = { x: event.clientX, y: event.clientY, t: performance.now() }
  }
  const move = (event: ReactPointerEvent) => {
    lean(event)
    const s = start.current
    if (!s) return
    const dx = event.clientX - s.x, dy = event.clientY - s.y
    if (!s.axis && Math.hypot(dx, dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (s.axis === 'x') {
      const edge = (page === 0 && dx > 0 !== rtl) || (page === PAGES - 1 && dx < 0 !== rtl)
      setDrag(edge ? dx * .3 : dx)
    }
  }
  const up = (event: ReactPointerEvent) => {
    const s = start.current
    start.current = null
    if (!s || s.axis !== 'x') { setDrag(0); return }
    const dx = event.clientX - s.x
    const width = root.current?.clientWidth ?? 390
    const fast = Math.abs(dx) / Math.max(1, performance.now() - s.t) > .45
    setDrag(0)
    if (Math.abs(dx) > width * .18 || (fast && Math.abs(dx) > 24)) go(page + ((dx < 0) !== rtl ? 1 : -1))
  }

  const pick = (index: number) => { setPicked(true); setKind(index) }
  const track = { '--page': page, '--drag': `${drag}px` } as CSSProperties
  const last = page === PAGES - 1

  return <div ref={root} className={styles.root} dir={rtl ? 'rtl' : 'ltr'} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    role="region" aria-roledescription="carousel" aria-label="A-REIT">
    <header className={styles.top}>
      <RwaLogoMark className={styles.mark} width={36} height={20} label="A-REIT" />
      {!last && <button type="button" className={styles.skip} onClick={() => onDone('signin')}>{copy.skip}</button>}
    </header>

    <div className={styles.track} style={track} data-dragging={drag !== 0 || undefined}>
      {/* 1 · What you invest in */}
      <section className={styles.page} aria-hidden={page !== 0} aria-label={copy.step.replace('{n}', '1')}>
        <div className={styles.media}>
          {KIND_IMAGES.map((src, index) => <div key={src} className={styles.photo} data-on={index === kind || undefined} style={{ backgroundImage: `url('${src}')` }} />)}
          <div className={styles.fade} />
        </div>
        <div className={styles.copy}>
          <p className={styles.kicker}><span>01</span>{copy.s1.kicker}</p>
          <h2 className={styles.title}>{copy.s1.title}</h2>
          <p className={styles.body}>{copy.s1.body}</p>
          <div className={styles.kinds} role="tablist" data-no-swipe="">
            {copy.s1.kinds.map((label, index) => <button key={label} type="button" role="tab" aria-selected={index === kind} className={styles.kind} onClick={() => pick(index)}>
              {label}{index === kind && !picked && <i className={styles.kindTimer} aria-hidden="true" />}
            </button>)}
          </div>
        </div>
      </section>

      {/* 2 · Where income comes from */}
      <section className={styles.page} aria-hidden={page !== 1} aria-label={copy.step.replace('{n}', '2')}>
        <div className={styles.media}>
          <div className={styles.photo} data-on="" data-soft="" style={{ backgroundImage: `url('${KIND_IMAGES[kind]}')` }} />
          <div className={styles.fade} />
          <div className={styles.flowCard} data-no-swipe="">
            <ol className={styles.flow} data-live={page === 1 || undefined}>
              {copy.s2.flow.map((label, index) => <li key={label} data-you={index === 3 || undefined}><span>{label}</span></li>)}
            </ol>
            <div className={styles.grid} aria-hidden="true">
              {Array.from({ length: 100 }, (_, index) => <i key={index} data-on={index < units || undefined} style={{ '--i': index } as CSSProperties} />)}
            </div>
            <p className={styles.gridCaption}>{copy.s2.ofBuilding}</p>
          </div>
        </div>
        <div className={styles.copy}>
          <p className={styles.kicker}><span>02</span>{copy.s2.kicker}</p>
          <h2 className={styles.title}>{copy.s2.title}</h2>
          <p className={styles.body}>{copy.s2.body}</p>
          <label className={styles.slider} data-no-swipe="">
            <span className={styles.sliderHead}><span>{copy.s2.shares}</span><b>{units} <small>/ 100 {copy.s2.unit}</small></b></span>
            <input type="range" min={1} max={100} value={units} onChange={event => setUnits(Number(event.target.value))} style={{ '--v': `${units}%` } as CSSProperties} />
          </label>
          <p className={styles.note}>{copy.s2.note}</p>
        </div>
      </section>

      {/* 3 · How you are protected */}
      <section className={styles.page} aria-hidden={page !== 2} aria-label={copy.step.replace('{n}', '3')}>
        <div className={styles.media} data-short="">
          <div className={styles.photo} data-on="" data-light="" style={{ backgroundImage: `url('${TRUST_IMAGES.light}')` }} />
          <div className={styles.photo} data-on="" data-dark="" style={{ backgroundImage: `url('${TRUST_IMAGES.dark}')` }} />
          <div className={styles.fade} />
        </div>
        <div className={styles.copy}>
          <p className={styles.kicker}><span>03</span>{copy.s3.kicker}</p>
          <h2 className={styles.title}>{copy.s3.title}</h2>
          <ul className={styles.checks} data-live={page === 2 || undefined} data-no-swipe="">
            {copy.s3.rows.map(([label, detail], index) => <li key={label} style={{ '--i': index } as CSSProperties} data-open={open === index || undefined}>
              <button type="button" aria-expanded={open === index} onClick={() => setOpen(value => value === index ? null : index)}>
                <span className={styles.tick} aria-hidden="true"><Check size={14} strokeWidth={2.6} /></span>
                <span className={styles.checkLabel}>{label}</span>
                <ChevronDown size={16} className={styles.chev} aria-hidden="true" />
              </button>
              <p>{detail}</p>
            </li>)}
          </ul>
        </div>
      </section>
    </div>

    <footer className={styles.foot}>
      <div className={styles.dots} role="tablist">
        {Array.from({ length: PAGES }, (_, index) => <button key={index} type="button" role="tab" aria-selected={index === page} aria-label={copy.step.replace('{n}', String(index + 1))} onClick={() => go(index)} data-done={index < page || undefined} />)}
      </div>
      {last
        ? <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => onDone('create')}><span>{copy.create}</span><span className={styles.primaryIcon}><ArrowRight size={18} strokeWidth={2} /></span></button>
            <button type="button" className={styles.secondary} onClick={() => onDone('signin')}>{copy.signIn}</button>
          </div>
        : <button type="button" className={styles.primary} onClick={() => go(page + 1)}><span>{copy.next}</span><span className={styles.primaryIcon}><ArrowRight size={18} strokeWidth={2} /></span></button>}
    </footer>
  </div>
}
