'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { Wifi, Mic, Plus, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ChartColumn, ChartPie, Check, Eye, Gift, House, Languages, LoaderCircle, Moon, QrCode } from 'lucide-react'
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
  { hero: 'object-reit', from: '#3fd3b8', to: '#00806b', value: 3, scene: 'paper' },
  { hero: 'object-basket', from: '#22d0d6', to: '#00808a', value: 1 },
  { hero: 'object-koala', from: '#56c6f0', to: '#0077b0', value: 100 },
  { hero: 'object-ai', from: '#2ccce4', to: '#007c99', value: 24, scene: 'ai' },
] as const
/** Two callouts per card: anchor on the object [x %, y %] → label at [x %, y %] (of the hero box), and its side. */
const CALLOUTS: [number, number, number, number, 'l' | 'r'][][] = [
  [[66, 34, 92, 14, 'r'], [30, 74, 6, 92, 'l']],
  [[40, 44, 8, 16, 'l'], [70, 60, 94, 86, 'r']],
  [[64, 22, 92, 8, 'r'], [30, 78, 6, 94, 'l']],
  [[50, 40, 92, 16, 'r'], [42, 82, 6, 94, 'l']],
]
const AUTO_MS = 4800
const SKIP: Partial<Record<AppLocale, string>> = { 'zh-CN': '跳过', en: 'Skip' }

// The phone's front face in paper-scene-w.webp, in % of the 1024x1536 photograph: top-left, top-right, bottom-right, bottom-left.
const FACE = {"tl": [18.46, 3.26], "tr": [76.76, 6.9], "br": [76.76, 78.84], "bl": [18.46, 88.93]}
const FACE_W = 390, FACE_H = 820
/** The flat part of the face (left of the tear), in % of the photograph: the printed page is clipped to it. */
const FLAT = '18.5% 4.6%, 19.3% 3.4%, 21% 3%, 74% 5.4%, 73.4% 7.6%, 71.4% 11%, 67.6% 15.8%, 62% 21.6%, 56.6% 27%, 52.4% 32.8%, 50.6% 38.5%, 50.2% 45.6%, 50.2% 58.6%, 50.6% 71.6%, 51% 83%, 51.2% 86.2%, 21% 88.1%, 19.2% 87.3%, 18.5% 85.6%'

/** CSS matrix3d that maps a FACE_W x FACE_H box onto the quad (px), so flat UI lies on the tilted face in true perspective. */
function quadMatrix(q: number[][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0
  const h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3
  const W = FACE_W, H = FACE_H
  return `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${h / H},0,0,1,0,${x0},${y0},0,1)`
}

const HOME_COPY: Partial<Record<AppLocale, { slogan: [string, string]; sub: string; mine: string; actions: [string, string, string, string]; home: string; cash: string; held: string }>> = {
  'zh-CN': { slogan: ['好资产，', '一目了然。'], sub: '地产信托、资产组合、量化策略，一个账户看清', mine: '我的资产', actions: ['充值', '提现', '转账', '收款'], home: '首页', cash: '可用资金', held: '持仓' },
  en: { slogan: ['Good assets,', 'at a glance.'], sub: 'REITs, baskets and quant, one clear account', mine: 'My assets', actions: ['Deposit', 'Withdraw', 'Transfer', 'Receive'], home: 'Home', cash: 'Available', held: 'Holdings' },
}

const AI_COPY: Partial<Record<AppLocale, { title: string; hi: string; chips: string[]; ask: string; answer: string; rows: string[]; input: string }>> = {
  'zh-CN': { title: 'AI 助手', hi: '有什么想看明白的？', chips: ['费用怎么算', '风险在哪里', '怎么配置'], ask: '这只产品的费用是多少？',
    answer: '费用都写在产品披露里，我帮你列出来：', rows: ['申购费：买入时收取', '管理费：按年计提', '赎回规则：以披露为准'], input: '问问费用、风险或配置…' },
  en: { title: 'AI assistant', hi: 'What would you like to understand?', chips: ['How fees work', 'Where the risk is', 'How to allocate'], ask: 'What are this product’s fees?',
    answer: 'They are all in the product disclosure. Here they are:', rows: ['Subscription fee: when you buy', 'Management fee: yearly', 'Redemption: per the disclosure'], input: 'Ask about fees, risk or allocation…' },
}

/** The AI assistant page, printed the same way. */
function PrintedAi({ locale, active }: { locale: AppLocale; active: boolean }) {
  const c = AI_COPY[locale] ?? AI_COPY.en!
  const show = (k: number) => ({ initial: false as const, animate: { opacity: active ? 1 : 0 }, transition: { duration: .6, delay: active ? .2 + k * .14 : 0, ease: EASE } })
  return <div className={styles.print}>
    <div className={styles.pStatus}><b><Clock /></b><span><i className={styles.pSig}><i /><i /><i /><i /></i><Wifi size={15} strokeWidth={1.8} /><i className={styles.pBatt}><i /></i></span></div>
    <motion.div className={styles.pTop} {...show(0)}><RwaLogoMark width={44} height={25} label="" /><b>{c.title}</b></motion.div>
    <motion.h3 className={styles.aHi} {...show(1)}>{c.hi}</motion.h3>
    <motion.div className={styles.aChips} {...show(2)}>{c.chips.map(x => <span key={x}>{x}</span>)}</motion.div>
    <motion.div className={styles.aAsk} {...show(3)}>{c.ask}</motion.div>
    <motion.div className={styles.aAnswer} {...show(4)}>
      <p>{c.answer}</p>
      <ul>{c.rows.map(r => <li key={r}>{r}</li>)}</ul>
    </motion.div>
    <motion.div className={styles.aInput} {...show(5)}><Plus size={18} strokeWidth={1.5} /><span>{c.input}</span><Mic size={18} strokeWidth={1.5} /></motion.div>
  </div>
}

/** The phone's own clock: the visitor's current time, kept up to date. */
function Clock() {
  const fmt = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false })
  const [now, setNow] = useState('')
  useEffect(() => { setNow(fmt()); const t = setInterval(() => setNow(fmt()), 15000); return () => clearInterval(t) }, [])
  return <>{now || ' '}</>
}

/** A line drawing of the home page's pavilion (stands in for the photo, in the printed style). */
function Pavilion() {
  return <svg className={styles.pHero} viewBox="0 0 240 110" aria-hidden="true">
    <path d="M0 78 H240" /><path d="M8 72 C40 60 70 64 98 70" />
    <path d="M70 40 L236 26 L236 32 L72 46 Z" /><path d="M96 44 V78 M128 41 V78 M160 38 V78 M196 35 V78 M232 32 V78" />
    <path d="M90 78 H240" /><path d="M150 60 h30 v18 M110 66 h22" />
    <path d="M100 86 H230 M120 92 H220 M140 98 H210" opacity=".55" />
  </svg>
}

/** Our real home page, redrawn as if printed on the paper phone: grey ink, hairlines, outline icons; only the logo in colour. */
function PrintedHome({ locale, active }: { locale: AppLocale; active: boolean }) {
  const c = HOME_COPY[locale] ?? HOME_COPY.en!
  const acts = [ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, QrCode]
  const show = (k: number) => ({ initial: false as const, animate: { opacity: active ? 1 : 0 }, transition: { duration: .6, delay: active ? .2 + k * .1 : 0, ease: EASE } })
  return <div className={styles.print}>
    <div className={styles.pStatus}><b><Clock /></b><i className={styles.pIsland} /><span><i className={styles.pSig}><i /><i /><i /><i /></i><Wifi size={15} strokeWidth={1.8} /><i className={styles.pBatt}><i /></i></span></div>
    <motion.div className={styles.pTop} {...show(0)}>
      <RwaLogoMark width={44} height={25} label="" /><b>A-REIT</b>
      <span><Gift size={22} strokeWidth={1.4} /><Moon size={22} strokeWidth={1.4} /><i className={styles.pAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i></span>
    </motion.div>
    <motion.h3 className={styles.pSlogan} {...show(1)}><span>{c.slogan[0]}</span><em>{c.slogan[1]}</em></motion.h3>
    <motion.p className={styles.pSub} {...show(2)}>{c.sub}</motion.p>
    <motion.div {...show(3)}><Pavilion /></motion.div>
    <motion.div className={styles.pTicker} {...show(4)}><span>REIT</span><i /><span>DXY</span><i /><span>GOLD</span><i /></motion.div>
    <motion.div className={styles.pCard} {...show(5)}>
      <div className={styles.pCardHead}><span>{c.mine}</span><Eye size={20} strokeWidth={1.4} /></div>
      <div className={styles.pAmountRow}><b className={styles.pAmount}>* * * *</b><small>USDT</small></div>
      <div className={styles.pSubRow}><span>{c.cash} <b>* * *</b></span><span>{c.held} <b>*</b></span></div>
      <div className={styles.pActs}>{acts.map((Icon, k) => <span key={k}><Icon size={22} strokeWidth={1.4} /><small>{c.actions[k]}</small></span>)}</div>
    </motion.div>
    <motion.nav className={styles.pTabs} {...show(6)}><span data-on=""><House size={20} strokeWidth={1.4} /><small>{c.home}</small></span><ChartColumn size={20} strokeWidth={1.4} /><ChartPie size={20} strokeWidth={1.4} /><i /></motion.nav>
  </div>
}

type Quad = { tl: number[]; tr: number[]; br: number[]; bl: number[] }
/** Each paper-phone scene: the photograph, its measured face (corners, % of the 1024x1536 photo), the flat part the
    print is clipped to, an optional cut-out that sits above the print, and the page printed on it. */
const SCENES: Record<string, { photo: string; person?: string; face: Quad; flat: string; Print: typeof PrintedHome }> = {
  paper: { photo: 'paper-scene-w', person: 'paper-person-w', face: FACE, flat: FLAT, Print: PrintedHome },
  ai: { photo: 'ai-scene', face: {"tl": [18.55, 3.13], "tr": [69.73, 6.45], "br": [69.73, 81.71], "bl": [18.55, 88.74]}, flat: '18.6% 4.4%, 19.4% 3.2%, 21% 3.1%, 64.2% 5.8%, 64.2% 38.4%, 69.6% 38.4%, 69.6% 80.4%, 68% 81.6%, 21% 88.3%, 19.3% 87.6%, 18.6% 86%', Print: PrintedAi },
}

/**
 * Paper-phone scene: a giant cool-white paper phone in a pale studio, with the woman. The page is printed on the face,
 * mapped onto the face's four corners so it shares the phone's perspective, and clipped to the flat paper.
 */
function PaperScene({ scene, active, locale }: { scene: string; active: boolean; locale: AppLocale }) {
  const sc = SCENES[scene]
  const stage = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const m = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect()
  }, [])
  const q = [sc.face.tl, sc.face.tr, sc.face.br, sc.face.bl].map(([x, y]) => [x / 100 * box.w, y / 100 * box.h])
  const Print = sc.Print
  return <div className={styles.paperStage} ref={stage}>
    <img className={styles.paperPhoto} src={`${ART}/${sc.photo}.webp`} alt="" draggable={false} />
    {box.w > 0 && <div className={styles.faceClip} style={{ clipPath: `polygon(${sc.flat})` }}>
      <div className={styles.face} style={{ width: FACE_W, height: FACE_H, transform: quadMatrix(q) }}><Print locale={locale} active={active} /></div>
    </div>}
    {sc.person && <img className={styles.paperPerson} src={`${ART}/${sc.person}.webp`} alt="" draggable={false} />}
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
  if ('scene' in card) return <article className={`${styles.card} ${styles.sceneCard}`} aria-hidden={!active}><PaperScene scene={card.scene} active={active} locale={locale} /></article>
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
  return <motion.div className={styles.page} style={{ x, scale, opacity, zIndex: afterScene ? 2 : 1, transformOrigin: scene ? '68% 42%' : '50% 50%' }}>{children}</motion.div>
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
    const t = setTimeout(() => { if (index < CARDS.length - 1 && Date.now() - touched.current > 7000) go(index + 1, 'auto') }, 'scene' in CARDS[index] ? AUTO_MS + 3600 : AUTO_MS)
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

  return <section className={styles.guide} data-scene={'scene' in CARDS[index] || undefined}>
    <header className={styles.top}>
      <div className={styles.topRight}>
        <span className={styles.count}><b>0{index + 1}</b> / 04</span>
        <LangSwitch label={(COPY[locale] ?? COPY.en!).lang} />
        {index < CARDS.length - 1 && <button type="button" className={styles.skip} onClick={onDone}>{SKIP[locale] ?? SKIP.en}</button>}
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

    <AnimatePresence>{index === CARDS.length - 1 && <motion.div key="go" className={styles.finish} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={CUT}>
      {offer && <div className={styles.offer}><AppOffer kind={offer} locale={locale} invite={invite} /></div>}
      <motion.button type="button" className={styles.finishBtn} onClick={onDone} whileTap={{ scale: .97 }}>
        <span>{all.enter}</span><i><ArrowRight size={18} strokeWidth={1.6} /></i>
      </motion.button>
    </motion.div>}</AnimatePresence>
    </div>
  </section>
}
