'use client'

import { useEffect, useState } from 'react'
import { Wifi } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import RwaLogoMark from '../rwa-logo'
import styles from './P02-Login.module.css'

/** The time on the cabinet's phone face: the device's own clock. */
function Clock() {
  const format = () => new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: false })
  const [now, setNow] = useState('')
  useEffect(() => { setNow(format()); const timer = setInterval(() => setNow(format()), 15000); return () => clearInterval(timer) }, [])
  return <>{now || ' '}</>
}

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [100 + Math.cos(a) * r, 112 + Math.sin(a) * r].map(v => v.toFixed(1))
}
/** Minute track: 60 marks, every fifth longer. */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const [x1, y1] = polar(i % 5 ? 80 : 76, i * 6)
  const [x2, y2] = polar(85, i * 6)
  return `M${x1} ${y1} L${x2} ${y2}`
}).join(' ')

/** The Koala Quant watch, drawn in ink: bezel, minute track, the name window, two registers, the drawdown gauge, the date. */
function DialDrawing({ name }: { name: string }) {
  return <svg className={styles.cabDial} viewBox="0 0 200 212" aria-hidden="true">
    <path d="M92 2 h16 v9 h-16 Z M95 11 v7 M105 11 v7 M95 5 v3 M99 5 v3 M103 5 v3" />
    <path d="M168 40 l9 -9 l6 6 l-9 9 Z" />
    <circle cx="100" cy="112" r="94" /><circle cx="100" cy="112" r="89" opacity=".55" />
    <path d={TICKS} opacity=".8" />
    <circle cx="100" cy="112" r="62" opacity=".6" /><circle cx="100" cy="112" r="58" strokeDasharray="1.5 3" opacity=".45" />
    <rect x="70" y="66" width="60" height="20" rx="3" /><text x="100" y="80" textAnchor="middle" className={styles.cabMono}>+**.**%</text>
    <text x="100" y="98" textAnchor="middle">{name}</text>
    <circle cx="72" cy="124" r="16" /><path d="M72 124 l6 -10" /><circle cx="72" cy="124" r="1.6" className={styles.cabInkFill} />
    <circle cx="128" cy="124" r="16" /><path d="M128 124 l-8 -8" /><circle cx="128" cy="124" r="1.6" className={styles.cabInkFill} />
    <path d="M88 150 a12 12 0 0 1 24 0" /><path d="M100 150 l-8 -4" /><circle cx="100" cy="150" r="1.6" className={styles.cabInkFill} />
    <rect x="78" y="160" width="44" height="12" rx="2" /><path d="M83 166 h34" strokeDasharray="3 2.4" opacity=".7" />
    <path d="M70 166 l-4 0 M130 166 l4 0" opacity=".6" />
  </svg>
}

/**
 * The sign-in cabinet's front face: the Koala Quant page, written on it by hand in the guide's ink (grey lines and
 * outlines, no fills); only the logo keeps its colours. Decorative: the real form is below the cabinet.
 */
export function CabinetFace({ locale }: { locale: AppLocale }) {
  const zh = locale === 'zh-CN'
  return <div className={styles.cabFace} aria-hidden="true">
    <div className={styles.cabStatus}><b><Clock /></b><span><i className={styles.cabSig}><i /><i /><i /><i /></i><Wifi size={11} strokeWidth={2.2} /><i className={styles.cabBatt}><i /></i></span></div>
    <div className={styles.cabHead}><RwaLogoMark width={26} height={15} label="" /><b>{zh ? '考拉量化' : 'Koala Quant'}</b><i className={styles.cabAvatar}><img src="/media/palette-a/avatars/a00.svg" alt="" draggable={false} /></i></div>
    <DialDrawing name={zh ? '考 拉 量 化' : 'KOALA QUANT'} />
    <div className={styles.cabSeg}><b>{zh ? '总览' : 'Overview'}</b><span>{zh ? '我的' : 'Mine'}</span></div>
    <svg className={styles.cabChart} viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 58 H200 M0 30 H200" opacity=".25" />
      <path d="M2 52 C20 45 34 48 50 43 S78 31 96 34 S120 34 136 24 S172 13 198 5" strokeWidth="1.8" />
      <circle cx="198" cy="5" r="2.6" />
    </svg>
    <div className={styles.cabBuy}><b>{zh ? '申购' : 'Subscribe'}</b><i>→</i></div>
  </div>
}
