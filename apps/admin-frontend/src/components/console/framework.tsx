'use client'

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
 * 管理台数据页框架（列表页共用）：
 * useApi / PageHeader / RefreshButton / Panel / StatusPill /
 * DataTable / FilterTabs / StatChip / EmptyState / ErrorState /
 * PendingModule
 * ───────────────────────────────────────────────────────────── */

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!url) {
      setData(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error((body?.message as string) || `请求失败 (HTTP ${res.status})`)
        return body
      })
      .then((body) => {
        if (alive) setData(body as T)
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : '请求失败')
          setData(null)
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [url, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { data, loading, error, reload }
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function RefreshButton({ loading, onClick, label = '刷新' }: { loading?: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="glass-strong card-lift flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> {label}
    </button>
  )
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  delay = 0,
  pad = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  delay?: number
  pad?: boolean
}) {
  return (
    <section className={cn('glass-strong card-lift animate-rise rounded-card', pad && 'p-5', className)} style={{ animationDelay: `${delay}ms` }}>
      {(title || actions) && (
        <div className={cn('mb-3 flex items-start justify-between gap-3', !pad && 'p-5 pb-0')}>
          <div>
            {typeof title === 'string' ? <h2 className="text-base font-semibold">{title}</h2> : title}
            {subtitle && <p className="mt-0.5 text-xs text-text-faint">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/12 text-emerald-600',
  enabled: 'bg-emerald-500/12 text-emerald-600',
  approved: 'bg-emerald-500/12 text-emerald-600',
  credited: 'bg-emerald-500/12 text-emerald-600',
  filled: 'bg-emerald-500/12 text-emerald-600',
  completed: 'bg-emerald-500/12 text-emerald-600',
  matched: 'bg-emerald-500/12 text-emerald-600',
  clean: 'bg-emerald-500/12 text-emerald-600',
  verified: 'bg-emerald-500/12 text-emerald-600',
  resolved: 'bg-emerald-500/12 text-emerald-600',
  published: 'bg-emerald-500/12 text-emerald-600',
  open: 'bg-sky-500/12 text-sky-600',
  running: 'bg-sky-500/12 text-sky-600',
  processing: 'bg-sky-500/12 text-sky-600',
  in_progress: 'bg-sky-500/12 text-sky-600',
  pilot: 'bg-sky-500/12 text-sky-600',
  submitted: 'bg-amber-500/12 text-amber-600',
  requested: 'bg-amber-500/12 text-amber-600',
  pending: 'bg-amber-500/12 text-amber-600',
  reviewing: 'bg-amber-500/12 text-amber-600',
  partially_filled: 'bg-amber-500/12 text-amber-600',
  planned: 'bg-amber-500/12 text-amber-600',
  draft: 'bg-ink/[0.06] text-text-secondary',
  not_started: 'bg-ink/[0.06] text-text-secondary',
  closed: 'bg-ink/[0.06] text-text-secondary',
  retired: 'bg-ink/[0.06] text-text-secondary',
  cancelled: 'bg-ink/[0.06] text-text-secondary',
  disabled: 'bg-ink/[0.06] text-text-secondary',
  rejected: 'bg-rose-500/12 text-rose-600',
  failed: 'bg-rose-500/12 text-rose-600',
  quarantined: 'bg-rose-500/12 text-rose-600',
  differences_found: 'bg-rose-500/12 text-rose-600',
  expired: 'bg-rose-500/12 text-rose-600',
  blocked: 'bg-rose-500/12 text-rose-600',
}

const STATUS_LABELS: Record<string, string> = {
  active: '生效中',
  approved: '已通过',
  rejected: '已驳回',
  requested: '待审批',
  pending: '待处理',
  submitted: '已提交',
  filled: '已成交',
  partially_filled: '部分成交',
  failed: '失败',
  cancelled: '已取消',
  completed: '已完成',
  credited: '已入账',
  matched: '一致',
  differences_found: '有差异',
  resolved: '已解决',
  closed: '已关闭',
  open: '进行中',
  running: '运行中',
  processing: '处理中',
  planned: '已计划',
  draft: '草稿',
  not_started: '未开始',
  reviewing: '审核中',
  disabled: '已停用',
  pilot: '试运行',
  expired: '已过期',
  quarantined: '已隔离',
  clean: '已扫描',
  verified: '已验证',
  published: '已发布',
  retired: '已退役',
  blocked: '已阻断',
}

export function StatusPill({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-xs text-text-faint">—</span>
  return (
    <span className={cn('pill', STATUS_STYLES[value] ?? 'bg-ink/[0.06] text-text-secondary', className)}>
      {STATUS_LABELS[value] ?? value}
    </span>
  )
}

export function EmptyState({ hint = '暂无数据', icon: Icon = Inbox }: { hint?: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-faint">
      <Icon className="h-8 w-8 opacity-50" />
      <p className="text-sm">{hint}</p>
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
      <span className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">{error}</span>
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 rounded-lg bg-white/70 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-white">
          重试
        </button>
      )}
    </div>
  )
}

export type Col<T> = {
  key: string
  label: ReactNode
  className?: string
  render?: (row: T, index: number) => ReactNode
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  error,
  onReload,
  emptyHint,
  rowKey,
  compact,
}: {
  columns: Col<T>[]
  rows: T[] | null
  loading?: boolean
  error?: string
  onReload?: () => void
  emptyHint?: ReactNode
  rowKey?: (row: T, index: number) => string
  compact?: boolean
}) {
  if (error) return <ErrorState error={error} onRetry={onReload} />
  const cellPad = compact ? 'px-3 py-2' : 'px-3 py-2.5'
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-left text-xs text-text-faint">
            {columns.map((col) => (
              <th key={col.key} className={cn(cellPad, 'font-medium', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-12 text-center text-sm text-text-faint">
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> 加载中…
                </span>
              </td>
            </tr>
          )}
          {!loading &&
            (rows ?? []).map((row, index) => (
              <tr key={rowKey ? rowKey(row, index) : (row.id ?? index)} className="border-b border-ink/5 transition-colors hover:bg-ink/[0.03]">
                {columns.map((col) => (
                  <td key={col.key} className={cn(cellPad, 'align-top', col.className)}>
                    {col.render ? col.render(row, index) : (row[col.key] as ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          {!loading && (!rows || rows.length === 0) && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState hint={emptyHint} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function FilterTabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-xl px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
            value === option.value ? 'bg-white text-ink shadow-sm ring-1 ring-ink/10' : 'text-text-secondary hover:bg-white/60 hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StatChip({
  label,
  value,
  sub,
  className,
  delay = 0,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div className={cn('animate-rise rounded-2xl bg-ink/[0.03] px-4 py-3.5', className)} style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs text-text-faint">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-text-faint">{sub}</p>}
    </div>
  )
}

export function PendingModule({
  title,
  subtitle,
  points,
  actions,
}: {
  title: string
  subtitle?: string
  points?: string[]
  actions?: ReactNode
}) {
  return (
    <div className="animate-rise glass-strong rounded-card p-8">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/12">
          <Inbox className="h-6 w-6 text-mint" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        {points && points.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-left text-[13px] text-text-secondary">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                {point}
              </li>
            ))}
          </ul>
        )}
        {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(value)
  }
}

export function shortId(value: string | null | undefined, length = 8): string {
  if (!value) return '—'
  return value.length > length ? `${value.slice(0, length)}…` : value
}
