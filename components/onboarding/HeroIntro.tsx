'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { ArrowRight, Bot, Building2, Layers3, Sigma, Trees, Warehouse } from 'lucide-react'
import { AppOffer, useAppOffer } from './AppOffer'
import type { InviteCodeState } from '../screens/InviteCodeField'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import styles from './HeroIntro.module.css'

/**
 * Guide page 1 (palette A), after Radium's state cards: one frosted card that cycles through the four products.
 * Each state swaps a photoreal cut-out hero (Antigravity render, rembg matte), recolours and reshapes the soft
 * colour field, rolls the headline, and sends three small objects orbiting the hero — in front of it on the near
 * side, behind it (and out of focus) on the far side. Swipe or tap a chip to change state; it also advances by itself.
 */
const ART = '/media/palette-a/onboard-v4'
const ICONS = [Building2, Layers3, Sigma, Bot]
const STATES = [
  { hero: 'hero-tower', sats: ['sat-cloud', 'sat-leaf', 'sat-bead'], field: ['#0c8f79', '#19c7aa', '#b8eadb'], shape: '58% 42% 46% 54% / 52% 48% 52% 48%' },
  { hero: 'hero-basket', sats: ['sat-goldbar', 'sat-leaf', 'sat-cloud'], field: ['#5f8f79', '#9cc4ad', '#e3efe5'], shape: '44% 56% 62% 38% / 48% 60% 40% 52%' },
  { hero: 'hero-koala', sats: ['sat-leaf', 'sat-cloud', 'sat-bead'], field: ['#5d7697', '#9fb4cf', '#e1e8f2'], shape: '62% 38% 40% 60% / 56% 44% 56% 44%' },
  { hero: 'hero-orb', sats: ['sat-bead', 'sat-leaf', 'sat-cloud'], field: ['#0f9e86', '#5fd9c3', '#d6f6ee'], shape: '50% 50% 58% 42% / 40% 58% 42% 60%' },
]
const AUTO_MS = 4200
const SPRING = { type: 'spring', stiffness: 260, damping: 26, mass: .9 } as const
const SOFT = { type: 'spring', stiffness: 140, damping: 20 } as const
const EASE = [.65, 0, .35, 1] as const

/** One satellite on an elliptical orbit around the hero; near side in front and sharp, far side behind and blurred. */
function Satellite({ src, phase, radius, speed }: { src: string; phase: number; radius: number; speed: number }) {
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
  return <img ref={ref} className={styles.sat} src={`${ART}/${src}.webp`} alt="" aria-hidden="true" />
}

/** Text that rolls up like a counter when its value changes. */
function Roll({ value, className }: { value: string; className?: string }) {
  return <span className={`${styles.roll} ${className ?? ''}`}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={value} initial={{ y: '105%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '-105%', opacity: 0 }} transition={{ ...SPRING, opacity: { duration: .25 } }}>{value}</motion.span>
    </AnimatePresence>
  </span>
}

const WIDGET_COPY: Partial<Record<AppLocale, { kinds: [string, string, string]; mix: string; rules: string; ask: string }>> = {
  'zh-CN': { kinds: ['写字楼', '物流仓', '产业园'], mix: '多资产 · 一次配置', rules: '规则驱动 · 过程透明', ask: '这只产品的费用是多少？' },
  en: { kinds: ['Offices', 'Logistics', 'Parks'], mix: 'Many assets · one setup', rules: 'Rule-driven · in the open', ask: 'What are this product’s fees?' },
}

/** A small glass tile on the colour field: one illustrative UI fragment per state (no amounts, no returns). */
function StateWidget({ index, locale }: { index: number; locale: AppLocale }) {
  const c = WIDGET_COPY[locale] ?? WIDGET_COPY.en!
  const body = [
    <div key="k" className={styles.wKinds}>{[Building2, Warehouse, Trees].map((Icon, i) => <span key={i}><i><Icon size={15} strokeWidth={1.9} /></i>{c.kinds[i]}</span>)}</div>,
    <div key="m" className={styles.wMix}>
      <svg viewBox="0 0 36 36" aria-hidden="true">{[[0, 34, '#0b1220'], [34, 26, '#19c7aa'], [60, 22, '#9cc4ad'], [82, 18, '#d8c39a']].map(([start, len, color], i) =>
        <motion.circle key={i} cx="18" cy="18" r="14" fill="none" stroke={color as string} strokeWidth="5" pathLength="100" transform="rotate(-90 18 18)"
          strokeDashoffset={-Number(start)} initial={{ strokeDasharray: '0 100' }} animate={{ strokeDasharray: `${Number(len) - 2} ${102 - Number(len)}` }} transition={{ duration: .9, delay: .15 + i * .08, ease: EASE }} />)}</svg>
      <b>{c.mix}</b>
    </div>,
    <div key="r" className={styles.wRules}>
      <svg viewBox="0 0 120 34" aria-hidden="true"><motion.path d="M2 26 C 14 24, 18 12, 30 16 S 48 28, 58 18 S 78 4, 90 10 S 108 20, 118 6" fill="none" stroke="#5d7697" strokeWidth="2.4" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE }} /></svg>
      <b>{c.rules}</b>
    </div>,
    <div key="a" className={styles.wAsk}><b>{c.ask}</b><span aria-hidden="true"><i /><i /><i /></span></div>,
  ][index]
  return <AnimatePresence mode="popLayout" initial={false}>
    <motion.div key={index} className={styles.widget} initial={{ opacity: 0, y: 14, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: .96 }} transition={{ ...SPRING, delay: .12 }}>{body}</motion.div>
  </AnimatePresence>
}

export default function HeroIntro({ locale, invite, onNext }: { locale: AppLocale; invite?: InviteCodeState; onNext: () => void }) {
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
  const fieldX = useTransform(sx, v => v * 6), fieldY = useTransform(sy, v => v * 4)
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

  const fieldBg = `linear-gradient(155deg, ${state.field[0]} 0%, ${state.field[1]} 55%, ${state.field[2]} 100%)`

  return <section className={styles.intro} style={{ '--glow': state.field[1] } as CSSProperties}>
    <motion.h1 className={styles.title} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .1 }}>
      <span>{copy.title[0]}</span><em>{copy.title[1]}</em>
    </motion.h1>
    <motion.div className={styles.halo} aria-hidden="true" animate={{ backgroundColor: state.field[1] }} transition={{ duration: 1.1, ease: EASE }} />

    <motion.article className={styles.card} style={{ x: cardX, rotateX: cardRX, rotateY: cardRY }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SOFT, delay: .05 }}>
      <motion.div className={styles.field} aria-hidden="true" style={{ x: fieldX, y: fieldY }}
        animate={{ background: fieldBg, borderRadius: state.shape }} transition={{ duration: 1, ease: EASE }}>
        <span /><span />
      </motion.div>

      <div className={styles.meta}>
        <b><i className={styles.live} />A-REIT</b>
        <span className={styles.step}><Roll value={`0${index + 1}`} /> <i>/ 04</i></span>
      </div>
      <StateWidget index={index} locale={locale} />
      <span className={styles.grain} aria-hidden="true" />

      <div className={styles.product}>
        <Roll value={text.name} className={styles.productName} />
        <Roll value={text.title} className={styles.productTitle} />
        <Roll value={text.line} className={styles.productLine} />
      </div>

      <div className={styles.chips} role="tablist" aria-label={copy.swipe}>
        {copy.chips.map((label, i) => { const Icon = ICONS[i]; const on = i === index; return <button key={label} type="button" role="tab" aria-selected={on} className={styles.chip} onClick={() => go(i)}>
          {on && <motion.i layoutId="chipPill" className={styles.chipPill} transition={SPRING} />}
          <Icon size={14} strokeWidth={2} aria-hidden="true" /><span>{label}</span>
        </button> })}
      </div>
      <div className={styles.timer} aria-hidden="true"><motion.i key={index} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTO_MS / 1000, ease: 'linear' }} /></div>
    </motion.article>

    {/* Hero + orbit: above the card, breaking out of its top edge. */}
    <motion.div className={styles.stage} style={{ x: heroX, y: heroY, rotate: heroR }} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div key={state.hero} className={styles.heroWrap} custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 120, y: 30, scale: .7, rotate: d * 14, filter: 'blur(10px)' }),
            center: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' },
            exit: (d: number) => ({ opacity: 0, x: d * -110, y: -40, scale: 1.08, rotate: d * -10, filter: 'blur(12px)' }),
          }}
          initial="enter" animate="center" exit="exit" transition={{ ...SPRING, filter: { duration: .45 }, opacity: { duration: .35 } }}>
          <i className={styles.shadow} />
          <motion.img className={styles.hero} src={`${ART}/${state.hero}.webp`} alt="" draggable={false}
            whileTap={{ scaleX: 1.08, scaleY: .9 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} />
          {state.sats.map((src, i) => <Satellite key={src} src={src} phase={i * (Math.PI * 2 / 3) + index} radius={118 + i * 14} speed={.42 + i * .07} />)}
        </motion.div>
      </AnimatePresence>
    </motion.div>

    {offer && <motion.div className={styles.offer} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .4 }}>
      <AppOffer kind={offer} locale={locale} invite={invite} />
    </motion.div>}

    <motion.button type="button" className={styles.cta} onClick={onNext} whileTap={{ scale: .97 }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .5 }}>
      <span>{copy.cta}</span><span className={styles.ctaIcon}><ArrowRight size={18} strokeWidth={2} /></span>
    </motion.button>
  </section>
}
