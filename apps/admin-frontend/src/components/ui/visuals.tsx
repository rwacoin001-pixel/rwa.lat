'use client'

import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────
 * 数据可视化基件（纯 SVG / CSS，零依赖）：
 * StatCard / Sparkline / MiniBars / ProgressRing / ProgressBar / DeltaBadge
 * ───────────────────────────────────────────────────────────── */

type Tone = 'mint' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'

const TONES: Record<Tone, { solid: string; soft: string; text: string }> = {
  mint: { solid: '#5b6cf9', soft: 'rgba(91,108,249,0.12)', text: '#5b6cf9' },
  violet: { solid: '#8b5cf6', soft: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  sky: { solid: '#38bdf8', soft: 'rgba(56,189,248,0.14)', text: '#0284c7' },
  emerald: { solid: '#10b981', soft: 'rgba(16,185,129,0.14)', text: '#059669' },
  amber: { solid: '#f59e0b', soft: 'rgba(245,158,11,0.16)', text: '#b45309' },
  rose: { solid: '#f43f5e', soft: 'rgba(244,63,94,0.14)', text: '#e11d48' },
  slate: { solid: '#64748b', soft: 'rgba(100,116,139,0.14)', text: '#475569' },
}

export function DeltaBadge({ value, className, suffix = '%' }: { value: number | null | undefined; className?: string; suffix?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        up ? 'bg-emerald-500/12 text-emerald-600' : 'bg-rose-500/12 text-rose-600',
        className,
      )}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  )
}

export function Sparkline({ data, className, stroke = '#5b6cf9', height = 36 }: { data: number[]; className?: string; stroke?: string; height?: number }) {
  if (!data.length) return null
  const width = 120
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 6) - 3).toFixed(1)}`)
  const id = `spark-${stroke.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn('h-9 w-full', className)} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={points.join(' ')} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  tone = 'mint',
  spark,
  delay = 0,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  delta?: number | null
  icon?: ComponentType<{ className?: string }>
  tone?: Tone
  spark?: number[]
  delay?: number
  className?: string
}) {
  const t = TONES[tone]
  return (
    <div className={cn('glass-strong card-lift animate-rise rounded-card p-5', className)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-text-secondary">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        </div>
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: t.soft }}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {(sub || delta !== undefined) && (
        <div className="mt-2.5 flex items-center gap-2 text-[12px] text-text-faint">
          <DeltaBadge value={delta} />
          {sub && <span className="truncate">{sub}</span>}
        </div>
      )}
      {spark && spark.length > 1 && <Sparkline data={spark} stroke={t.solid} className="mt-2" />}
    </div>
  )
}

export function MiniBars({
  data,
  className,
  height = 168,
  tone = 'mint',
  valueFormatter,
}: {
  data: Array<{ label: string; value: number; hint?: string; highlight?: boolean }>
  className?: string
  height?: number
  tone?: Tone
  valueFormatter?: (value: number) => string
}) {
  const t = TONES[tone]
  const max = Math.max(...data.map((d) => d.value), 1)
  const format = valueFormatter ?? ((v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)))
  return (
    <div className={cn('flex items-end gap-2 sm:gap-3', className)} style={{ height }}>
      {data.map((item, index) => {
        const pct = Math.max((item.value / max) * 100, item.value > 0 ? 4 : 1.5)
        return (
          <div key={`${item.label}-${index}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={item.hint}>
            <span className="text-[11px] font-semibold tabular-nums text-text-secondary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {format(item.value)}
            </span>
            <div
              className={cn('bar-grow w-full max-w-[54px] rounded-t-xl transition-all duration-300 group-hover:brightness-105')}
              style={{
                height: `${pct}%`,
                animationDelay: `${index * 70}ms`,
                background: item.highlight
                  ? `linear-gradient(180deg, ${t.solid} 0%, ${t.solid}cc 100%)`
                  : `linear-gradient(180deg, ${t.solid}66 0%, ${t.solid}33 100%)`,
              }}
            />
            <span className="max-w-full truncate text-[11px] text-text-faint">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ProgressRing({
  value,
  size = 148,
  strokeWidth = 13,
  tone = 'mint',
  label,
  children,
  className,
}: {
  value: number | null
  size?: number
  strokeWidth?: number
  tone?: Tone
  label?: string
  children?: ReactNode
  className?: string
}) {
  const t = TONES[tone]
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = value === null ? 0 : Math.min(Math.max(value, 0), 100)
  const offset = circumference * (1 - clamped / 100)
  return (
    <div className={cn('relative inline-flex flex-col items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,24,48,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={t.solid}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="ring-anim"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="text-2xl font-bold tabular-nums">{value === null ? '—' : `${Math.round(clamped)}%`}</span>
            {label && <span className="mt-0.5 text-[11px] text-text-faint">{label}</span>}
          </>
        )}
      </div>
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'mint',
  height = 8,
  className,
  trackClassName,
  label,
  valueText,
}: {
  value: number | null
  tone?: Tone
  height?: number
  className?: string
  trackClassName?: string
  label?: ReactNode
  valueText?: ReactNode
}) {
  const t = TONES[tone]
  const clamped = value === null ? 0 : Math.min(Math.max(value, 0), 100)
  return (
    <div className={cn('w-full', className)}>
      {(label || valueText) && (
        <div className="mb-1.5 flex items-center justify-between text-[12px]">
          <span className="text-text-secondary">{label}</span>
          <span className="font-semibold tabular-nums text-ink">{valueText ?? (value === null ? '—' : `${clamped.toFixed(1)}%`)}</span>
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-ink/[0.07]', trackClassName)} style={{ height }}>
        <div
          className="bar-fill h-full rounded-full"
          style={{ width: `${clamped}%`, background: `linear-gradient(90deg, ${t.solid}99 0%, ${t.solid} 100%)` }}
        />
      </div>
    </div>
  )
}
