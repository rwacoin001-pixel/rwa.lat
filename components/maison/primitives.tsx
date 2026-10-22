'use client'

import { Instrument_Serif } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { AlertTriangle, CircleSlash, Inbox, RotateCw } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { fmtPct } from '@/lib/money'
import { PredictionImage } from '@/components/prediction-image'
import styles from './maison.module.css'
import { PullToRefresh } from './PullToRefresh'

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--home-display-latin', display: 'swap' })

export { styles as maison }

export function MaisonPage({ page, topbar, children, dock = false, cta = false, hero = false, className }: { page: string; topbar?: ReactNode; children: ReactNode; dock?: boolean; cta?: boolean; hero?: boolean; className?: string }) {
  return <section className={`${styles.root} ${display.variable} ${GeistSans.variable} ${GeistMono.variable}${className ? ` ${className}` : ''}`} data-maison-page={page} data-dock={dock} data-cta={cta} data-hero={hero || undefined}>
    {topbar}
    {dock && <PullToRefresh />}
    <div className={styles.grain} aria-hidden="true" />
    <div className={styles.body}>{children}</div>
  </section>
}

export function SectionHead({ index, title, note, action }: { index?: string; title: ReactNode; note?: ReactNode; action?: ReactNode }) {
  return <div className={styles.sectionHead}>
    <div>
      <h2>{index && <small>{index}</small>}{title}</h2>
      {note && <p>{note}</p>}
    </div>
    {action}
  </div>
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className={styles.skeleton} data-navigation-loading="true" aria-busy="true" aria-live="polite">{Array.from({ length: rows }, (_, index) => <i key={index} />)}</div>
}

/** One honest block for empty / error / unavailable. Never used for a successful zero. */
export function StateBlock({ tone = 'empty', title, body, retry, retryLabel, action }: { tone?: 'empty' | 'error' | 'unavailable'; title: string; body?: ReactNode; retry?: () => void; retryLabel?: string; action?: ReactNode }) {
  const Icon = tone === 'error' ? AlertTriangle : tone === 'unavailable' ? CircleSlash : Inbox
  return <div className={styles.state} data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
    <b>{title}</b>
    {body && <p>{body}</p>}
    {retry && <button type="button" className={styles.link} onClick={retry}><RotateCw size={13} />{retryLabel}</button>}
    {action}
  </div>
}

export function toneOf(value: string | null | undefined) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return styles.flat
  const number = Number(value)
  return number > 0 ? styles.up : number < 0 ? styles.down : styles.flat
}

export function Delta({ value }: { value: string | null | undefined }) {
  return <span className={`${styles.num} ${toneOf(value)}`}>{fmtPct(value, { signed: true })}</span>
}

/** Filled change pill for table columns. */
export function DeltaPill({ value }: { value: string | null | undefined }) {
  return <span className={`${styles.pill} ${styles.num} ${toneOf(value)}`}>{fmtPct(value, { signed: true })}</span>
}

/** `shared` marks the thumbnail as the start of the list → detail picture flight (lib/market-shared-transition). */
export function Logo({ src, name, shared }: { src?: string | null; name: string; shared?: string }) {
  return <span className={styles.logo} aria-hidden="true" data-shared={src && shared ? shared : undefined}>
    <PredictionImage src={src} name={name} />
  </span>
}

/** Area line over real points only. Callers render an empty state when fewer than two exist. */
export function Sparkline({ points, label }: { points: number[]; label: string }) {
  const id = useId().replace(/:/g, '')
  const width = 320
  const height = 132
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const coords = points.map((value, index) => [index / (points.length - 1) * width, height - 10 - (value - min) / span * (height - 24)] as const)
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return <div className={styles.chart}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`m-area-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--m-accent)" stopOpacity=".28" />
          <stop offset="1" stopColor="var(--m-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} className={styles.gridLine} x1="0" x2={width} y1={height * ratio} y2={height * ratio} />)}
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#m-area-${id})`} />
      <path className={styles.line} d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
}
