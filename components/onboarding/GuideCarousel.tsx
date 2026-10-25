'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { Wifi, Mic, Plus, Pencil, ArrowLeft, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ChartColumn, ChartPie, Check, Eye, Gift, House, Languages, LoaderCircle, Moon, QrCode } from 'lucide-react'
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
  { from: '#3fd3b8', to: '#00806b', value: 100, scene: 'paper', sky: '#b9bec3', ground: '#aeb1b4' },
  { from: '#22d0d6', to: '#00808a', value: 1, scene: 'port', sky: '#adadb0', ground: '#c9c8c8' },
  { from: '#56c6f0', to: '#0077b0', value: 100, scene: 'quant', sky: '#a2a7ad', ground: '#afb1b6' },
  { from: '#2ccce4', to: '#007c99', value: 24, scene: 'ai', sky: '#b5bbc2', ground: '#b1b5ba' },
] as const
const AUTO_MS = 4800
const SKIP: Partial<Record<AppLocale, string>> = { 'zh-CN': '跳过', en: 'Skip' }

// The phone's front face in paper-scene-w.webp, in % of the 1024x1536 photograph: top-left, top-right, bottom-right, bottom-left.
const FACE = {"tl": [18.46, 3.26], "tr": [76.76, 6.9], "br": [76.76, 78.84], "bl": [18.46, 88.93]}
const FACE_W = 390, FACE_H = 820
/** The flat part of the face (left of the tear), in % of the photograph: the printed page is clipped to it. */
const FLAT = '18.5% 4.6%, 19.3% 3.4%, 21% 3%, 74% 5.4%, 73.4% 7.6%, 71.4% 11%, 67.6% 15.8%, 62% 21.6%, 56.6% 27%, 52.4% 32.8%, 50.6% 38.5%, 50.2% 45.6%, 50.2% 58.6%, 50.6% 71.6%, 51% 83%, 51.2% 86.2%, 21% 88.1%, 19.2% 87.3%, 18.5% 85.6%'

/** CSS matrix3d that maps a FACE_W x FACE_H box onto the quad (px), so flat UI lies on the tilted face in true perspective. */
function quadMatrix(q: number[][], W = FACE_W, H = FACE_H) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0
  const h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3
  return `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${h / H},0,0,1,0,${x0},${y0},0,1)`
}

const HOME_COPY: Partial<Record<AppLocale, { slogan: [string, string]; sub: string; mine: string; actions: [string, string, string, string]; home: string; cash: string; held: string }>> = {
  'zh-CN': { slogan: ['好资产，', '一目了然。'], sub: '地产信托、资产组合、量化策略，一个账户看清', mine: '我的资产', actions: ['充值', '提现', '转账', '收款'], home: '首页', cash: '可用资金', held: '持仓' },
  en: { slogan: ['Good assets,', 'at a glance.'], sub: 'REITs, baskets and quant, one clear account', mine: 'My assets', actions: ['Deposit', 'Withdraw', 'Transfer', 'Receive'], home: 'Home', cash: 'Available', held: 'Holdings' },
}

// The AI assistant page as it is in the app (the user's screenshot), played as a short scripted exchange: a greeting,
// the AI's reply typed out, a question, then the guided question card answered three times, and a summary.
// Sample words only; no account data and no advice.
type AiCopy = { tabs: [string, string]; hi: string; name: string; reply: string; ask: string; qs: [string, [string, string, string], string][]; pick: number[];
  own: string; skip: string; next: string; summary: string; input: string; note: string; done: string }
const AI_COPY: Partial<Record<AppLocale, AiCopy>> = {
  'zh-CN': { tabs: ['AI 助手', '社区'], hi: '你好', name: 'A-REIT AI', reply: '你好！我是 A-REIT AI 助手。我可以介绍平台、解释和对比产品，也能帮你理清配置思路。',
    ask: '我有一笔钱，怎么配置？',
    qs: [['这笔资金大概打算投资多久？', ['1 年以内', '1–3 年', '3 年以上'], '投资多久？'], ['你更看重哪一点？', ['稳定收入', '长期增长', '两者兼顾'], '看重什么？'], ['能接受多大的波动？', ['较小', '中等', '较大'], '多大波动？']],
    pick: [1, 0, 0], own: '或者写下你自己的回答', skip: '跳过', next: '下一步',
    summary: '已记录：1–3 年、稳定收入、波动较小。我按这些列出可以先了解的产品，结果仅供参考。', input: '问问费用、风险或配置…', note: 'AI 可能出错，回答仅供参考，不构成投资建议。', done: '整理好了' },
  en: { tabs: ['AI Support', 'Community'], hi: 'Hello', name: 'A-REIT AI', reply: 'Hi! I am the A-REIT AI assistant. I can introduce the platform, explain and compare products, and help you think through an allocation.',
    ask: 'How should I allocate some money?',
    qs: [['Roughly how long will you invest it?', ['Under 1 year', '1–3 years', 'Over 3 years'], 'How long?'], ['What matters more to you?', ['Steady income', 'Long-term growth', 'Both'], 'What matters?'], ['How much ups and downs can you take?', ['Little', 'Some', 'A lot'], 'How much swing?']],
    pick: [1, 0, 0], own: 'Or write your own reply', skip: 'Skip', next: 'Next',
    summary: 'Noted: 1–3 years, steady income, little swing. I will list products you could look at first; for reference only.', input: 'Ask about fees, risk or allocation…', note: 'AI can make mistakes. Answers are for reference only and are not investment advice.', done: 'All set' },
}
/** Script times (ms after the page shows): hi, typing, reply, ask, Q1, pick 1, Q2, pick 2, Q3, pick 3, summary. */
/** Short words printed on the three paper bubbles (at most two English words, three or four Chinese characters). */
const BUBBLE_WORDS: Partial<Record<AppLocale, string[]>> = { 'zh-CN': ['费用？', '风险？', '怎么配？'], en: ['Fees?', 'Risk?', 'Allocate?'] }
/** Font size (in cqw of the scene) that keeps a word inside a bubble: within 62% of its long axis and 40% of its short. */
const fitWord = (word: string, long: number, short: number) => {
  const em = [...word].reduce((w, ch) => w + (/[　-鿿＀-￯]/.test(ch) ? 1 : /[A-Z]/.test(ch) ? .66 : .54), 0)
  return Math.min(short * .4, (long * .62) / Math.max(1, em))
}
const AI_TIMES = [0, 400, 1000, 1500, 3600, 4300, 5500, 6400, 7500, 8400, 9500, 10500]

/** Steps through the script while the page is current; starts over each time it becomes current. */
function useScript(on: boolean, times: number[]) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
    if (!on) return
    const timers = times.map((t, k) => setTimeout(() => setStep(k), t))
    return () => timers.forEach(clearTimeout)
  }, [on, times])
  return step
}

/** Types a string out character by character once started. */
function Typed({ text, go }: { text: string; go: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!go) return
    const t = setInterval(() => setN(v => { if (v >= text.length) { clearInterval(t); return v } return v + 1 }), 32)
    return () => clearInterval(t)
  }, [go, text])
  return <>{text.slice(0, n)}{go && n < text.length && <i className={styles.caret} />}</>
}

const Msg = ({ show, children, className }: { show: boolean; children: React.ReactNode; className: string }) =>
  <AnimatePresence initial={false}>{show && <motion.div className={className} initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>{children}</motion.div>}</AnimatePresence>

/** The AI assistant page, printed the same way, playing the script. */
function PrintedAi({ locale, step = 99 }: { locale: AppLocale; active: boolean; step?: number }) {
  const c = AI_COPY[locale] ?? AI_COPY.en!
  const q = step >= 9 ? 2 : step >= 7 ? 1 : 0
  const picked = step === 6 || step === 8 || step === 10 ? c.pick[q] : -1
  const [question, opts] = c.qs[q]
  return <div className={`${styles.print} ${styles.aiPrint}`}>
    <div className={styles.pStatus}><b><Clock /></b><span><i className={styles.pSig}><i /><i /><i /><i /></i><Wifi size={15} strokeWidth={1.8} /><i className={styles.pBatt}><i /></i></span></div>
    <div className={styles.aBar}>
      <ArrowLeft size={20} strokeWidth={1.5} />
      <span className={styles.aTabs}><b>{c.tabs[0]}</b><span>{c.tabs[1]}</span></span>
      <i className={styles.pAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i>
    </div>
    <div className={styles.aThread}>
      <Msg show={step >= 1} className={styles.aMe}>{c.hi}</Msg>
      <Msg show={step >= 2} className={styles.aBot}>
        <span className={styles.aName}><RwaLogoMark width={22} height={12} label="" /><b>{c.name}</b></span>
        <p>{step < 3 ? <span className={styles.dots3}><i /><i /><i /></span> : <Typed text={c.reply} go={step >= 3} />}</p>
      </Msg>
      <Msg show={step >= 4} className={styles.aMe}>{c.ask}</Msg>
      <Msg show={step >= 5 && step < 11} className={styles.aQ}>
        <div className={styles.aQHead}><span>{question}</span><small>{q + 1}/3</small></div>
        {opts.map((o, k) => <div key={o} className={styles.aOpt} data-on={picked === k || undefined}><i>{k + 1}</i><span>{o}</span></div>)}
        <div className={styles.aOwn}><Pencil size={14} strokeWidth={1.4} /><span>{c.own}</span></div>
        <div className={styles.aQFoot}><span>{c.skip}</span><b data-press={picked >= 0 || undefined}>{c.next}</b></div>
      </Msg>
      <Msg show={step >= 11} className={styles.aBot}>
        <span className={styles.aName}><RwaLogoMark width={22} height={12} label="" /><b>{c.name}</b></span>
        <p><Typed text={c.summary} go={step >= 11} /></p>
      </Msg>
    </div>
    <div className={styles.aInput}><Plus size={18} strokeWidth={1.5} /><span>{c.input}</span><Mic size={18} strokeWidth={1.5} /></div>
    <p className={styles.aNote}>{c.note}</p>
  </div>
}

// Page 2: the paper cards that fan out of the screen carry asset cards, printed and mapped onto each card's own corners
// (in % of the photo); the cards behind are clipped to the part you can actually see.
const PORT_CARDS: { k: 'a' | 'b' | 'c' | 'd'; quad: number[][]; w: number; h: number; clip: string }[] = [{ k: 'a', quad: [[50.098, 15.82], [66.992, 17.383], [66.992, 29.948], [50.098, 28.32]], w: 300, h: 300, clip: '50.098% 15.82%, 66.992% 17.383%, 66.992% 21.419%, 50.098% 19.141%' }, { k: 'b', quad: [[50.098, 19.141], [77.246, 22.786], [77.246, 35.156], [50.098, 31.576]], w: 300, h: 200, clip: '50.098% 19.141%, 77.246% 22.786%, 77.246% 28.19%, 53.32% 22.786%, 50.098% 35.026%' }, { k: 'c', quad: [[53.32, 22.786], [80.957, 29.036], [77.637, 41.406], [50.098, 35.026]], w: 260, h: 172, clip: '53.32% 22.786%, 80.957% 29.036%, 80.273% 33.203%, 66.211% 28.581%, 60.352% 37.24%, 50.098% 35.026%' }, { k: 'd', quad: [[66.211, 28.581], [83.008, 33.984], [77.344, 44.922], [58.984, 39.193]], w: 230, h: 215, clip: '66.211% 28.581%, 83.008% 33.984%, 77.344% 44.922%, 58.984% 39.193%' }]
const CARD_COPY: Partial<Record<AppLocale, Record<'a' | 'b' | 'c' | 'd', [string, string]> & { share: string; more: string }>> = {
  'zh-CN': { a: ['现金', 'USDT · 随时可用'], b: ['产业园', '研发与制造'], c: ['物流仓', '港口与园区'], d: ['写字楼', '城市核心区'], share: '份额', more: '查看详情' },
  en: { a: ['Cash', 'USDT · available'], b: ['Business parks', 'R&D and making'], c: ['Logistics', 'Ports and parks'], d: ['Offices', 'City core'], share: 'Shares', more: 'Details' },
}

/** One printed asset card. The held card (d) is the full card; the ones behind show their heading. */
function PaperCard({ k, locale }: { k: 'a' | 'b' | 'c' | 'd'; locale: AppLocale }) {
  const c = CARD_COPY[locale] ?? CARD_COPY.en!
  const [kind, sub] = c[k]
  const n = { a: '04', b: '03', c: '02', d: '01' }[k]
  return <div className={styles.pc} data-k={k}>
    <div className={styles.pcHead}><small>{n}</small><b>{kind}</b><span>{sub}</span></div>
    {k === 'd' && <>
      <svg className={styles.pcArt} viewBox="0 0 240 90" aria-hidden="true">
        <path d="M0 80 H240" /><path d="M30 80 V22 H110 V80 M44 30 H96 M44 42 H96 M44 54 H96 M44 66 H96" />
        <path d="M120 80 V40 H200 V80 M134 50 H186 M134 62 H186" /><path d="M210 80 V58 H236 V80" opacity=".6" />
      </svg>
      <div className={styles.pcRow}><span>{c.share}</span><b>* * *</b></div>
      <div className={styles.pcMore}><span>{c.more}</span><ArrowRight size={14} strokeWidth={1.5} /></div>
    </>}
    {k === 'c' && <svg className={styles.pcArtSm} viewBox="0 0 240 60" aria-hidden="true"><path d="M0 56 H240 M20 56 V26 L70 12 L120 26 V56 M34 56 V36 H56 V56 M78 56 V36 H100 V56 M140 56 V34 H226 V56" /></svg>}
  </div>
}

/** The printed cards over the photo of page 2. */
function PaperCards({ box, locale }: { box: { w: number; h: number }; locale: AppLocale }) {
  return <>{PORT_CARDS.map(card => <div key={card.k} className={styles.faceClip} style={{ clipPath: `polygon(${card.clip})`, zIndex: 3 }}>
    <div className={styles.face} style={{ width: card.w, height: card.h, transform: quadMatrix(card.quad.map(([x, y]) => [x / 100 * box.w, y / 100 * box.h]), card.w, card.h) }}>
      <PaperCard k={card.k} locale={locale} />
    </div>
  </div>)}</>
}

const PORT_COPY: Partial<Record<AppLocale, { title: string; total: string; parts: string[]; s1: string; s1sub: string; s2: string; rows: [string, string][]; tabs: string[] }>> = {
  'zh-CN': { title: '资产组合', total: '组合总值 · USDT', parts: ['写字楼', '物流仓', '产业园', '现金'], s1: '资产配置', s1sub: '按市值', s2: '持仓',
    rows: [['写字楼', '城市核心区 · 份额'], ['物流仓', '港口与园区 · 份额'], ['产业园', '研发与制造 · 份额']], tabs: ['总览', '持仓', '收益', '订单'] },
  en: { title: 'Portfolio', total: 'Total value · USDT', parts: ['Offices', 'Logistics', 'Parks', 'Cash'], s1: 'Allocation', s1sub: 'By market value', s2: 'Holdings',
    rows: [['Offices', 'City core · shares'], ['Logistics', 'Ports and parks · shares'], ['Parks', 'R&D and making · shares']], tabs: ['Overview', 'Holdings', 'Returns', 'Orders'] },
}

/** The portfolio page, printed: masked total, an allocation bar (no figures), the holdings list. */
function PrintedPortfolio({ locale, active }: { locale: AppLocale; active: boolean }) {
  const c = PORT_COPY[locale] ?? PORT_COPY.en!
  const show = (k: number) => ({ initial: false as const, animate: { opacity: active ? 1 : 0 }, transition: { duration: .6, delay: active ? .2 + k * .12 : 0, ease: EASE } })
  return <div className={styles.print}>
    <div className={styles.pStatus}><b><Clock /></b><span><i className={styles.pSig}><i /><i /><i /><i /></i><Wifi size={15} strokeWidth={1.8} /><i className={styles.pBatt}><i /></i></span></div>
    <motion.div className={styles.pTop} {...show(0)}><RwaLogoMark width={44} height={25} label="" /><b>{c.title}</b><span><i className={styles.pAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i></span></motion.div>
    <motion.div className={styles.pCard} {...show(1)}>
      <div className={styles.pCardHead}><span>{c.total}</span><Eye size={18} strokeWidth={1.4} /></div>
      <div className={styles.pAmountRow}><b className={styles.pAmount}>* * * *</b><small>USDT</small></div>
    </motion.div>
    <motion.div className={styles.qTabs} {...show(2)}>{c.tabs.map((t, k) => <span key={t} data-on={k === 0 || undefined}>{t}</span>)}</motion.div>
    <motion.div className={styles.qSec} {...show(3)}><small>01</small><b>{c.s1}</b><span>{c.s1sub}</span></motion.div>
    <motion.div className={styles.mixBar} {...show(4)}>{c.parts.map((x, k) => <i key={x} data-k={k} />)}</motion.div>
    <motion.div className={styles.mixLegend} {...show(5)}>{c.parts.map((x, k) => <span key={x}><i data-k={k} />{x}</span>)}</motion.div>
    <motion.div className={styles.qSec} {...show(6)}><small>02</small><b>{c.s2}</b></motion.div>
    <motion.ul className={styles.qRows} {...show(7)}>{c.rows.map(([a, b]) => <li key={a}><i /><span><b>{a}</b><small>{b}</small></span><em>* * *</em></li>)}</motion.ul>
  </div>
}

const QUANT_COPY: Partial<Record<AppLocale, { title: string; name: string; tag: string; rules: [string, string][]; s2: string; kpi: [string, string, string] }>> = {
  'zh-CN': { title: '考拉量化', name: '稳健规则 · 示例策略', tag: '规则驱动', s2: '策略规则', kpi: ['累计', '回撤', '胜率'],
    rules: [['规则先定好', '买卖条件提前写清楚'], ['按信号执行', '不靠感觉，不追涨杀跌'], ['全程可回看', '每一笔都有记录']] },
  en: { title: 'Koala Quant', name: 'Steady rules · sample strategy', tag: 'Rule-driven', s2: 'Rules', kpi: ['Total', 'Drawdown', 'Win rate'],
    rules: [['Rules come first', 'Buy and sell conditions set in advance'], ['Follow the signal', 'No hunches, no chasing'], ['Review everything', 'Every trade is recorded']] },
}

/** The Koala Quant page, printed: strategy card with a drawing line chart, masked figures, the three rules. */
function PrintedQuant({ locale, active }: { locale: AppLocale; active: boolean }) {
  const c = QUANT_COPY[locale] ?? QUANT_COPY.en!
  const show = (k: number) => ({ initial: false as const, animate: { opacity: active ? 1 : 0 }, transition: { duration: .6, delay: active ? .2 + k * .12 : 0, ease: EASE } })
  return <div className={styles.print}>
    <div className={styles.pStatus}><b><Clock /></b><span><i className={styles.pSig}><i /><i /><i /><i /></i><Wifi size={15} strokeWidth={1.8} /><i className={styles.pBatt}><i /></i></span></div>
    <motion.div className={styles.pTop} {...show(0)}><RwaLogoMark width={44} height={25} label="" /><b>{c.title}</b><span><i className={styles.pAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i></span></motion.div>
    <motion.div className={styles.pCard} {...show(1)}>
      <div className={styles.pCardHead}><span>{c.name}</span><small className={styles.qTag}>{c.tag}</small></div>
      <svg className={styles.qChart} viewBox="0 0 300 110" aria-hidden="true">
        <path d="M0 96 H300 M0 64 H300 M0 32 H300" opacity=".25" />
        <motion.path d="M4 92 C30 86 44 90 62 78 S96 70 112 72 S142 52 160 56 S196 40 214 44 S250 22 268 26 S290 16 298 12" strokeWidth="2.2"
          initial={false} animate={{ pathLength: active ? 1 : 0 }} transition={{ duration: 1.6, delay: active ? .5 : 0, ease: EASE }} />
      </svg>
      <div className={styles.qKpi}>{c.kpi.map(k => <span key={k}><small>{k}</small><b>* *</b></span>)}</div>
    </motion.div>
    <motion.div className={styles.qSec} {...show(2)}><small>01</small><b>{c.s2}</b></motion.div>
    <motion.ul className={styles.qRows} {...show(3)}>{c.rules.map(([a, b], k) => <li key={a}><i>{k + 1}</i><span><b>{a}</b><small>{b}</small></span></li>)}</motion.ul>
  </div>
}

/** The phone's own clock: the visitor's current time, kept up to date. */
function Clock() {
  const fmt = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false })
  const [now, setNow] = useState('')
  useEffect(() => { setNow(fmt()); const t = setInterval(() => setNow(fmt()), 15000); return () => clearInterval(t) }, [])
  return <>{now || ' '}</>
}

// The home page ticker, printed and looping (index levels as on the real home page, not account data).
const TICKS: [string, string, string][] = [['REIT', '1,284.6', '+0.71%'], ['DXY', '101.75', '+0.14%'], ['GOLD', '4,007.9', '-1.29%'], ['US10Y', '4.21%', '-0.03%'], ['SPCX', '3.3B', '+0.44%']]

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
    <motion.div className={styles.pTicker} {...show(4)}><div className={styles.pTickTrack}>{[0, 1].map(k => <span key={k} className={styles.pTickRun} aria-hidden={k === 1 || undefined}>
      {TICKS.map(([name, val, chg]) => <span key={name} className={styles.pTick}><b>{name}</b><span>{val}</span><em data-up={chg.startsWith('+') || undefined}>{chg}</em></span>)}
    </span>)}</div></motion.div>
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
/** Paper objects cut out of a scene and floated in code: [file, left %, top %, width %, height %, drift y px, turn deg, seconds]. */
type Floater = [string, number, number, number, number, number, number, number]
const SCENES: Record<string, { photo: string; person?: string; face: Quad; flat: string; Print: (p: { locale: AppLocale; active: boolean; step?: number }) => React.ReactElement; floaters?: Floater[]; script?: boolean; labels?: [number, number, number, number, number][] }> = {
  paper: { photo: 'paper-scene-w', person: 'paper-person-w', face: FACE, flat: FLAT, Print: PrintedHome },
  port: { photo: 'port-scene', face: {"tl": [9.57, 9.77], "tr": [53.03, 11.91], "br": [53.03, 82.68], "bl": [9.57, 84.64]},
    flat: '9.9% 12%, 11% 9.8%, 13% 9.4%, 49.4% 11.9%, 51% 12.6%, 51.6% 14.2%, 51.6% 82%, 50.8% 83.2%, 13% 84.6%, 10.9% 84%, 9.9% 82.4%', Print: PrintedPortfolio },
  quant: { photo: 'quant-scene', person: 'quant-person', face: {"tl": [41.02, 7.68], "tr": [85.74, 2.6], "br": [85.74, 82.36], "bl": [41.02, 80.4]},
    flat: '41.1% 10.4%, 42.2% 8%, 44.4% 7.2%, 83.6% 2.6%, 85.4% 3.1%, 85.7% 4.8%, 85.7% 53.6%, 41.1% 53.6%', Print: PrintedQuant },
  ai: { photo: 'ai-scene', person: 'ai-front', script: true, labels: [[23.15, 15.05, 27.1, 27, 16.89], [10.08, 22.11, 26.6, 16.63, 9.58], [24.25, 30.46, -19, 22.73, 15.97]], face: {"tl": [30.27, 6.45], "tr": [81.45, 3.13], "br": [81.45, 88.74], "bl": [30.27, 81.71]}, flat: '33.4% 6.3%, 79% 3%, 80.6% 3.2%, 81.4% 4.4%, 81.4% 86%, 80.7% 87.6%, 79% 88.3%, 32% 81.6%, 30.4% 80.4%, 30.4% 9.2%, 31.2% 7.9%, 32% 6.6%', Print: PrintedAi },
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
  const reduced = useReducedMotion()
  const step = useScript(active && !!sc.script, AI_TIMES)
  return <div className={styles.paperStage} ref={stage}>
    <img className={styles.paperPhoto} src={`${ART}/${sc.photo}.webp`} alt="" draggable={false} />
    {box.w > 0 && <div className={styles.faceClip} style={{ clipPath: `polygon(${sc.flat})` }}>
      <div className={styles.face} style={{ width: FACE_W, height: FACE_H, transform: quadMatrix(q) }}><Print locale={locale} active={active} step={sc.script ? step : undefined} /></div>
    </div>}
    {scene === 'port' && box.w > 0 && <PaperCards box={box} locale={locale} />}
    {sc.person && <img className={styles.paperPerson} src={`${ART}/${sc.person}.webp`} alt="" draggable={false} />}
    {sc.labels?.map(([cx, cy, ang, long, short], k) => { const word = (BUBBLE_WORDS[locale] ?? BUBBLE_WORDS.en!)[k]
      return <span key={k} className={styles.bubbleInk} style={{ left: `${cx}%`, top: `${cy}%`, rotate: `${ang}deg`, fontSize: `${fitWord(word, long, short)}cqw` }}>{word}</span> })}
    {sc.floaters?.map(([src, left, top, width, height, dy, turn, sec], k) => <motion.div key={src} className={styles.floater} data-k={k}
      style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
      animate={reduced ? undefined : { y: [0, dy, 0], rotate: [0, turn, 0] }} transition={{ duration: sec, ease: 'easeInOut', repeat: Infinity }}>
      <img src={`${ART}/${src}.webp`} alt="" draggable={false} />
    </motion.div>)}
  </div>
}

const CUT = { type: 'spring', stiffness: 260, damping: 32, mass: .9 } as const
const EASE = [.65, 0, .35, 1] as const

const COPY: Partial<Record<AppLocale, { units: string[]; facts: string[]; code: string; note: string; lang: string }>> = {
  'zh-CN': {
    lang: '语言',
    units: ['+ 处空间', '次配置', '% 规则驱动', 'h 随时问'],
    facts: ['写字楼 · 物流仓 · 产业园', '多种资产，一次配好', '过程透明，可以回看', '不懂就问，帮你看明白'],
    code: '邀请码（新用户填写）', note: '老用户直接登录；新用户现在填，或注册时再填',
  },
  en: {
    lang: 'Language',
    units: ['+ spaces', 'setup', '% rule-driven', 'h, ask any time'],
    facts: ['Offices · logistics · parks', 'Many assets, set up once', 'In the open, easy to review', 'Ask anything, see it clearly'],
    code: 'Invitation code (new accounts)', note: 'Have an account? Just sign in. New here? Add it now or at sign-up',
  },
}

/** A number that counts up each time its card becomes the current one. */
function Count({ value, run }: { value: number; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!run) return
    const c = animate(0, value, { duration: 2.2, delay: .35, ease: [.16, 1, .3, 1], onUpdate: v => { if (ref.current) ref.current.textContent = String(Math.round(v)) } })
    return () => c.stop()
  }, [run, value])
  return <span ref={ref}>{value}</span>
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
  const foot = (extra = '') => <footer className={`${styles.cardFoot} ${extra}`} data-last={i === CARDS.length - 1 || undefined}>
    <div className={styles.number}><b><Count value={card.value} run={active} /></b><small>{c.units[i]}</small></div>
    <h2 className={styles.title}>{text.title}</h2>
    <p className={styles.fact}>{c.facts[i]}</p>
  </footer>
  return <article className={`${styles.card} ${styles.sceneCard}`} aria-hidden={!active} style={{ '--sky': card.sky, '--ground': card.ground } as React.CSSProperties}>
    <PaperScene scene={card.scene} active={active} locale={locale} />
    {foot(styles.sceneFoot)}
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
  // One move per change, always the same calm length however fast the finger was; no new swipe until it has landed.
  const busy = useRef(false)
  useEffect(() => {
    busy.current = !reduced
    const c = animate(pos, index, reduced ? { duration: 0 } : { duration: .8, ease: [.22, .8, .18, 1] })
    c.then(() => { busy.current = false })
    return () => c.stop()
  }, [index, pos, reduced])

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
  const down = (e: ReactPointerEvent) => { if (busy.current || (e.target as HTMLElement).closest('button, input, a')) return; drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId } }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    // At most one page away from the current one, whatever the finger does.
    let v = index - Math.max(-1, Math.min(1, ((e.clientX - d.x) * (rtl ? -1 : 1)) / Math.max(1, view)))
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
    if (next === index) animate(pos, index, { duration: .45, ease: [.22, .8, .18, 1] })
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

  // The status bar (Android theme-color) and the page behind it (iOS) take the colour at the top of the current photo.
  return <section className={styles.guide} data-scene={'scene' in CARDS[index] || undefined} data-offer={offer || undefined} data-guide-chrome={CARDS[index].sky}>
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
      {offer && <AppOffer kind={offer} locale={locale} invite={invite} size="row" />}
      <motion.button type="button" className={styles.finishBtn} onClick={onDone} whileTap={{ scale: .98 }}>
        <span>{all.enter}</span><i><ArrowRight size={17} strokeWidth={1.6} /></i>
      </motion.button>
    </motion.div>}</AnimatePresence>
    </div>
  </section>
}
