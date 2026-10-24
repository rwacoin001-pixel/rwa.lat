'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Check, Gift, Languages, LoaderCircle } from 'lucide-react'
import { localeOptions, useI18n, type AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import { displayInviteCode } from '@/lib/referral-invite'
import { inviteCopy, type InviteCodeState } from '../screens/InviteCodeField'
import RwaLogoMark from '../rwa-logo'
import { AppOffer, useAppOffer } from './AppOffer'
import styles from './GuideCarousel.module.css'

/**
 * First-run guide (palette A), from the Radium study.
 * - One product per card; the card IS the colour (a same-hue gradient lit from the top).
 * - The hero is a simple, iconic product shot in its own true colours (no tint), standing in a soft pool of light:
 *   Radium's objects are simple, the richness is in what surrounds them.
 * - "Specimen" detail: thin corner brackets frame the hero and two hairline callouts point at it; they draw in each time
 *   the card becomes current. Fine contour lines drift behind.
 * - Large, light type: a thin counting number, a light title, a small tracked label; 1.5 px icons.
 * - Neighbours peek at the sides; the hero moves faster than its card while dragging; a change is one quick spring,
 *   then a long, still hold.
 * Under the cards: one bar for the invitation code and Sign in / sign up (signup still asks a new account for a code).
 */
const ART = '/media/palette-a/guide'
const CARDS = [
  { hero: 'object-reit', from: '#3fd3b8', to: '#00806b', value: 3 },
  { hero: 'object-basket', from: '#22d0d6', to: '#00808a', value: 1 },
  { hero: 'object-koala', from: '#56c6f0', to: '#0077b0', value: 100 },
  { hero: 'object-ai', from: '#2ccce4', to: '#007c99', value: 24 },
] as const
/** Two callouts per card: anchor on the object [x %, y %] → label at [x %, y %] (of the hero box), and its side. */
const CALLOUTS: [number, number, number, number, 'l' | 'r'][][] = [
  [[66, 34, 92, 14, 'r'], [30, 74, 6, 92, 'l']],
  [[40, 44, 8, 16, 'l'], [70, 60, 94, 86, 'r']],
  [[64, 22, 92, 8, 'r'], [30, 78, 6, 94, 'l']],
  [[50, 40, 92, 16, 'r'], [42, 82, 6, 94, 'l']],
]
const AUTO_MS = 4800
const GAP = 12
const CUT = { type: 'spring', stiffness: 260, damping: 32, mass: .9 } as const
const EASE = [.65, 0, .35, 1] as const

const COPY: Partial<Record<AppLocale, { units: string[]; facts: string[]; code: string; note: string; tags: [string, string][]; lang: string }>> = {
  'zh-CN': {
    tags: [['写字楼 · 物流 · 产业园', '按份额参与'], ['多种资产', '一次配置'], ['规则驱动', '过程可回看'], ['随时提问', '帮你读懂条款']],
    lang: '语言',
    units: ['类空间', '次配置', '% 规则驱动', 'h 随时问'],
    facts: ['写字楼 · 物流仓 · 产业园', '多种资产，一次配好', '过程透明，可以回看', '不懂就问，帮你看明白'],
    code: '邀请码（新用户填写）', note: '老用户直接登录；新用户现在填，或注册时再填',
  },
  en: {
    tags: [['Offices · logistics · parks', 'By the share'], ['Many assets', 'One setup'], ['Rule-driven', 'Easy to review'], ['Ask any time', 'Reads the fine print']],
    lang: 'Language',
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

/** Hairline callouts: a dot on the object, a line that draws out, a small tracked label. */
function Callouts({ i, active, tags }: { i: number; active: boolean; tags: [string, string] }) {
  return <>
    <svg className={styles.callouts} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {CALLOUTS[i].map(([ax, ay, lx, ly], k) => <motion.path key={k} d={`M${ax} ${ay} L${(ax + lx) / 2} ${ly} L${lx} ${ly}`} vectorEffect="non-scaling-stroke"
        initial={false} animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }} transition={{ duration: active ? .7 : .2, delay: active ? .35 + k * .18 : 0, ease: EASE }} />)}
    </svg>
    {CALLOUTS[i].map(([ax, ay, lx, ly, side], k) => <span key={k}>
      <motion.i className={styles.dot} style={{ left: `${ax}%`, top: `${ay}%` }} initial={false} animate={{ scale: active ? 1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20, delay: active ? .3 + k * .18 : 0 }} />
      <motion.small className={styles.tag} data-side={side} style={{ left: `${lx}%`, top: `${ly}%` }} initial={false}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 4 }} transition={{ duration: .4, delay: active ? .8 + k * .18 : 0 }}>{tags[k]}</motion.small>
    </span>)}
  </>
}

/** Language: a small round button and a short list. */
function LangSwitch({ label }: { label: string }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [open])
  return <div className={styles.lang} ref={wrap}>
    <button type="button" className={styles.langBtn} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <Languages size={14} strokeWidth={1.5} aria-hidden="true" /><span>{locale === 'zh-CN' ? '中' : locale.toUpperCase()}</span>
    </button>
    {open && <motion.div className={styles.langMenu} role="menu" initial={{ opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .18 }}>
      {localeOptions.map(o => <button key={o.code} type="button" role="menuitemradio" aria-checked={locale === o.code} onClick={() => { setLocale(o.code); setOpen(false) }}>{o.label}</button>)}
    </motion.div>}
  </div>
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
      <i className={styles.pool} />
      <span className={styles.brackets} aria-hidden="true"><i /><i /><i /><i /></span>
      <motion.img className={styles.hero} src={`${ART}/${card.hero}.webp`} alt="" draggable={false}
        animate={active ? { y: [0, -5, 0] } : { y: 0 }} transition={active ? { duration: 5.6, ease: 'easeInOut', repeat: Infinity } : { duration: .3 }} />
      <Callouts i={i} active={active} tags={c.tags[i]} />
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
      <div className={styles.topRight}>
        <span className={styles.count}><b>0{index + 1}</b> / 04</span>
        <LangSwitch label={(COPY[locale] ?? COPY.en!).lang} />
      </div>
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
