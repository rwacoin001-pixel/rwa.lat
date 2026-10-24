'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Check, Gift, LoaderCircle } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import { displayInviteCode } from '@/lib/referral-invite'
import { inviteCopy, type InviteCodeState } from '../screens/InviteCodeField'
import RwaLogoMark from '../rwa-logo'
import { AppOffer, useAppOffer } from './AppOffer'
import styles from './GuideCarousel.module.css'

/**
 * First-run guide (palette A), redesigned from the Radium study:
 * - one product per card, and the card IS the colour (The Bazaar / Health Check): a same-hue gradient, lit from the top;
 * - the hero is graded in the card's own colours, so it is lit by the card, and casts a shadow in the card's deep tone;
 * - a layer of fine white contour lines behind the hero (the detail that reads as "crafted"), drifting slowly;
 * - large but light type: a big thin number, a light title, a small label with open tracking; 1.5 px icons;
 * - neighbours peek at the sides, so swiping is obvious; the hero moves faster than its card while dragging;
 * - a change is a fast cut (spring, ~0.4 s) followed by a long, still hold.
 * Under the cards: one bar for the invitation code and Sign in / sign up (signup still asks a new account for a code).
 */
const ART = '/media/palette-a/guide'
const CARDS = [
  { hero: 'hero-reit', from: '#3fd3b8', to: '#00806b', value: 3 },
  { hero: 'hero-basket', from: '#22d0d6', to: '#00808a', value: 1 },
  { hero: 'hero-koala', from: '#56c6f0', to: '#0077b0', value: 100 },
  { hero: 'hero-ai', from: '#2ccce4', to: '#007c99', value: 24 },
] as const
const AUTO_MS = 4800
const GAP = 12
const CUT = { type: 'spring', stiffness: 260, damping: 32, mass: .9 } as const
const EASE = [.65, 0, .35, 1] as const

const COPY: Partial<Record<AppLocale, { units: string[]; facts: string[]; code: string; note: string }>> = {
  'zh-CN': {
    units: ['类空间', '次配置', '% 规则驱动', 'h 随时问'],
    facts: ['写字楼 · 物流仓 · 产业园', '多种资产，一次配好', '过程透明，可以回看', '不懂就问，帮你看明白'],
    code: '邀请码（新用户填写）', note: '老用户直接登录；新用户现在填，或注册时再填',
  },
  en: {
    units: ['kinds of space', 'setup', '% rule-driven', 'h, ask any time'],
    facts: ['Offices · logistics · parks', 'Many assets, set up once', 'In the open, easy to review', 'Ask anything, see it clearly'],
    code: 'Invitation code (new accounts)', note: 'Have an account? Just sign in. New here? Add it now or at sign-up',
  },
}

/** A number that counts up each time its card becomes the current one. */
function Count({ value, run }: { value: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!run) return
    const c = animate(0, value, { duration: .9, ease: EASE, onUpdate: v => { if (ref.current) ref.current.textContent = String(Math.round(v)) } })
    return () => c.stop()
  }, [run, value])
  return <span ref={ref}>{value}</span>
}

function Card({ i, active, step, track, tiltX, tiltY, locale }: {
  i: number; active: boolean; step: number; track: MotionValue<number>; tiltX: MotionValue<number>; tiltY: MotionValue<number>; locale: AppLocale
}) {
  const card = CARDS[i]
  const s0 = paletteAOnboarding(locale).s0
  const c = COPY[locale] ?? COPY.en!
  const text = s0.states[i]
  // Where this card sits relative to the centre, in card widths (0 = centred).
  const rel = useTransform(track, v => (v + i * step) / Math.max(1, step))
  const scale = useTransform(rel, r => 1 - Math.min(Math.abs(r), 1) * .08)
  const dim = useTransform(rel, r => Math.min(Math.abs(r), 1) * .35)
  const heroX = useTransform([rel, tiltX] as const, ([r, t]: number[]) => r * -70 + t * -10)
  const heroY = useTransform(tiltY, t => t * -8)
  const topoX = useTransform([rel, tiltX] as const, ([r, t]: number[]) => r * 30 + t * 6)
  return <motion.article className={styles.card} style={{ scale, '--from': card.from, '--to': card.to } as never} aria-hidden={!active}>
    <motion.img className={styles.topo} src={`${ART}/topo.svg`} alt="" style={{ x: topoX }} draggable={false} />
    <span className={styles.sheen} aria-hidden="true" />
    <header className={styles.cardHead}>
      <span className={styles.index}>0{i + 1}</span>
      <span className={styles.label}>{text.name}</span>
    </header>
    <motion.div className={styles.heroWrap} style={{ x: heroX, y: heroY }}>
      <i className={styles.shadow} />
      <motion.img className={styles.hero} src={`${ART}/${card.hero}.webp`} alt="" draggable={false}
        animate={active ? { y: [0, -6, 0] } : { y: 0 }} transition={active ? { duration: 5.2, ease: 'easeInOut', repeat: Infinity } : { duration: .3 }} />
    </motion.div>
    <footer className={styles.cardFoot}>
      <div className={styles.number}><b><Count value={card.value} run={active} /></b><small>{c.units[i]}</small></div>
      <h2 className={styles.title}>{text.title}</h2>
      <p className={styles.fact}>{c.facts[i]}</p>
    </footer>
    <motion.span className={styles.veil} style={{ opacity: dim }} aria-hidden="true" />
  </motion.article>
}

function EnterBar({ invite, locale, label, onEnter }: { invite?: InviteCodeState; locale: AppLocale; label: string; onEnter: () => void }) {
  const c = COPY[locale] ?? COPY.en!
  const ic = inviteCopy[locale]
  const status = invite?.status
  const locked = status === 'locked' ? invite?.locked : null
  const shown = locked ? locked.attribution.code : invite?.value ?? ''
  const ok = status === 'valid' || status === 'locked'
  const error = invite?.message === 'unavailable' ? ic.unavailable : invite?.message === 'invalid' || status === 'invalid' ? ic.invalid : ''
  return <div className={styles.enter}>
    <div className={styles.bar} data-state={error ? 'error' : ok ? 'ok' : undefined}>
      {invite && status !== 'loading' && <label className={styles.code}>
        <Gift size={15} strokeWidth={1.5} aria-hidden="true" />
        <input value={displayInviteCode(shown)} placeholder={c.code} aria-label={ic.placeholder} readOnly={status === 'locked'}
          onChange={event => invite.change(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19} dir="ltr" enterKeyHint="go"
          onKeyDown={event => { if (event.key === 'Enter') onEnter() }} aria-invalid={error ? true : undefined} />
        {status === 'checking' ? <LoaderCircle className={styles.spin} size={15} strokeWidth={1.6} aria-hidden="true" /> : ok ? <Check className={styles.ok} size={15} strokeWidth={1.8} aria-hidden="true" /> : null}
      </label>}
      <motion.button type="button" className={styles.go} onClick={onEnter} whileTap={{ scale: .96 }}>
        <span>{label}</span><i><ArrowRight size={16} strokeWidth={1.6} /></i>
      </motion.button>
    </div>
    <p className={styles.note} data-tone={error ? 'error' : undefined} aria-live="polite">{error || c.note}</p>
  </div>
}

export default function GuideCarousel({ locale, invite, onDone }: { locale: AppLocale; invite?: InviteCodeState; onDone: () => void }) {
  const all = paletteAOnboarding(locale)
  const offer = useAppOffer()
  const reduced = useReducedMotion()
  const rtl = locale === 'ar'
  const [index, setIndex] = useState(0)
  const touched = useRef(0)
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const step = width + GAP
  const track = useMotionValue(0)

  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setWidth(el.querySelector('article')?.getBoundingClientRect().width ?? el.clientWidth * .84)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The track follows the index with one quick spring: a fast cut, then stillness.
  useEffect(() => { const c = animate(track, -index * step, reduced ? { duration: 0 } : CUT); return () => c.stop() }, [index, step, track, reduced])

  const go = useCallback((next: number, by: 'user' | 'auto' = 'user') => {
    setIndex((next + CARDS.length) % CARDS.length)
    if (by === 'user') { touched.current = Date.now(); try { navigator.vibrate?.(6) } catch { /* optional */ } }
  }, [])
  useEffect(() => {
    if (reduced) return
    const t = setTimeout(() => { if (Date.now() - touched.current > 7000) go(index + 1, 'auto') }, AUTO_MS)
    return () => clearTimeout(t)
  }, [index, go, reduced])

  // Drag: the track follows the finger 1:1 (with resistance past the ends), then snaps by distance or speed.
  const drag = useRef<{ x: number; t: number; base: number; id: number } | null>(null)
  const down = (e: ReactPointerEvent) => { drag.current = { x: e.clientX, t: performance.now(), base: track.get(), id: e.pointerId }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    let v = d.base + (e.clientX - d.x)
    const min = -(CARDS.length - 1) * step
    if (v > 0) v *= .35; else if (v < min) v = min + (v - min) * .35
    track.set(v)
  }
  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dx = (e.clientX - d.x) * (rtl ? -1 : 1)
    const speed = dx / Math.max(1, performance.now() - d.t)
    let next = index
    if (dx < -step * .22 || speed < -.45) next = Math.min(CARDS.length - 1, index + 1)
    else if (dx > step * .22 || speed > .45) next = Math.max(0, index - 1)
    if (next === index) animate(track, -index * step, CUT)
    else go(next)
    touched.current = Date.now()
  }

  // Tilt (or the pointer) leans the heroes and lines a little, through springs.
  const lx = useMotionValue(0), ly = useMotionValue(0)
  const tiltX = useSpring(lx, { stiffness: 70, damping: 18 }), tiltY = useSpring(ly, { stiffness: 70, damping: 18 })
  useEffect(() => {
    const p = (e: PointerEvent) => { if (!drag.current) { lx.set((e.clientX / innerWidth) * 2 - 1); ly.set((e.clientY / innerHeight) * 2 - 1) } }
    const o = (e: DeviceOrientationEvent) => { if (e.gamma != null && e.beta != null) { lx.set(Math.max(-1, Math.min(1, e.gamma / 25))); ly.set(Math.max(-1, Math.min(1, (e.beta - 45) / 25))) } }
    addEventListener('pointermove', p, { passive: true }); addEventListener('deviceorientation', o, { passive: true })
    return () => { removeEventListener('pointermove', p); removeEventListener('deviceorientation', o) }
  }, [lx, ly])

  const enter = async () => { if (!invite || await invite.commit({ required: false })) onDone() }

  return <section className={styles.guide}>
    <header className={styles.top}>
      <RwaLogoMark className={styles.logo} width={36} height={20} label="A-REIT" accentColor={CARDS[index].from} />
      <span className={styles.count}><b>0{index + 1}</b> / 04</span>
    </header>

    <div className={styles.viewport} ref={viewport} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="region" aria-roledescription="carousel" aria-label={all.s0.swipe}>
      <motion.div className={styles.track} style={{ x: track }}>
        {CARDS.map((_, i) => <Card key={i} i={i} active={i === index} step={step} track={track} tiltX={tiltX} tiltY={tiltY} locale={locale} />)}
      </motion.div>
    </div>

    <nav className={styles.dots} role="tablist" aria-label={all.s0.swipe}>
      {all.s0.chips.map((label, i) => <button key={label} type="button" role="tab" aria-selected={i === index} aria-label={label} onClick={() => go(i)}>
        <i>{i === index && <motion.b key={index} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduced ? 0 : AUTO_MS / 1000, ease: 'linear' }} />}</i>
      </button>)}
    </nav>

    {offer && <div className={styles.offer}><AppOffer kind={offer} locale={locale} invite={invite} /></div>}
    <motion.div className={styles.enterWrap} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...CUT, delay: .35 }}>
      <EnterBar invite={invite} locale={locale} label={all.enter} onEnter={() => void enter()} />
    </motion.div>
  </section>
}
