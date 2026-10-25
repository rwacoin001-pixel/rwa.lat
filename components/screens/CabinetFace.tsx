'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChartColumn, ChartPie, ChevronLeft, ChevronRight, House, Wifi } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import RwaLogoMark from '../rwa-logo'
import styles from './P02-Login.module.css'

/** The time on the cabinet's phone face: the device's own clock. */
function Clock() {
  const format = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false })
  const [now, setNow] = useState('')
  useEffect(() => { setNow(format()); const timer = setInterval(() => setNow(format()), 15000); return () => clearInterval(timer) }, [])
  return <>{now || ' '}</>
}

/** The page is laid out on a flat 300 x 755 sheet, then mapped onto the face as the photo shows it. */
const SHEET_W = 300
const SHEET_H = 755
/** The face's corners in the photo (% of its width, % of its height), measured on both renders: tl, tr, br, bl. The face
 * is turned a little toward the right, so its top edge climbs and its bottom edge drops on that side. */
const FACE: [number, number][] = [[8.2, 8.53], [58.2, 5.34], [58.2, 91.67], [8.2, 89.91]]

/** CSS matrix3d taking a W x H box onto a quadrilateral (tl, tr, br, bl, in px). */
function quadMatrix(q: [number, number][], W: number, H: number) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3
  const den = dx1 * dy2 - dx2 * dy1
  const g = den ? (dx3 * dy2 - dx2 * dy3) / den : 0
  const h = den ? (dx1 * dy3 - dx3 * dy1) / den : 0
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3
  return `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${h / H},0,0,1,0,${x0},${y0},0,1)`
}

const polar = (r: number, deg: number, cx = 100, cy = 104) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r].map(v => v.toFixed(1))
}
/** Settlement ring: 30 day marks (some longer, as on the real dial) and a fine minute track. */
const RING = Array.from({ length: 30 }, (_, i) => {
  const long = [0, 3, 7, 12, 16, 21, 25].includes(i)
  const [x1, y1] = polar(long ? 70 : 74, i * 12)
  const [x2, y2] = polar(80, i * 12)
  return `M${x1} ${y1} L${x2} ${y2}`
}).join(' ')
const TRACK = Array.from({ length: 120 }, (_, i) => {
  const [x1, y1] = polar(i % 10 ? 88 : 85, i * 3)
  const [x2, y2] = polar(90, i * 3)
  return `M${x1} ${y1} L${x2} ${y2}`
}).join(' ')

/** The Koala Quant watch, in ink, with its registers ticking and a marker running round the ring. Figures as in the app. */
function DialDrawing({ zh }: { zh: boolean }) {
  return <svg className={styles.kDial} viewBox="0 0 200 204" aria-hidden="true">
    <path d="M93 0 h14 v9 h-14 Z M96 3 v3 M100 3 v3 M104 3 v3 M97 9 v6 M103 9 v6" />
    <path d="M166 30 l8 -8 l6 6 l-8 8 Z M168 38 l-4 4" />
    <circle cx="100" cy="104" r="96" /><circle cx="100" cy="104" r="92" opacity=".5" />
    <path d={TRACK} opacity=".45" />
    <path d={RING} strokeWidth="2" />
    <g className={styles.kRun}><circle cx="100" cy="27" r="3.2" className={styles.kFill} /></g>
    <circle cx="100" cy="104" r="62" opacity=".55" /><circle cx="100" cy="104" r="58" strokeDasharray="1.2 2.6" opacity=".45" />
    <circle cx="100" cy="36" r="6" /><path d="M97 34 h6 l-3 4 Z" />
    <rect x="64" y="51" width="72" height="23" rx="3" /><rect x="66.5" y="53.5" width="67" height="18" rx="2" opacity=".4" />
    <text x="100" y="68" textAnchor="middle" className={styles.kMono}>+17.26%</text>
    <text x="100" y="83" textAnchor="middle" className={styles.kTiny}>{zh ? '成立以来' : 'SINCE LAUNCH'}</text>
    <text x="100" y="97" textAnchor="middle" className={styles.kName}>{zh ? '考 拉 量 化' : 'KOALA QUANT'}</text>
    <circle cx="66" cy="124" r="19" /><circle cx="66" cy="124" r="15" strokeDasharray="1 2.4" opacity=".6" />
    <g className={styles.kNeedleA}><path d="M66 124 L72 110" /></g><circle cx="66" cy="124" r="1.6" className={styles.kFill} />
    <text x="66" y="113" textAnchor="middle" className={styles.kTiny}>{zh ? '7日' : '7D'}</text>
    <text x="66" y="136" textAnchor="middle" className={styles.kMonoS}>+3.00%</text>
    <circle cx="134" cy="124" r="19" /><circle cx="134" cy="124" r="15" strokeDasharray="1 2.4" opacity=".6" />
    <g className={styles.kNeedleB}><path d="M134 124 L124 113" /></g><circle cx="134" cy="124" r="1.6" className={styles.kFill} />
    <text x="134" y="113" textAnchor="middle" className={styles.kTiny}>{zh ? '30日' : '30D'}</text>
    <text x="134" y="136" textAnchor="middle" className={styles.kMonoS}>+16.71%</text>
    <text x="100" y="116" textAnchor="middle" className={styles.kTiny}>{zh ? '最大回撤' : 'MAX DD'}</text>
    <path d="M90 132 a10 10 0 0 1 20 0" /><g className={styles.kNeedleC}><path d="M100 132 L93 128" /></g><circle cx="100" cy="132" r="1.4" className={styles.kFill} />
    <text x="100" y="141" textAnchor="middle" className={styles.kMonoS}>-0.08%</text>
    <rect x="74" y="147" width="52" height="13" rx="2" /><text x="100" y="156.5" textAnchor="middle" className={styles.kMonoS}>2026.10.25</text>
    <circle cx="64" cy="153.5" r="5" /><path d="M65.5 151 l-2.5 2.5 l2.5 2.5" /><circle cx="136" cy="153.5" r="5" opacity=".5" />
  </svg>
}

type KCopy = { title: string; overview: string; mine: string; principal: string; daily: string; pending: string; notYet: string; nav: string; days: [string, string, string]; quant: string; week: string[]; due: string }
const K: Record<'zh' | 'en', KCopy> = {
  zh: { title: '考拉量化', overview: '总览', mine: '我的', principal: '当前本金 USDT', daily: '最近一日净收益', pending: '待处理', notYet: '尚未开始结算', nav: '净值走势', days: ['7天', '30天', '全部'], quant: '量化',
    week: ['一', '二', '三', '四', '五', '六', '日'], due: '待结算' },
  en: { title: 'Koala Quant', overview: 'Overview', mine: 'Mine', principal: 'Principal USDT', daily: 'Last day net', pending: 'Pending', notYet: 'Not settled yet', nav: 'NAV trend', days: ['7D', '30D', 'All'], quant: 'Quant',
    week: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], due: 'Due' },
}

/** October 2026 as the app's earnings calendar shows it: daily results to the 20th, the 25th waiting to settle. */
const OCT: (string | null)[] = ['+0.91', '+0.06', '-0.04', '+0.83', '+0.97', '+0.16', '+0.82', '+0.05', '+0.05', '+0.93', '+0.97', '-0.04', '+0.30', '+0.82',
  '+0.04', '+0.51', '+0.02', '+0.71', '+0.37', '+0.50', null, null, null, null, null, null, null, null, null, null, null]

function Calendar({ k }: { k: KCopy }) {
  return <div className={styles.kCal}>
    <div className={styles.kCalHead}><ChevronLeft strokeWidth={1.6} /><b>2026 <i>/</i> 10</b><ChevronRight strokeWidth={1.6} opacity={.4} /></div>
    <div className={styles.kCalWeek}>{k.week.map((d, i) => <span key={i}>{d}</span>)}</div>
    <div className={styles.kCalDays}>
      {[0, 1, 2].map(i => <span key={`e${i}`} />)}
      {OCT.map((v, i) => {
        const day = i + 1
        if (day === 25) return <span key={day} className={styles.kDue}><b>25</b><small>{k.due}</small></span>
        return <span key={day} data-off={v === null || undefined}><b>{day}</b><small>{v === null ? (day < 25 ? '–' : '') : `${v}%`}</small></span>
      })}
    </div>
  </div>
}

/**
 * The Koala Quant page as in the app, written onto the cabinet's face in the guide's ink; only the logo keeps its
 * colours. The overview / mine key stands off the face, and every few seconds it slides over: Mine shows the
 * earnings calendar, Overview the figures and the trend. The registers tick and a marker runs round the ring.
 */
function KoalaPrint({ locale }: { locale: AppLocale }) {
  const k = K[locale === 'zh-CN' ? 'zh' : 'en']
  const [tab, setTab] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setTab(value => 1 - value), 5200)
    return () => clearInterval(timer)
  }, [])
  return <div className={styles.kPrint} data-tab={tab}>
    <div className={`${styles.kInk} ${styles.kStatus}`}><b><Clock /></b><span><i className={styles.kSig}><i /><i /><i /><i /></i><Wifi strokeWidth={2.2} /><i className={styles.kBatt}><i /></i></span></div>
    <div className={`${styles.kInk} ${styles.kHead}`}><RwaLogoMark width={30} height={17} label="" /><b>{k.title}</b></div>
    <div className={styles.kInk}><DialDrawing zh={locale === 'zh-CN'} /></div>
    <div className={styles.kSeg}><i className={styles.kKey} /><b className={styles.kInk}>{k.overview}</b><b className={styles.kInk}>{k.mine}</b></div>
    <div className={styles.kPanels}>
      <div className={`${styles.kInk} ${styles.kPanel}`} data-on={tab === 0 || undefined}>
        <div className={styles.kStats}>
          <span><small>{k.principal}</small><b>3,500.00</b></span>
          <span><small>{k.daily}</small><b>—</b><small>{k.notYet}</small></span>
          <span><small>{k.pending}</small><b>0</b></span>
        </div>
        <div className={styles.kNavHead}><b>{k.nav}</b><span><small>10-20</small><strong>1.1726</strong></span></div>
        <div className={styles.kDays}><b>{k.days[0]}</b><span>{k.days[1]}</span><span>{k.days[2]}</span></div>
        <svg className={styles.kChart} viewBox="0 0 220 90" aria-hidden="true">
          <path d="M22 14 H218 M22 44 H218 M22 74 H218" opacity=".2" strokeDasharray="2 3" />
          <text x="0" y="16">1.173</text><text x="0" y="46">1.156</text><text x="0" y="76">1.138</text>
          <path className={styles.kArea} d="M24 76 C40 66 52 58 70 60 S100 54 118 50 S146 52 160 42 S196 24 216 14 V80 H24 Z" />
          <path className={styles.kLine} pathLength={1} d="M24 76 C40 66 52 58 70 60 S100 54 118 50 S146 52 160 42 S196 24 216 14" />
          <circle cx="216" cy="14" r="3" /><path d="M216 18 V80" strokeDasharray="1.5 2.5" opacity=".6" />
          <text x="20" y="89">10-13</text><text x="64" y="89">10-15</text><text x="124" y="89">10-17</text><text x="194" y="89">10-20</text>
        </svg>
      </div>
      <div className={`${styles.kInk} ${styles.kPanel}`} data-on={tab === 1 || undefined}><Calendar k={k} /></div>
    </div>
    <div className={`${styles.kInk} ${styles.kDock}`}><span><House strokeWidth={1.6} /><ChartColumn strokeWidth={1.6} /><b><RwaLogoMark width={13} height={8} label="" />{k.quant}</b><ChartPie strokeWidth={1.6} /></span><i /></div>
  </div>
}

const SIDE: Partial<Record<AppLocale, { title: string; line: string }>> = {
  'zh-CN': { title: '产品陈列', line: '地产 · 量化 · 黄金 · 现金' },
  en: { title: 'On the shelf', line: 'REITs · Quant · Gold · Cash' },
}

/**
 * The sign-in scene, framed like the guide's: a rounded paper cabinet in the studio (day / night). Its side holds our
 * products in 16 cubbies under a written header; its front face is the phone, showing the Koala Quant page in the
 * face's own perspective. A tag hangs over the face's corner, so its cut-out sits above the print.
 */
export function CabinetScene({ locale, night }: { locale: AppLocale; night: boolean }) {
  const side = SIDE[locale] ?? SIDE.en!
  const art = `/media/palette-a/login/cab-${night ? 'night' : 'day'}`
  const stage = useRef<HTMLDivElement>(null)
  const [matrix, setMatrix] = useState('')
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    const fit = () => {
      const w = element.clientWidth, h = element.clientHeight
      if (w) setMatrix(quadMatrix(FACE.map(([x, y]) => [x / 100 * w, y / 100 * h]), SHEET_W, SHEET_H))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div className={styles.cabStage} ref={stage} aria-hidden="true">
    <img className={styles.cabPhoto} src={`${art}.webp`} alt="" draggable={false} />
    <svg className={styles.cabSide} viewBox="0 0 1024 1536" preserveAspectRatio="none">
      <g transform="matrix(.78 .25 0 1 616 196)">
        <text x="0" y="0" className={styles.cabSideTitle}>{side.title}</text>
        <text x="0" y="38" className={styles.cabSideLine}>{side.line}</text>
        <path d="M0 60 H120" className={styles.cabSideRule} />
      </g>
    </svg>
    <div className={styles.cabFace} style={{ width: SHEET_W, height: SHEET_H, transform: matrix, visibility: matrix ? undefined : 'hidden' }}><KoalaPrint locale={locale} /></div>
    <img className={styles.cabTag} src={`${art}-tag.webp`} alt="" draggable={false} />
  </div>
}
