'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, Bell, Bot, Check, Gift, House, Languages, LayoutGrid, LoaderCircle, UserRound } from 'lucide-react'
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
 * Full screen, one page per product; card 1 is a scene (a giant phone whose screen is our app, opening as a door).
 * Bottom: one bar for the invitation code and Sign in / sign up (signup still asks a new account for a code).
 */
const ART = '/media/palette-a/guide'
const CARDS = [
  { hero: 'object-reit', from: '#3fd3b8', to: '#00806b', value: 3, scene: 'door' },
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

// The phone's screen opening in door-scene.webp, in % of the 1024x1536 photograph, and the camera cutout on it.
const SCREEN = { left: 22.85, top: 8.27, width: 54.3, height: 69.86 }
const DOOR_COPY: Partial<Record<AppLocale, { hi: string; kind: string; place: string; tags: string; rows: [string, string][]; tabs: [string, string, string, string]; chips: string[] }>> = {
  'zh-CN': { hi: '看见资产背后', kind: '地产信托', place: '写字楼 · 城市核心区', tags: '按份额参与', rows: [['来源', '物业和收入从哪里来'], ['费用', '申购费、管理费写清楚'], ['风险', '可能亏损的情况提前说明']],
    tabs: ['首页', '市场', 'AI', '我的'], chips: ['地产信托', '资产组合', '考拉量化'] },
  en: { hi: 'See behind the asset', kind: 'REIT', place: 'Offices · city core', tags: 'By the share', rows: [['Source', 'Where property and income come from'], ['Fees', 'Subscription and management, spelled out'], ['Risk', 'How you could lose money, up front']],
    tabs: ['Home', 'Market', 'AI', 'Me'], chips: ['REITs', 'Baskets', 'Quant'] },
}

/** The door is our real app screen (sharp, translatable). It opens on its left hinge to show the space behind. */
function DoorApp({ locale }: { locale: AppLocale }) {
  const c = DOOR_COPY[locale] ?? DOOR_COPY.en!
  const tabs = [House, LayoutGrid, Bot, UserRound]
  return <div className={styles.app}>
    <div className={styles.status}><b>9:41</b><i className={styles.island} /><span className={styles.sig}><i /><i /><i /><i /></span></div>
    <header className={styles.appHead}>
      <RwaLogoMark width={30} height={17} label="" />
      <b>A-REIT</b>
      <Bell size={16} strokeWidth={1.6} className={styles.bell} />
    </header>
    <h3 className={styles.appHi}>{c.hi}</h3>
    <div className={styles.appChips}>{c.chips.map((x, k) => <span key={x} data-on={k === 0 || undefined}>{x}</span>)}</div>
    <article className={styles.appCard}>
      <img src={`${ART}/door-atrium.webp`} alt="" draggable={false} />
      <div><small>{c.kind}</small><b>{c.place}</b><span>{c.tags}</span></div>
    </article>
    <ul className={styles.appRows}>{c.rows.map(([k, v]) => <li key={k}><i><Check size={12} strokeWidth={2} /></i><span><b>{k}</b><small>{v}</small></span></li>)}</ul>
    <nav className={styles.appTabs}>{tabs.map((Icon, k) => <span key={k} data-on={k === 0 || undefined}><Icon size={17} strokeWidth={1.6} /><small>{c.tabs[k]}</small></span>)}</nav>
  </div>
}

/**
 * Scene page (card 1): a giant phone in a bright gallery; its screen is a door (our app) that swings open onto a real
 * office atrium. Layers: photograph → door (code, 3D) → light spill → the person (cut out, on top).
 */
function DoorScene({ active, locale }: { active: boolean; locale: AppLocale }) {
  const reduced = useReducedMotion()
  const open = active && !reduced
  return <div className={styles.doorStage}>
    <img className={styles.doorPhoto} src={`${ART}/door-scene.webp`} alt="" draggable={false} />
    <div className={styles.doorFrame} style={{ left: `${SCREEN.left}%`, top: `${SCREEN.top}%`, width: `${SCREEN.width}%`, height: `${SCREEN.height}%` }}>
      <motion.span className={styles.spill} initial={false} animate={{ opacity: open ? 1 : 0 }} transition={{ duration: 1.6, delay: open ? 1.1 : 0 }} />
      <motion.div className={styles.door} initial={false} animate={{ rotateY: open ? 74 : 0 }}
        transition={open ? { duration: 1.8, delay: 1, ease: [.45, 0, .2, 1] } : { duration: .5, ease: EASE }}>
        <DoorApp locale={locale} />
        <motion.i className={styles.doorShade} initial={false} animate={{ opacity: open ? .55 : 0 }} transition={{ duration: 1.8, delay: open ? 1 : 0 }} />
      </motion.div>
    </div>
    <img className={styles.doorPerson} src={`${ART}/door-person.webp`} alt="" draggable={false} />
  </div>
}

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

function Card({ i, active, rel, tiltX, tiltY, locale }: {
  i: number; active: boolean; rel: MotionValue<number>; tiltX: MotionValue<number>; tiltY: MotionValue<number>; locale: AppLocale
}) {
  const card = CARDS[i]
  const s0 = paletteAOnboarding(locale).s0
  const c = COPY[locale] ?? COPY.en!
  const text = s0.states[i]
  const heroX = useTransform([rel, tiltX] as const, ([r, t]: number[]) => r * -90 + t * -10)
  const heroY = useTransform(tiltY, t => t * -8)
  const topoX = useTransform([rel, tiltX] as const, ([r, t]: number[]) => r * 40 + t * 6)
  if ('scene' in card) return <article className={`${styles.card} ${styles.sceneCard}`} aria-hidden={!active}><DoorScene active={active} locale={locale} /></article>
  return <article className={styles.card} style={{ '--from': card.from, '--to': card.to } as never} aria-hidden={!active}>
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
  </article>
}

/**
 * One full-screen page per product. pos is a float page position (index while still, fractional while moving).
 * Normal pages slide. Leaving the scene page forward is a walk through its door: it zooms into the opening and fades,
 * while the next page grows in from just behind.
 */
function Page({ i, pos, view, children }: { i: number; pos: MotionValue<number>; view: number; children: React.ReactNode }) {
  const scene = i === 0 && 'scene' in CARDS[0]
  const afterScene = i === 1 && 'scene' in CARDS[0]
  const x = useTransform(pos, p => { const r = i - p; if (scene && r < 0) return 0; if (afterScene && r > 0 && r < 1) return 0; return r * view })
  const scale = useTransform(pos, p => { const r = i - p; if (scene && r < 0) return 1 + Math.min(1, -r) * 2.8; if (afterScene && r > 0 && r < 1) return 1 + r * .14; return 1 })
  const opacity = useTransform(pos, p => { const r = i - p; if (scene && r < 0) return Math.max(0, 1 - -r * 1.3); if (afterScene && r > 0 && r < 1) return 1 - r; return 1 })
  return <motion.div className={styles.page} style={{ x, scale, opacity, zIndex: afterScene ? 2 : 1, transformOrigin: scene ? '50% 43%' : '50% 50%' }}>{children}</motion.div>
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
  const [view, setView] = useState(390)
  const pos = useMotionValue(0)
  useLayoutEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setView(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // One move per change: a quick spring, then stillness (the door walk-through takes a little longer).
  useEffect(() => { const c = animate(pos, index, reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 24 }); return () => c.stop() }, [index, pos, reduced])

  const go = useCallback((next: number, by: 'user' | 'auto' = 'user') => {
    setIndex((next + CARDS.length) % CARDS.length)
    if (by === 'user') { touched.current = Date.now(); try { navigator.vibrate?.(6) } catch { /* optional */ } }
  }, [])
  useEffect(() => {
    if (reduced) return
    const t = setTimeout(() => { if (Date.now() - touched.current > 7000) go(index + 1, 'auto') }, 'scene' in CARDS[index] ? AUTO_MS + 3600 : AUTO_MS)
    return () => clearTimeout(t)
  }, [index, go, reduced])

  // Drag: pages follow the finger (resistance past the ends), then go by distance or speed.
  const drag = useRef<{ x: number; t: number; id: number } | null>(null)
  const down = (e: ReactPointerEvent) => { if ((e.target as HTMLElement).closest('button, input, a')) return; drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId } }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    let v = index - ((e.clientX - d.x) * (rtl ? -1 : 1)) / Math.max(1, view)
    if (v < 0) v *= .35; else if (v > CARDS.length - 1) v = CARDS.length - 1 + (v - (CARDS.length - 1)) * .35
    pos.set(v)
  }
  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dx = (e.clientX - d.x) * (rtl ? -1 : 1)
    const speed = dx / Math.max(1, performance.now() - d.t)
    let next = index
    if (dx < -view * .2 || speed < -.45) next = Math.min(CARDS.length - 1, index + 1)
    else if (dx > view * .2 || speed > .45) next = Math.max(0, index - 1)
    if (next === index) animate(pos, index, { type: 'spring', stiffness: 160, damping: 26 })
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

  const r0 = useTransform(pos, p => 0 - p), r1 = useTransform(pos, p => 1 - p), r2 = useTransform(pos, p => 2 - p), r3 = useTransform(pos, p => 3 - p)
  const rels = [r0, r1, r2, r3]
  const enter = async () => { if (!invite || await invite.commit({ required: false })) onDone() }

  return <section className={styles.guide} data-scene={'scene' in CARDS[index] || undefined}>
    <header className={styles.top}>
      <div className={styles.topRight}>
        <span className={styles.count}><b>0{index + 1}</b> / 04</span>
        <LangSwitch label={(COPY[locale] ?? COPY.en!).lang} />
      </div>
    </header>

    <div className={styles.viewport} ref={viewport} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="region" aria-roledescription="carousel" aria-label={all.s0.swipe}>
      {CARDS.map((_, i) => <Page key={i} i={i} pos={pos} view={view}>
        <Card i={i} active={i === index} rel={rels[i]} tiltX={tiltX} tiltY={tiltY} locale={locale} />
      </Page>)}
    </div>
    <div className={styles.bottom}>
    <nav className={styles.dots} role="tablist" aria-label={all.s0.swipe}>
      {all.s0.chips.map((label, i) => <button key={label} type="button" role="tab" aria-selected={i === index} aria-label={label} onClick={() => go(i)}>
        <i>{i === index && <motion.b key={index} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduced ? 0 : ('scene' in CARDS[index] ? AUTO_MS + 3600 : AUTO_MS) / 1000, ease: 'linear' }} />}</i>
      </button>)}
    </nav>

    {offer && <div className={styles.offer}><AppOffer kind={offer} locale={locale} invite={invite} /></div>}
    <motion.div className={styles.enterWrap} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...CUT, delay: .35 }}>
      <EnterBar invite={invite} locale={locale} label={all.enter} onEnter={() => void enter()} />
    </motion.div>
    </div>
  </section>
}
