'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { faceFor, money, moneyFull, sgTime, ago } from './format'

// Building blocks of the redesigned console (dark page, one big card per page, white list board, dark detail panel).

export function PageTitle({ title, back, meta, actions }: { title: string; back?: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5 pt-2">
      <div className="flex min-w-0 items-center gap-4">
        {back && <CircleButton href={back} label="返回"><ArrowLeft className="h-4 w-4" /></CircleButton>}
        <div className="min-w-0">
          <h1 className="truncate text-[34px] font-normal leading-[1.05] tracking-[-0.02em] text-ops-text sm:text-[44px]">{title}</h1>
          {meta && <div className="mt-2 text-[13px] text-ops-muted">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

type CircleProps = { label: string; children: ReactNode; href?: string; onClick?: () => void; badge?: number | boolean; badgeTone?: 'alert' | 'count'; active?: boolean; tone?: 'dark' | 'paper' }
/** `badgeTone="count"` is a quiet grey number (how much is open in an area); red is kept for the alerts bell. */
export function CircleButton({ label, children, href, onClick, badge, badgeTone = 'alert', active, tone = 'dark' }: CircleProps) {
  const cls = cn(
    'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
    tone === 'dark' ? 'border border-ops-line text-ops-text hover:bg-ops-raised' : 'border border-ops-rule text-ops-ink hover:bg-[#F4F5F7]',
    active && 'bg-ops-paper text-ops-ink hover:bg-ops-paper',
  )
  const dot = badge ? (
    <span className={cn('absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-medium leading-[18px]', badgeTone === 'alert' ? 'bg-ops-down text-white' : 'bg-ops-paper text-ops-ink', badge === true && 'h-2.5 min-w-0 w-2.5 px-0')}>
      {badge === true ? '' : badge > 99 ? '99+' : badge}
    </span>
  ) : null
  return href
    ? <Link href={href} aria-label={label} title={label} className={cls}>{children}{dot}</Link>
    : <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}>{children}{dot}</button>
}

type PillProps = { children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean; className?: string; type?: 'button' | 'submit'; title?: string }
const pillBase = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[14px] font-medium transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'
function pill(cls: string) {
  return function Pill({ children, onClick, href, disabled, className, type = 'button', title }: PillProps) {
    return href
      ? <Link href={href} title={title} className={cn(pillBase, cls, className)}>{children}</Link>
      : <button type={type} title={title} disabled={disabled} onClick={onClick} className={cn(pillBase, cls, className)}>{children}</button>
  }
}
/** The one main action of a view. */
export const LimeButton = pill('bg-ops-lime text-ops-ink hover:brightness-95')
export const WhiteButton = pill('bg-ops-paper text-ops-ink hover:bg-[#EDEFF2]')
export const OutlineButton = pill('border border-ops-line text-ops-text hover:bg-ops-raised')
export const DangerButton = pill('border border-ops-down/60 text-ops-down hover:bg-ops-down/10')
export const InkButton = pill('bg-ops-ink text-ops-text hover:bg-black')

export function Face({ id, size = 36, className }: { id: string | null | undefined; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={faceFor(id)} width={size} height={size} alt="" className={cn('shrink-0 rounded-full bg-[#E9EBEF] object-cover', className)} style={{ width: size, height: size }} />
}

export function FaceStack({ ids, max = 5 }: { ids: string[]; max?: number }) {
  const shown = ids.slice(0, max)
  return (
    <div className="flex items-center">
      {shown.map((id, i) => <Face key={id + i} id={id} size={30} className={cn('ring-2 ring-ops-card', i && '-ml-2')} />)}
      {ids.length > max && <span className="-ml-2 flex h-[30px] min-w-[30px] items-center justify-center rounded-full bg-ops-raised px-1.5 text-[11px] text-ops-muted ring-2 ring-ops-card">+{ids.length - max}</span>}
    </div>
  )
}

export function Money({ atomic, decimals = 6, unit, className, places = 2 }: { atomic: string | null | undefined; decimals?: number; unit?: string; className?: string; places?: number }) {
  return (
    <span title={atomic ? `${moneyFull(atomic, decimals)}${unit ? ' ' + unit : ''}` : undefined} className={cn('tabular-nums', className)}>
      {money(atomic, decimals, places)}{unit && <span className="ml-1 text-[0.6em] font-normal opacity-60">{unit}</span>}
    </span>
  )
}

export function When({ iso, prefix = '' }: { iso: string | null | undefined; prefix?: string }) {
  return <span title={sgTime(iso)}>{prefix}{ago(iso)}</span>
}

/** "15 秒前更新", ticking. */
export function Updated({ at, loading }: { at: number | null; loading?: boolean }) {
  const [, force] = useState(0)
  useEffect(() => { const t = window.setInterval(() => force((n) => n + 1), 5000); return () => window.clearInterval(t) }, [])
  if (loading && !at) return <span>正在读取…</span>
  if (!at) return null
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  return <span>{s < 5 ? '刚刚更新' : s < 60 ? `${s} 秒前更新` : `${Math.floor(s / 60)} 分钟前更新`}</span>
}

export type BigStat = { label: string; value: ReactNode; hint?: ReactNode; tone?: 'up' | 'down' | 'warn' }
export function BigStatCard({ stats, children, className }: { stats: BigStat[]; children?: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 rounded-[28px] border border-ops-line bg-ops-card p-5 sm:p-6', className)}>
      <div className="ops-scroll -mx-1 flex snap-x gap-8 overflow-x-auto px-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {stats.map((s) => (
          <div key={s.label} className="min-w-[170px] snap-start">
            <div className="text-[13px] text-ops-muted">{s.label}</div>
            <div className={cn('mt-2 text-[32px] font-normal leading-none tracking-[-0.02em] tabular-nums', s.tone === 'down' ? 'text-ops-down' : s.tone === 'warn' ? 'text-ops-warn' : s.tone === 'up' ? 'text-ops-up' : 'text-ops-text')}>{s.value}</div>
            {s.hint && <div className="mt-2 text-[12px] text-ops-muted">{s.hint}</div>}
          </div>
        ))}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}

export type Segment = { label: string; share: number; count: number; faces: string[]; tone?: 'lime' | 'warn' | 'down' }
/** The big card's timeline: one striped bar per segment, width by share, faces under it. */
export function SegmentTimeline({ segments }: { segments: Segment[] }) {
  return (
    // Phones: two by two. Wider: one row, each segment as wide as its share.
    <div className="grid grid-cols-2 gap-4 sm:[grid-template-columns:var(--segments)]" style={{ ['--segments' as string]: segments.map((s) => `minmax(84px, ${Math.max(s.share, 0.08)}fr)`).join(' ') }}>
      {segments.map((s) => (
        <div key={s.label} className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-[12px] text-ops-muted"><span className="truncate">{s.label}</span><span className="tabular-nums text-ops-text">{s.count}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-ops-raised">
            <div className={cn('ops-stripes h-full rounded-full', s.tone === 'down' ? 'bg-ops-down' : s.tone === 'warn' ? 'bg-ops-warn' : 'bg-ops-lime')} style={{ width: s.count ? '100%' : '0%' }} />
          </div>
          <div className="mt-3 h-[30px]">{s.faces.length > 0 && <FaceStack ids={s.faces} />}</div>
        </div>
      ))}
    </div>
  )
}

export type SideChip = { key: string; label: string; sub?: string; active?: boolean; onClick?: () => void }
export function SideCard({ label, value, badge, chips, action, href, children }: { label: string; value: ReactNode; badge?: ReactNode; chips?: SideChip[]; action?: ReactNode; href?: string; children?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-[28px] border border-ops-line bg-ops-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] text-ops-muted">{label}</div>
        {href && <CircleButton href={href} label="打开"><ArrowUpRight className="h-4 w-4" /></CircleButton>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <div className="text-[32px] font-normal leading-none tracking-[-0.02em] tabular-nums text-ops-text">{value}</div>
        {badge && <span className="rounded-full border border-ops-line px-3 py-1 text-[12px] text-ops-muted">{badge}</span>}
      </div>
      {children}
      <div className="mt-auto flex items-end gap-2 pt-6">
        {chips?.map((c) => (
          <button key={c.key} type="button" onClick={c.onClick} className={cn('flex h-[72px] min-w-[78px] flex-col justify-between rounded-[18px] px-3 py-2.5 text-left transition-colors', c.active ? 'bg-ops-lime text-ops-ink' : 'bg-ops-raised text-ops-text hover:bg-[#30343D]')}>
            <span className="text-[13px] font-medium">{c.label}</span>
            {c.sub && <span className={cn('text-[11px]', c.active ? 'text-ops-ink/70' : 'text-ops-muted')}>{c.sub}</span>}
          </button>
        ))}
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </section>
  )
}

export function FilterBar({ active, onClear, children }: { active: number; onClear?: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-5">
      <button type="button" onClick={onClear} disabled={!active} className="mr-2 flex items-center gap-2 text-[14px] text-ops-text disabled:cursor-default">
        当前筛选
        <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]', active ? 'bg-ops-paper text-ops-ink' : 'bg-ops-raised text-ops-muted')}>{active}</span>
        {active > 0 && <X className="h-3.5 w-3.5 text-ops-muted" aria-label="清空筛选" />}
      </button>
      {children}
    </div>
  )
}

export function SelectPill<T extends string>({ value, onChange, options, placeholder }: { value: T | ''; onChange: (v: T | '') => void; options: Array<{ value: T; label: string }>; placeholder: string }) {
  return (
    <label className="relative">
      <span className="sr-only">{placeholder}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T | '')} className={cn('h-10 min-w-[150px] appearance-none rounded-full border border-ops-line bg-ops-card pl-4 pr-9 text-[13px] outline-none focus:border-ops-lime', value ? 'text-ops-text' : 'text-ops-muted')}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-ops-muted">▼</span>
    </label>
  )
}

export function SearchPill({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 min-w-[220px] flex-1 rounded-full border border-ops-line bg-ops-card px-4 text-[13px] text-ops-text outline-none placeholder:text-ops-muted focus:border-ops-lime" />
  )
}

export type BoardTab = { key: string; label: string; count?: number }
/** The white board: a floating dark tab group on its top edge, list (left) and the dark detail panel (right). */
export function Board({ title, tabs, active, onTab, tools, children }: { title?: string; tabs?: BoardTab[]; active?: string; onTab?: (key: string) => void; tools?: ReactNode; children: ReactNode }) {
  return (
    <section className="relative min-w-0 rounded-[28px] bg-ops-paper text-ops-ink">
      {tabs && (
        <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 gap-1 rounded-full bg-ops-bg p-1.5 shadow-[0_0_0_6px_#14161B]">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => onTab?.(t.key)} className={cn('flex h-9 items-center gap-2 rounded-full px-4 text-[13px] transition-colors', active === t.key ? 'bg-ops-lime text-ops-ink' : 'bg-ops-raised text-ops-text hover:bg-[#30343D]')}>
              {t.label}
              {t.count !== undefined && <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]', active === t.key ? 'bg-ops-ink text-ops-lime' : 'bg-ops-card text-ops-muted')}>{t.count}</span>}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-8 sm:pt-6">
        {title && <h2 className="text-[17px] font-medium">{title}</h2>}
        {tools && <div className="ml-auto flex items-center gap-2">{tools}</div>}
      </div>
      <div className="px-3 pb-3 sm:px-4 sm:pb-4">{children}</div>
    </section>
  )
}

/** Small status chip; `on` = it sits on the selected (dark) row. */
export function Chip({ children, tone = 'plain', on }: { children: ReactNode; tone?: 'plain' | 'warn' | 'down' | 'up' | 'lime'; on?: boolean }) {
  return (
    <span className={cn(
      'inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium',
      on ? 'bg-ops-paper text-ops-ink' :
        tone === 'warn' ? 'bg-[#FFF3D6] text-[#7A5200]' :
          tone === 'down' ? 'bg-[#FFE4E4] text-[#9B1C1C]' :
            tone === 'up' ? 'bg-[#DDF7EA] text-[#0F6B3E]' :
              tone === 'lime' ? 'bg-ops-lime text-ops-ink' : 'bg-[#F0F1F4] text-[#4B5260]',
    )}>{children}</span>
  )
}

/** A small dark tile inside the detail panel, optionally opening more with ↗. */
export function Tile({ label, value, tone, onOpen, children }: { label: string; value: ReactNode; tone?: 'warn' | 'down' | 'ok'; onOpen?: () => void; children?: ReactNode }) {
  return (
    <div className={cn('relative min-h-[104px] rounded-[18px] border p-4', tone === 'down' ? 'border-ops-down/40 bg-ops-down/[0.07]' : tone === 'warn' ? 'border-ops-warn/35 bg-ops-warn/[0.06]' : 'border-ops-line bg-ops-raised/60')}>
      {onOpen && <button type="button" aria-label="详情" onClick={onOpen} className="absolute right-3 top-3 text-ops-muted hover:text-ops-text"><ArrowUpRight className="h-4 w-4" /></button>}
      <div className={cn('text-[20px] leading-tight tabular-nums', tone === 'down' ? 'text-ops-down' : tone === 'warn' ? 'text-ops-warn' : 'text-ops-text')}>{value}</div>
      <div className="mt-2 text-[12px] text-ops-muted">{label}</div>
      {children}
    </div>
  )
}

export function Notice({ kind, children, onClose }: { kind: 'ok' | 'error'; children: ReactNode; onClose?: () => void }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cn('flex items-center gap-3 py-2 text-[13px]', kind === 'error' ? 'text-ops-down' : 'text-ops-up')}>
      <span className="min-w-0 flex-1">{children}</span>
      {onClose && <button type="button" onClick={onClose} aria-label="关闭" className="text-ops-muted hover:text-ops-text"><X className="h-4 w-4" /></button>}
    </div>
  )
}
