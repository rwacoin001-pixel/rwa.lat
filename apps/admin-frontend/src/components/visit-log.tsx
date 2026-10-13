'use client'

import { useState, type FormEvent } from 'react'
import { type Col, DataTable, Panel, RefreshButton, useApi } from '@/components/console/framework'
import { cn } from '@/lib/utils'

export interface VisitRow {
  id: string
  userId: string | null
  email: string | null
  ip: string
  country: string | null
  device: string
  userAgent: string | null
  firstPage: string | null
  lastPage: string | null
  startedAt: string
  lastSeenAt: string
  durationSeconds: number
  requests: number
}
interface VisitPage { items: VisitRow[]; total: number; page: number; pageSize: number; retentionDays: number; idleMinutes: number }

const PAGE_SIZE = 50
const KINDS = [['all', '全部'], ['user', '已登录'], ['anonymous', '匿名']] as const
const DEVICE: Record<string, string> = { mobile: '手机', desktop: '电脑', tablet: '平板', other: '其他' }
const time = (value: string) => new Date(value).toLocaleString('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})
function duration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes} 分` : `${Math.floor(minutes / 60)} 时 ${minutes % 60} 分`
}

/** Every visit (30-minute inactivity window) with time, IP, place, device, account and pages. */
export function VisitLog({ countryName }: { countryName: (code: string) => string }) {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [day, setDay] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('all')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (q) params.set('q', q)
  if (day) params.set('day', day)
  if (kind !== 'all') params.set('kind', kind)
  const list = useApi<VisitPage>(`/api/admin/console/activity/visits?${params}`)
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filterBy = (value: string) => { setInput(value); setQ(value); setPage(1) }
  const submit = (event: FormEvent) => { event.preventDefault(); setQ(input.trim()); setPage(1) }

  const columns: Col<VisitRow>[] = [
    { key: 'startedAt', label: '访问时间', render: (v) => <span className="whitespace-nowrap tabular-nums">{time(v.startedAt)}</span> },
    { key: 'duration', label: '停留', render: (v) => <span className="whitespace-nowrap text-xs text-text-faint" title={`最后活动 ${time(v.lastSeenAt)}`}>{duration(v.durationSeconds)}</span> },
    { key: 'ip', label: 'IP', render: (v) => <button type="button" className="font-mono text-xs underline-offset-2 hover:underline" title="只看这个 IP" onClick={() => filterBy(v.ip)}>{v.ip}</button> },
    { key: 'country', label: '地区', render: (v) => <span className="whitespace-nowrap text-xs">{v.country ? countryName(v.country) : '未知'}</span> },
    { key: 'device', label: '设备', render: (v) => <span className="whitespace-nowrap text-xs" title={v.userAgent ?? ''}>{DEVICE[v.device] ?? v.device}</span> },
    {
      key: 'account', label: '账户', render: (v) => v.userId
        ? <button type="button" className="max-w-[220px] truncate text-left text-xs underline-offset-2 hover:underline" title="只看这个账户" onClick={() => filterBy(v.email ?? v.userId!)}>{v.email ?? v.userId.slice(0, 8)}</button>
        : <span className="text-xs text-text-faint">匿名</span>,
    },
    { key: 'requests', label: '请求', className: 'text-right', render: (v) => <span className="tabular-nums">{v.requests}</span> },
    { key: 'pages', label: '页面', render: (v) => <span className="whitespace-nowrap text-xs text-text-faint">{v.firstPage ?? '—'}{v.lastPage && v.lastPage !== v.firstPage ? ` → ${v.lastPage}` : ''}</span> },
  ]

  return (
    <Panel title={`访客记录 · ${list.data ? total : '…'}`} subtitle="每一次访问一行：同一访客 30 分钟内的连续操作算一次访问。按北京时间。" actions={<RefreshButton loading={list.loading} onClick={list.reload} />} pad={false}>
      <div className="space-y-4 px-5 pb-5">
        <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
          <input className="h-10 min-w-[220px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-ink/50" aria-label="搜索访客"
            placeholder="IP、IP 段（如 1.2.3.0/24）、完整邮箱或用户 ID" maxLength={200} value={input} onChange={(e) => setInput(e.target.value)} />
          <input type="date" aria-label="日期" className="h-10 rounded-xl border border-ink/15 bg-white px-3 text-sm" value={day} onChange={(e) => { setDay(e.target.value); setPage(1) }} />
          <div role="group" aria-label="访客类型" className="flex rounded-full border border-ink/[0.1] bg-white/60 p-0.5">
            {KINDS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1) }}
                className={cn('h-8 rounded-full px-3 text-sm transition-colors', kind === value ? 'bg-ink text-white' : 'text-text-secondary hover:text-ink')}>{label}</button>
            ))}
          </div>
          <button className="h-10 rounded-xl bg-ink px-5 text-sm text-white" type="submit">搜索</button>
          {(q || day || kind !== 'all') && <button type="button" className="px-2 text-sm" onClick={() => { setInput(''); setQ(''); setDay(''); setKind('all'); setPage(1) }}>清除</button>}
        </form>
        <DataTable columns={columns} rows={list.data?.items ?? []} loading={list.loading} error={list.error} onReload={list.reload} rowKey={(v) => v.id} compact
          emptyHint={q || day || kind !== 'all' ? '没有符合条件的访问记录' : '暂无访问记录（上线后开始记录）'} />
        <div className="flex items-center justify-between text-xs text-text-faint">
          <span>{total > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}` : '0 条'}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40" disabled={list.loading || page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <button type="button" className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40" disabled={list.loading || page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
