'use client'

import { useEffect, useState } from 'react'
import { ChartColumn, ChartPie, House, Wifi } from 'lucide-react'
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

/** The Koala Quant watch, drawn in ink, with its registers ticking and a marker running round the ring. */
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
    <rect x="66" y="52" width="68" height="22" rx="3" /><rect x="68.5" y="54.5" width="63" height="17" rx="2" opacity=".4" />
    <text x="100" y="68" textAnchor="middle" className={styles.kMono}>+**.**%</text>
    <text x="100" y="83" textAnchor="middle" className={styles.kTiny}>{zh ? '成立以来' : 'SINCE LAUNCH'}</text>
    <text x="100" y="97" textAnchor="middle" className={styles.kName}>{zh ? '考 拉 量 化' : 'KOALA QUANT'}</text>
    <circle cx="68" cy="122" r="17" /><circle cx="68" cy="122" r="13" strokeDasharray="1 2.4" opacity=".6" />
    <g className={styles.kNeedleA}><path d="M68 122 L74 108" /></g><circle cx="68" cy="122" r="1.6" className={styles.kFill} />
    <text x="68" y="111" textAnchor="middle" className={styles.kTiny}>{zh ? '7日' : '7D'}</text>
    <circle cx="132" cy="122" r="17" /><circle cx="132" cy="122" r="13" strokeDasharray="1 2.4" opacity=".6" />
    <g className={styles.kNeedleB}><path d="M132 122 L122 112" /></g><circle cx="132" cy="122" r="1.6" className={styles.kFill} />
    <text x="132" y="111" textAnchor="middle" className={styles.kTiny}>{zh ? '30日' : '30D'}</text>
    <text x="100" y="118" textAnchor="middle" className={styles.kTiny}>{zh ? '最大回撤' : 'MAX DD'}</text>
    <path d="M89 136 a11 11 0 0 1 22 0" /><g className={styles.kNeedleC}><path d="M100 136 L92 132" /></g><circle cx="100" cy="136" r="1.4" className={styles.kFill} />
    <rect x="76" y="146" width="48" height="13" rx="2" /><text x="100" y="155.5" textAnchor="middle" className={styles.kMonoS}>2026.10.25</text>
    <circle cx="66" cy="152.5" r="5" /><path d="M67.5 150 l-2.5 2.5 l2.5 2.5" /><circle cx="134" cy="152.5" r="5" opacity=".5" />
  </svg>
}

const K: Record<'zh' | 'en', { overview: string; mine: string; principal: string; daily: string; pending: string; notYet: string; nav: string; days: [string, string, string]; quant: string }> = {
  zh: { overview: '总览', mine: '我的', principal: '当前本金 USDT', daily: '最近一日净收益', pending: '待处理', notYet: '尚未开始结算', nav: '净值走势', days: ['7天', '30天', '全部'], quant: '量化' },
  en: { overview: 'Overview', mine: 'Mine', principal: 'Principal USDT', daily: 'Last day net', pending: 'Pending', notYet: 'Not settled yet', nav: 'NAV trend', days: ['7D', '30D', 'All'], quant: 'Quant' },
}

/**
 * The Koala Quant page, as in the app, written on the cabinet's front face in the guide's ink (lines and outlines,
 * figures masked as on the guide's pages; only the logo keeps its colours). The overview tab stands off the face as
 * a raised key. A little life: the registers tick, a marker runs round the ring, the trend line redraws, the tabs
 * slide now and then.
 */
function KoalaPrint({ locale }: { locale: AppLocale }) {
  const k = K[locale === 'zh-CN' ? 'zh' : 'en']
  return <div className={styles.kPrint}>
    <div className={styles.kStatus}><b><Clock /></b><span><i className={styles.kSig}><i /><i /><i /><i /></i><Wifi strokeWidth={2.2} /><i className={styles.kBatt}><i /></i></span></div>
    <DialDrawing zh={locale === 'zh-CN'} />
    <div className={styles.kSeg}><i className={styles.kKey} /><b>{k.overview}</b><b>{k.mine}</b></div>
    <div className={styles.kStats}>
      <span><small>{k.principal}</small><b>* * *</b></span>
      <span><small>{k.daily}</small><b>—</b><small>{k.notYet}</small></span>
      <span><small>{k.pending}</small><b>0</b></span>
    </div>
    <div className={styles.kNavHead}><b>{k.nav}</b><span><small>10-20</small><strong>1.****</strong></span></div>
    <div className={styles.kDays}><b>{k.days[0]}</b><span>{k.days[1]}</span><span>{k.days[2]}</span></div>
    <svg className={styles.kChart} viewBox="0 0 220 90" aria-hidden="true">
      <path d="M22 14 H218 M22 44 H218 M22 74 H218" opacity=".2" strokeDasharray="2 3" />
      <text x="0" y="16">1.173</text><text x="0" y="46">1.156</text><text x="0" y="76">1.138</text>
      <path className={styles.kArea} d="M24 76 C40 66 52 58 70 60 S100 54 118 50 S146 52 160 42 S196 24 216 14 V80 H24 Z" />
      <path className={styles.kLine} pathLength={1} d="M24 76 C40 66 52 58 70 60 S100 54 118 50 S146 52 160 42 S196 24 216 14" />
      <circle cx="216" cy="14" r="3" /><path d="M216 18 V80" strokeDasharray="1.5 2.5" opacity=".6" />
      <text x="20" y="89">10-13</text><text x="64" y="89">10-15</text><text x="124" y="89">10-17</text><text x="194" y="89">10-20</text>
    </svg>
    <div className={styles.kDock}><span><House strokeWidth={1.6} /><ChartColumn strokeWidth={1.6} /><b><RwaLogoMark width={13} height={8} label="" />{k.quant}</b><ChartPie strokeWidth={1.6} /></span><i /></div>
  </div>
}

const SIDE: Partial<Record<AppLocale, { title: string; line: string }>> = {
  'zh-CN': { title: '产品陈列', line: '地产 · 量化 · 黄金 · 现金' },
  en: { title: 'On the shelf', line: 'REITs · Quant · Gold · Cash' },
}

/**
 * The sign-in scene, framed like the guide's: a rounded paper cabinet in the studio (day / night). Its side holds our
 * products in 16 cubbies under a written header; its front face is the phone, showing the Koala Quant page. A tag
 * hangs over the face's corner, so its cut-out sits above the print.
 */
export function CabinetScene({ locale, night }: { locale: AppLocale; night: boolean }) {
  const side = SIDE[locale] ?? SIDE.en!
  const art = `/media/palette-a/login/cab-${night ? 'night' : 'day'}`
  return <div className={styles.cabStage} aria-hidden="true">
    <img className={styles.cabPhoto} src={`${art}.webp`} alt="" draggable={false} />
    <svg className={styles.cabSide} viewBox="0 0 1024 1536" preserveAspectRatio="none">
      <g transform="matrix(.78 .25 0 1 616 196)">
        <text x="0" y="0" className={styles.cabSideTitle}>{side.title}</text>
        <text x="0" y="38" className={styles.cabSideLine}>{side.line}</text>
        <path d="M0 60 H120" className={styles.cabSideRule} />
      </g>
    </svg>
    <div className={styles.cabFace}><KoalaPrint locale={locale} /></div>
    <img className={styles.cabTag} src={`${art}-tag.webp`} alt="" draggable={false} />
  </div>
}
