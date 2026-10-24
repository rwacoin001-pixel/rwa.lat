'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, animate, motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Bot, Building2, Check, Gift, Layers3, LoaderCircle, Sigma } from 'lucide-react'
import { AppOffer, useAppOffer } from './AppOffer'
import { inviteCopy, type InviteCodeState } from '../screens/InviteCodeField'
import { displayInviteCode } from '@/lib/referral-invite'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import RwaLogoMark from '../rwa-logo'
import styles from './HeroIntro.module.css'

/**
 * First-run guide (palette A), one page after Radium's state cards: one frosted card that cycles through the four
 * products, an invitation-code line, and one way in (sign in / sign up).
 * Built in layers that move on their own, so the scene has depth: a real-space photo and a coloured glow behind the
 * glass card, two rendered logo-shaped slabs that turn and recolour one after the other, a transparent CGI hero (white ceramic + cool dichroic glass) with
 * its own contact shadow, and objects orbiting in front of and behind it.
 * One teal-to-blue colour family (equal OKLCH lightness). The small glass tile stays the same in every state.
 * Swipe or tap a chip to change state; it also advances by itself.
 */
export const ART = '/media/palette-a/onboard-v7'
/** Guide layers: a real-space photo behind the glass, rendered slabs, transparent CGI heroes and orbit objects. */
const LAYERS = '/media/palette-a/onboard-v10'
const ICONS = [Building2, Layers3, Sigma, Bot]
// Pages 2–3 still use the studio cut-outs on one solid brand-green field.
export const FIELD = '#19c7aa'
const STATES = [
  { hero: 'real-reit', color: '#2dc8ac', deep: '#009f85' },
  { hero: 'real-basket', color: '#00c6ce', deep: '#009ca5' },
  { hero: 'real-quant', color: '#3abdee', deep: '#0094c3' },
  { hero: 'real-ai', color: '#07c3de', deep: '#0099b3' },
]
/** Two rendered slabs per state: [left %, top %, width %, rotate deg]. */
const SLABS: [number, number, number, number][][] = [
  [[4, 4, 54, -4], [48, 22, 42, 6], [26, 52, 30, 2]],
  [[40, 0, 54, 5], [2, 28, 44, -6], [60, 54, 28, 8]],
  [[8, 10, 48, 4], [50, 2, 44, -5], [30, 56, 34, -2]],
  [[24, 0, 52, -6], [0, 34, 40, 8], [62, 40, 30, -4]],
]
/** The slab is rendered once in teal; these hue turns take it to each state's colour. */
const HUE = [0, 22, 48, 34]
const AUTO_MS = 4200
export const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: .9 } as const
export const SOFT = { type: 'spring', stiffness: 140, damping: 20 } as const
export const EASE = [.65, 0, .35, 1] as const

/** One satellite on an elliptical orbit around the hero; near side in front and sharp, far side behind and blurred. */
export function Satellite({ src, phase, radius, speed, base = ART }: { src: string; phase: number; radius: number; speed: number; base?: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const reduced = useReducedMotion()
  useAnimationFrame(time => {
    const el = ref.current
    if (!el) return
    const a = phase + (reduced ? 0 : time / 1000) * speed
    const depth = Math.sin(a) // -1 far … +1 near
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius * .28 - depth * 10
    const scale = .62 + (depth + 1) * .26
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${(a * 40).toFixed(1)}deg)`
    el.style.filter = `blur(${Math.max(0, (-depth + .2) * 3.2).toFixed(2)}px)`
    el.style.zIndex = depth > 0 ? '4' : '1'
    el.style.opacity = String(.55 + (depth + 1) * .225)
  })
  return <img ref={ref} className={styles.sat} src={`${base}/${src}.webp`} alt="" aria-hidden="true" />
}

/** Two rendered slabs behind the hero (the logo's panel, with real thickness and a lit bevel): each turns,
    moves and recolours a beat after the other. */
function TileField({ index, x, y }: { index: number; x: MotionValue<number>; y: MotionValue<number> }) {
  return <motion.div className={styles.tiles} style={{ x, y }} aria-hidden="true">
    {SLABS[index].map(([left, top, width, rotate], i) => <motion.img key={i} className={styles.slab} src={`${LAYERS}/slab.webp`} alt="" draggable={false}
      initial={false} animate={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, rotate, filter: `hue-rotate(${HUE[index]}deg)`, rotateY: [0, 70, 0] }}
      transition={{ ...SPRING, delay: i * .08, filter: { duration: .5, delay: .1 + i * .08 }, rotateY: { duration: .6, delay: i * .08, ease: EASE } }} />)}
  </motion.div>
}

/** Text that rolls up like a counter when its value changes. */
export function Roll({ value, className }: { value: string; className?: string }) {
  return <span className={`${styles.roll} ${className ?? ''}`}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={value} initial={{ y: '105%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '-105%', opacity: 0 }} transition={{ ...SPRING, opacity: { duration: .25 } }}>{value}</motion.span>
    </AnimatePresence>
  </span>
}

// One number per state for the fixed glass tile. Counts and descriptions only: no amounts, no returns.
const TILE_COPY: Partial<Record<AppLocale, { value: number; unit: string; label: string }[]>> = {
  'zh-CN': [
    { value: 3, unit: '类', label: '写字楼 · 物流仓 · 产业园' },
    { value: 1, unit: '次', label: '配置，覆盖多种资产' },
    { value: 100, unit: '%', label: '规则驱动，过程透明' },
    { value: 24, unit: 'h', label: '有问题，随时问' },
  ],
  en: [
    { value: 3, unit: 'types', label: 'Offices · logistics · parks' },
    { value: 1, unit: 'setup', label: 'covering many assets' },
    { value: 100, unit: '%', label: 'rule-driven, in the open' },
    { value: 24, unit: 'h', label: 'ask any time' },
  ],
}

const ENTER_COPY: Partial<Record<AppLocale, { code: string; note: string }>> = {
  'zh-CN': { code: '邀请码（选填）', note: '有邀请码就填上，奖励以平台规则为准' },
  en: { code: 'Invitation code (optional)', note: 'Have a code? Add it. Rewards follow the platform rules' },
}

/**
 * One bar, one way in: an optional invitation-code field and the Sign in / sign up button side by side.
 * Existing accounts just press the button (no code needed). A code typed here is checked and locked before moving on,
 * and signup then shows it read-only. A code carried by a referral link arrives filled in and locked.
 */
function EnterBar({ invite, locale, label, onEnter }: { invite?: InviteCodeState; locale: AppLocale; label: string; onEnter: () => void }) {
  const c = ENTER_COPY[locale] ?? ENTER_COPY.en!
  const ic = inviteCopy[locale]
  const status = invite?.status
  const locked = status === 'locked' ? invite?.locked : null
  const shown = locked ? locked.attribution.code : invite?.value ?? ''
  const ok = status === 'valid' || status === 'locked'
  const error = invite?.message === 'unavailable' ? ic.unavailable : invite?.message === 'invalid' || status === 'invalid' ? ic.invalid : ''
  return <div className={styles.enter}>
    <div className={styles.enterBar} data-state={error ? 'error' : ok ? 'ok' : undefined}>
      {invite && status !== 'loading' && <label className={styles.enterCode}>
        <Gift size={16} strokeWidth={1.9} aria-hidden="true" />
        <input value={displayInviteCode(shown)} placeholder={c.code} aria-label={ic.placeholder} readOnly={status === 'locked'}
          onChange={event => invite.change(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={19} dir="ltr" enterKeyHint="go"
          onKeyDown={event => { if (event.key === 'Enter') onEnter() }} aria-invalid={error ? true : undefined} />
        {status === 'checking' ? <LoaderCircle className={styles.spin} size={15} aria-hidden="true" /> : ok ? <Check className={styles.ok} size={15} strokeWidth={2.6} aria-hidden="true" /> : null}
      </label>}
      <motion.button type="button" className={styles.enterBtn} onClick={onEnter} whileTap={{ scale: .96 }}>
        <span>{label}</span><i><ArrowRight size={16} strokeWidth={2.2} /></i>
      </motion.button>
    </div>
    <p className={styles.enterNote} data-tone={error ? 'error' : undefined} aria-live="polite">{error || c.note}</p>
  </div>
}

/** A small glass dial: the state's icon, ringed by the auto-advance progress. */
function Dial({ index, reduced }: { index: number; reduced: boolean | null }) {
  const Icon = ICONS[index]
  return <div className={styles.dial} aria-hidden="true">
    <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" className={styles.dialTrack} />
      <motion.circle key={index} cx="20" cy="20" r="17" className={styles.dialRun} pathLength={1} transform="rotate(-90 20 20)"
        initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : AUTO_MS / 1000, ease: 'linear' }} /></svg>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.i key={index} initial={{ scale: .4, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: .4, opacity: 0, rotate: 40 }} transition={SPRING}><Icon size={17} strokeWidth={2} /></motion.i>
    </AnimatePresence>
  </div>
}

/** A number that counts to its new value instead of jumping. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  useEffect(() => {
    const controls = animate(from.current, value, { duration: .9, ease: EASE, onUpdate: v => { if (ref.current) ref.current.textContent = String(Math.round(v)) } })
    from.current = value
    return () => controls.stop()
  }, [value])
  return <span ref={ref}>{value}</span>
}

/** The glass tile on the hero: one fixed size in every state; only its number counts and its line rolls. */
function FixedTile({ locale, index }: { locale: AppLocale; index: number }) {
  const c = (TILE_COPY[locale] ?? TILE_COPY.en!)[index]
  return <div className={styles.widget}>
    <div className={styles.tileNum}><b><CountUp value={c.value} /></b><Roll value={c.unit} className={styles.tileUnit} /></div>
    <Roll value={c.label} className={styles.tileLabel} />
  </div>
}

export default function HeroIntro({ locale, invite, onDone }: { locale: AppLocale; invite?: InviteCodeState; onDone: () => void }) {
  const offer = useAppOffer()
  const all = paletteAOnboarding(locale)
  const copy = all.s0
  // One way in: a code typed here is checked and locked now (signup then shows it read-only); empty is fine.
  const enter = async () => { if (!invite || await invite.commit({ required: false })) onDone() }
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const touched = useRef(0)
  const state = STATES[index]
  const text = copy.states[index]

  const go = useCallback((next: number, by: 'user' | 'auto' = 'user') => {
    const target = (next + STATES.length) % STATES.length
    setDir(next > index || (index === STATES.length - 1 && target === 0 && by === 'auto') ? 1 : -1)
    setIndex(target)
    if (by === 'user') { touched.current = Date.now(); try { navigator.vibrate?.(6) } catch { /* optional */ } }
  }, [index])

  // Auto-advance like the reference loops; pauses for a while after the user takes over.
  useEffect(() => {
    if (reduced) return
    const timer = setTimeout(() => { if (Date.now() - touched.current > 6000) go(index + 1, 'auto') }, AUTO_MS)
    return () => clearTimeout(timer)
  }, [index, go, reduced])

  // Lean: the finger (or Android's tilt) moves every layer at its own depth, through springs.
  const lx = useMotionValue(0), ly = useMotionValue(0)
  const sx = useSpring(lx, { stiffness: 80, damping: 18 }), sy = useSpring(ly, { stiffness: 80, damping: 18 })
  const heroX = useTransform(sx, v => v * -14), heroY = useTransform(sy, v => v * -10), heroR = useTransform(sx, v => v * -3)
  const fieldX = useTransform(sx, v => v * 7), fieldY = useTransform(sy, v => v * 5)
  const nearX = useTransform(sx, v => v * -30), nearY = useTransform(sy, v => v * -22)
  const cardRX = useTransform(sy, v => v * 2.2), cardRY = useTransform(sx, v => v * -2.6)
  useEffect(() => {
    const pointer = (event: PointerEvent) => { lx.set((event.clientX / innerWidth) * 2 - 1); ly.set((event.clientY / innerHeight) * 2 - 1) }
    const tilt = (event: DeviceOrientationEvent) => { if (event.gamma != null && event.beta != null) { lx.set(Math.max(-1, Math.min(1, event.gamma / 25))); ly.set(Math.max(-1, Math.min(1, (event.beta - 45) / 25))) } }
    window.addEventListener('pointermove', pointer, { passive: true })
    window.addEventListener('deviceorientation', tilt, { passive: true })
    return () => { window.removeEventListener('pointermove', pointer); window.removeEventListener('deviceorientation', tilt) }
  }, [lx, ly])

  // Swipe: the card follows the finger with resistance, then snaps to the next / previous state.
  const dragX = useMotionValue(0)
  const cardX = useSpring(dragX, { stiffness: 400, damping: 34 })
  const swipe = useRef<{ x: number; t: number; id: number } | null>(null)
  const onDown = (event: ReactPointerEvent) => {
    if ((event.target as HTMLElement).closest('button')) return
    swipe.current = { x: event.clientX, t: performance.now(), id: event.pointerId }
  }
  const onMove = (event: ReactPointerEvent) => {
    const s = swipe.current
    if (s && s.id === event.pointerId) dragX.set((event.clientX - s.x) * .35)
  }
  const onUp = (event: ReactPointerEvent) => {
    const s = swipe.current
    swipe.current = null
    dragX.set(0)
    if (!s) return
    const dx = (event.clientX - s.x) * (locale === 'ar' ? -1 : 1)
    const speed = dx / Math.max(1, performance.now() - s.t) // px per ms
    if (dx < -45 || speed < -.5) go(index + 1)
    else if (dx > 45 || speed > .5) go(index - 1)
  }

  return <section className={styles.intro} style={{ '--state': state.color } as React.CSSProperties}>
    {/* A real space behind the glass: the card's blur has something to soften, so it reads as glass. */}
    <img className={`${styles.space} ${styles.spaceDay}`} src="/media/palette-a/hero-light.webp" alt="" aria-hidden="true" />
    <img className={`${styles.space} ${styles.spaceNight}`} src="/media/palette-a/hero-dark.webp" alt="" aria-hidden="true" />
    <motion.div className={styles.glow} aria-hidden="true" animate={{ backgroundColor: state.color }} transition={{ duration: .8, ease: EASE }} />

    <motion.article className={styles.card} style={{ x: cardX, rotateX: cardRX, rotateY: cardRY }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SOFT, delay: .05 }}>
      <TileField index={index} x={fieldX} y={fieldY} />
      <div className={styles.meta}>
        <RwaLogoMark className={styles.metaLogo} width={34} height={19} label="A-REIT" accentColor={state.color} />
        <span className={styles.step}><Roll value={`0${index + 1}`} /> <i>/ 04</i></span>
      </div>
      {/* Hero + orbit: inside the card, standing on the colour field. */}
      <motion.div className={`${styles.stage} ${styles.layerStage}`} style={{ x: heroX, y: heroY, rotate: heroR }} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={state.hero} className={styles.heroWrap} custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 120, y: 30, scale: .7, rotate: d * 14, filter: 'blur(10px)' }),
              center: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' },
              exit: (d: number) => ({ opacity: 0, x: d * -110, y: -40, scale: 1.08, rotate: d * -10, filter: 'blur(12px)' }),
            }}
            initial="enter" animate="center" exit="exit" transition={{ ...SPRING, filter: { duration: .45 }, opacity: { duration: .35 } }}>
            <i className={styles.shadow} />
            <motion.img className={styles.hero} src={`${LAYERS}/${state.hero}.webp`} alt="" draggable={false}
              whileTap={{ scaleX: 1.08, scaleY: .9 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} />
            <Satellite base={LAYERS} src="sat-chrome" phase={index * 1.7} radius={128} speed={.42} />
            <Satellite base={LAYERS} src="sat-cube" phase={index * 1.7 + Math.PI} radius={112} speed={.34} />
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <motion.img className={styles.near} src={`${LAYERS}/sat-cube.webp`} alt="" aria-hidden="true" style={{ x: nearX, y: nearY }} />
      <FixedTile locale={locale} index={index} />
      <Dial index={index} reduced={reduced} />
      <span className={styles.grain} aria-hidden="true" />

      <div className={styles.panel}>
      <div className={styles.product}>
        <Roll value={text.name} className={styles.productName} />
        <Roll value={text.title} className={styles.productTitle} />
        <Roll value={text.line} className={styles.productLine} />
      </div>

      <div className={styles.chips} role="tablist" aria-label={copy.swipe}>
        {copy.chips.map((label, i) => { const Icon = ICONS[i]; const on = i === index; return <button key={label} type="button" role="tab" aria-selected={on} className={styles.chip} onClick={() => go(i)}>
          {on && <motion.i layoutId="chipPill" className={styles.chipPill} transition={SPRING} animate={{ backgroundColor: state.deep }} />}
          <Icon size={14} strokeWidth={2} aria-hidden="true" /><span>{label}</span>
        </button> })}
      </div>
      </div>
    </motion.article>


    {offer && <motion.div className={styles.offer} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .4 }}>
      <AppOffer kind={offer} locale={locale} invite={invite} />
    </motion.div>}

    <motion.div className={styles.enterWrap} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .5 }} style={{ '--cta': state.deep } as React.CSSProperties}>
      <EnterBar invite={invite} locale={locale} label={all.enter} onEnter={() => void enter()} />
    </motion.div>
  </section>
}
