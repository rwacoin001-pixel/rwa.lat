'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Send,
  ShieldAlert,
  MessageSquareText,
  Users,
  FileText,
} from 'lucide-react'

type QueueItem = {
  id: string
  kind: string
  state: string
  source: string | null
  scheduledFor: string | null
  reviewNote: string | null
  reviewedBy: string | null
  attempts: number
  createdAt: string
  profile: { displayName?: string; handle?: string } | null
  payload: Record<string, unknown> | null
}

type ReportItem = {
  id: string
  targetType: string
  targetId: string
  reason: string
  state: string
  createdAt: string
}

type Stats = {
  profiles: number
  posts: number
  comments: number
  queuePending: number
  postsLast24h: number
}

const QUEUE_STATES = [
  { value: 'draft', label: '待审核' },
  { value: 'approved', label: '已通过（待发布）' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已驳回' },
  { value: '', label: '全部' },
]

const REPORT_STATES = [
  { value: 'open', label: '待处理' },
  { value: 'reviewed', label: '已处理' },
  { value: 'dismissed', label: '已忽略' },
  { value: '', label: '全部' },
]

const STATE_STYLE: Record<string, string> = {
  draft: 'bg-amber-500/15 text-amber-600',
  approved: 'bg-sky-500/15 text-sky-600',
  published: 'bg-emerald-500/15 text-emerald-600',
  rejected: 'bg-rose-500/15 text-rose-600',
  open: 'bg-amber-500/15 text-amber-600',
  reviewed: 'bg-emerald-500/15 text-emerald-600',
  dismissed: 'bg-slate-400/20 text-slate-500',
}

const STATE_LABEL: Record<string, string> = {
  draft: '待审核',
  approved: '已通过',
  published: '已发布',
  rejected: '已驳回',
  open: '待处理',
  reviewed: '已处理',
  dismissed: '已忽略',
}

function preview(item: QueueItem): string {
  const payload = item.payload ?? {}
  const text = (payload.title as string) || (payload.text as string) || (payload.body as string) || ''
  if (text) return text.slice(0, 140)
  return JSON.stringify(payload).slice(0, 140)
}

function payloadLang(item: QueueItem): string {
  const payload = item.payload ?? {}
  return String(payload.lang ?? payload.language ?? '-')
}

export default function CommunityReviewPage() {
  const [tab, setTab] = useState<'queue' | 'reports'>('queue')
  const [stats, setStats] = useState<Stats | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [queueState, setQueueState] = useState('draft')
  const [reportState, setReportState] = useState('open')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, queueRes, reportRes] = await Promise.all([
        fetch('/api/admin/community/stats', { credentials: 'include' }),
        fetch(`/api/admin/community/queue${queueState ? `?state=${queueState}&limit=200` : '?limit=200'}`, { credentials: 'include' }),
        fetch(`/api/admin/community/reports${reportState ? `?state=${reportState}&limit=200` : '?limit=200'}`, { credentials: 'include' }),
      ])
      if (statsRes.ok) setStats((await statsRes.json()) as Stats)
      if (queueRes.ok) {
        const data = await queueRes.json()
        setQueue(Array.isArray(data?.items) ? data.items : [])
      }
      if (reportRes.ok) {
        const data = await reportRes.json()
        setReports(Array.isArray(data?.items) ? data.items : [])
      }
      if (!queueRes.ok && !reportRes.ok) setError('加载审核数据失败，请检查管理 API 连接。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [queueState, reportState])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const callAction = async (path: string, init?: RequestInit) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(path, { credentials: 'include', ...init })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `操作失败 (HTTP ${res.status})`)
      return body
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
      return null
    } finally {
      setBusy(false)
    }
  }

  const review = async (item: QueueItem, action: 'approve' | 'reject') => {
    let note: string | undefined
    if (action === 'reject') {
      note = window.prompt('驳回原因（可选）：') ?? undefined
    } else if (!window.confirm(`确认通过该内容（${item.kind}）吗？`)) {
      return
    }
    const result = await callAction(`/api/admin/community/queue/${item.id}/review`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...(note ? { note } : {}) }),
    })
    if (result) {
      await fetchAll()
    }
  }

  const publishDue = async () => {
    if (!window.confirm('发布所有已批准且到达计划时间的内容？')) return
    const result = await callAction('/api/admin/community/queue/publish-due', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100 }),
    })
    if (result) {
      window.alert(`发布完成：成功 ${(result as { published?: number }).published ?? 0} 条`)
      await fetchAll()
    }
  }

  const resolveReport = async (report: ReportItem, action: 'reviewed' | 'dismissed') => {
    if (!window.confirm(action === 'reviewed' ? '标记为已处理？' : '忽略该举报？')) return
    const result = await callAction(`/api/admin/community/reports/${report.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (result) await fetchAll()
  }

  const statCards = useMemo(
    () => [
      { label: '活跃人设', value: stats?.profiles ?? '-', icon: Users },
      { label: '已发布帖子', value: stats?.posts ?? '-', icon: MessageSquareText },
      { label: '已发布评论', value: stats?.comments ?? '-', icon: FileText },
      { label: '待审草稿', value: stats?.queuePending ?? '-', icon: ShieldAlert },
      { label: '24h 新帖', value: stats?.postsLast24h ?? '-', icon: RefreshCw },
    ],
    [stats],
  )

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">C1.5 审核台</h1>
            <p className="mt-1 text-muted-foreground">站内社区内容审核 · 队列发布 · 举报处理</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchAll()}
              disabled={loading || busy}
              className="glass-strong flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 刷新
            </button>
            <button
              type="button"
              onClick={() => void publishDue()}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> 发布到期内容
            </button>
          </div>
        </div>

        {error && <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {statCards.map((card) => (
            <Card key={card.label} className="glass-strong">
              <div className="flex items-center gap-3 p-5">
                <div className="rounded-xl bg-white/70 p-2.5">
                  <card.icon className="h-5 w-5 text-mint" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition',
              tab === 'queue' ? 'bg-white shadow-sm ring-1 ring-ink/10' : 'text-muted-foreground hover:bg-white/60',
            )}
          >
            内容队列（{queue.length}）
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition',
              tab === 'reports' ? 'bg-white shadow-sm ring-1 ring-ink/10' : 'text-muted-foreground hover:bg-white/60',
            )}
          >
            举报处理（{reports.filter((r) => r.state === 'open').length} 待处理）
          </button>
        </div>

        {tab === 'queue' && (
          <Card className="glass-strong">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">内容队列</CardTitle>
              <select
                value={queueState}
                onChange={(event) => setQueueState(event.target.value)}
                className="rounded-lg border border-ink/10 bg-white/80 px-3 py-1.5 text-sm"
              >
                {QUEUE_STATES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">类型</th>
                      <th className="px-3 py-2">人设</th>
                      <th className="px-3 py-2">语言</th>
                      <th className="px-3 py-2">内容预览</th>
                      <th className="px-3 py-2">计划时间</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.id} className="border-b border-ink/5 align-top">
                        <td className="px-3 py-2.5">{item.kind === 'comment' ? '评论' : '帖子'}</td>
                        <td className="px-3 py-2.5">
                          {item.profile?.displayName ?? '-'}
                          <div className="text-xs text-muted-foreground">{item.profile?.handle ?? ''}</div>
                        </td>
                        <td className="px-3 py-2.5">{payloadLang(item)}</td>
                        <td className="max-w-md px-3 py-2.5">
                          <div className="line-clamp-2">{preview(item)}</div>
                          {item.reviewNote && <div className="mt-1 text-xs text-muted-foreground">备注：{item.reviewNote}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs">{item.scheduledFor ? new Date(item.scheduledFor).toLocaleString('zh-CN') : '-'}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATE_STYLE[item.state] ?? 'bg-slate-400/20')}>
                            {STATE_LABEL[item.state] ?? item.state}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            {(item.state === 'draft' || item.state === 'approved') && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void review(item, 'approve')}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> 通过
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void review(item, 'reject')}
                                  className="flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> 驳回
                                </button>
                              </>
                            )}
                            {item.state === 'published' && <span className="text-xs text-muted-foreground">已上线</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!queue.length && (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                          {loading ? '加载中…' : '该状态下暂无内容'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'reports' && (
          <Card className="glass-strong">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">举报处理</CardTitle>
              <select
                value={reportState}
                onChange={(event) => setReportState(event.target.value)}
                className="rounded-lg border border-ink/10 bg-white/80 px-3 py-1.5 text-sm"
              >
                {REPORT_STATES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">目标类型</th>
                      <th className="px-3 py-2">目标 ID</th>
                      <th className="px-3 py-2">理由</th>
                      <th className="px-3 py-2">举报时间</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b border-ink/5">
                        <td className="px-3 py-2.5">{report.targetType}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{report.targetId.slice(0, 12)}…</td>
                        <td className="px-3 py-2.5">{report.reason}</td>
                        <td className="px-3 py-2.5 text-xs">{new Date(report.createdAt).toLocaleString('zh-CN')}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATE_STYLE[report.state] ?? 'bg-slate-400/20')}>
                            {STATE_LABEL[report.state] ?? report.state}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {report.state === 'open' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void resolveReport(report, 'reviewed')}
                                className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                已处理
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void resolveReport(report, 'dismissed')}
                                className="rounded-lg bg-slate-400/10 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-400/20 disabled:opacity-50"
                              >
                                忽略
                              </button>
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground">已归档</div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!reports.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                          {loading ? '加载中…' : '该状态下暂无举报'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
