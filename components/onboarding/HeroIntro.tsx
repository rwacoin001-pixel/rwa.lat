'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Bot, Building2, Layers3, Sigma } from 'lucide-react'
import { AppOffer, useAppOffer } from './AppOffer'
import type { InviteCodeState } from '../screens/InviteCodeField'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import styles from './HeroIntro.module.css'

/**
 * Guide page 1 (palette A), after Radium's state cards: one frosted card that cycles through the four products.
 * Built in layers that move on their own, so the scene has depth: a coloured glow behind the glass card, a field of
 * logo-shaped tiles that flip colour one by one, a transparent CGI hero (white ceramic + cool dichroic glass) with
 * its own contact shadow, objects orbiting in front of and behind it, and one out-of-focus object in the foreground.
 * One teal-to-blue colour family (equal OKLCH lightness). The small glass tile stays the same in every state.
 * Swipe or tap a chip to change state; it also advances by itself.
 */
export const ART = '/media/palette-a/onboard-v7'
/** Page 1 layers: transparent CGI heroes and orbit objects. */
const LAYERS = '/media/palette-a/onboard-v9'
const ICONS = [Building2, Layers3, Sigma, Bot]
// Pages 2–3 still use the studio cut-outs on one solid brand-green field.
export const FIELD = '#19c7aa'
const STATES = [
  { hero: 'hero-reit', color: '#2dc8ac' },
  { hero: 'hero-basket', color: '#00c6ce' },
  { hero: 'hero-quant', color: '#3abdee' },
  { hero: 'hero-ai', color: '#07c3de' },
]
/** Field tiles per state: [left %, top %, width %, rotate deg]; each tile is the logo's panel. */
const TILES: [number, number, number, number][][] = [
  [[8, 6, 54, 0], [52, 22, 40, 0], [30, 52, 30, 0]],
  [[40, 2, 52, -6], [6, 26, 44, 4], [58, 56, 30, 8]],
  [[14, 10, 46, 6], [50, 4, 42, -4], [24, 54, 50, 0]],
  [[26, 0, 50, -4], [4, 40, 36, 8], [56, 38, 38, -6]],
]
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

/** Logo-shaped tiles behind the hero: each flips and recolours a beat after the one before it. */
function TileField({ index, color, x, y }: { index: number; color: string; x: MotionValue<number>; y: MotionValue<number> }) {
  return <motion.div className={styles.tiles} style={{ x, y }} aria-hidden="true">
    {TILES[index].map(([left, top, width, rotate], i) => <motion.i key={i} className={styles.tileField}
      initial={false} animate={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, rotate, skewY: 18, backgroundColor: color, rotateY: [0, 90, 0] }}
      transition={{ ...SPRING, delay: i * .07, backgroundColor: { duration: .2, delay: .18 + i * .07 }, rotateY: { duration: .55, delay: i * .07, ease: EASE } }} />)}
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

const TILE_COPY: Partial<Record<AppLocale, { title: string; line: string }>> = {
  'zh-CN': { title: '看清每一份', line: '来源 · 费用 · 风险' },
  en: { title: 'See every detail', line: 'Source · Fees · Risk' },
}

/** The small glass tile on the hero: the same in every state (only the hero behind it changes). */
function FixedTile({ locale }: { locale: AppLocale }) {
  const c = TILE_COPY[locale] ?? TILE_COPY.en!
  return <div className={styles.widget}><div className={styles.tile}><i aria-hidden="true" /><span><b>{c.title}</b><small>{c.line}</small></span></div></div>
}

export default function HeroIntro({ locale, invite, pager, onNext }: { locale: AppLocale; invite?: InviteCodeState; pager?: React.ReactNode; onNext: () => void }) {
  const offer = useAppOffer()
  const copy = paletteAOnboarding(locale).s0
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
    <motion.div className={styles.glow} aria-hidden="true" animate={{ backgroundColor: state.color }} transition={{ duration: .8, ease: EASE }} />

    <motion.article className={styles.card} style={{ x: cardX, rotateX: cardRX, rotateY: cardRY }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SOFT, delay: .05 }}>
      <TileField index={index} color={state.color} x={fieldX} y={fieldY} />
      <div className={styles.meta}>
        {pager}
        <span className={styles.step}><Roll value={`0${index + 1}`} /> <i>/ 04</i></span>
      </div>
      <motion.h1 className={styles.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .1 }}>
        <span>{copy.title[0]}</span><em>{copy.title[1]}</em>
      </motion.h1>
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
      <FixedTile locale={locale} />
      <span className={styles.grain} aria-hidden="true" />

      <div className={styles.product}>
        <Roll value={text.name} className={styles.productName} />
        <Roll value={text.title} className={styles.productTitle} />
        <Roll value={text.line} className={styles.productLine} />
      </div>

      <div className={styles.chips} role="tablist" aria-label={copy.swipe}>
        {copy.chips.map((label, i) => { const Icon = ICONS[i]; const on = i === index; return <button key={label} type="button" role="tab" aria-selected={on} className={styles.chip} onClick={() => go(i)}>
          {on && <motion.i layoutId="chipPill" className={styles.chipPill} transition={SPRING} animate={{ backgroundColor: state.color }} />}
          <Icon size={14} strokeWidth={2} aria-hidden="true" /><span>{label}</span>
        </button> })}
      </div>
      <div className={styles.timer} aria-hidden="true"><motion.i key={index} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTO_MS / 1000, ease: 'linear' }} /></div>
    </motion.article>


    {offer && <motion.div className={styles.offer} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .4 }}>
      <AppOffer kind={offer} locale={locale} invite={invite} />
    </motion.div>}

    <motion.button type="button" className={styles.cta} onClick={onNext} whileTap={{ scale: .97 }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .5 }}>
      <span>{copy.cta}</span><span className={styles.ctaIcon}><ArrowRight size={18} strokeWidth={2} /></span>
    </motion.button>
  </section>
}
