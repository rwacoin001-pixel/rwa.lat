'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { RotateCcw } from 'lucide-react'

type JobRow = {
  id: string
  queueName?: string
  queue_name?: string
  state: string
  attempts?: number
  maxAttempts?: number
  max_attempts?: number
  lastError?: string | null
  last_error?: string | null
  createdAt?: string
  created_at?: string
  runAt?: string
  completedAt?: string | null
}

type CallbackRow = {
  id: string
  provider?: string
  kind?: string
  state?: string
  receivedAt?: string
  processedAt?: string | null
}

const STATE_TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '等待中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'dead', label: '死信' },
]

const VIEW_TABS = [
  { value: 'jobs', label: '作业' },
  { value: 'dead', label: '死信队列' },
  { value: 'callbacks', label: '未处理回调' },
]

export default function JobQueuePage() {
  const [view, setView] = useState('jobs')
  const [queueName, setQueueName] = useState('rwa-market-sync')
  const [queueInput, setQueueInput] = useState('rwa-market-sync')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  const jobsUrl =
    view === 'jobs'
      ? `/api/admin/job-queue/jobs?queueName=${encodeURIComponent(queueName)}${state ? `&state=${state}` : ''}&limit=100`
      : view === 'dead'
        ? `/api/admin/job-queue/jobs/dead?queueName=${encodeURIComponent(queueName)}&limit=100`
        : `/api/admin/job-queue/callbacks/unprocessed?limit=100`
  const list = useApi<JobRow[] | CallbackRow[]>(jobsUrl)

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 7000)
  }

  const replay = async (row: JobRow) => {
    if (!window.confirm('重放该作业？（重置为 pending 并清零失败计数）')) return
    setBusy(row.id)
    try {
      const res = await fetch(`/api/admin/job-queue/jobs/${row.id}/replay`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `重放失败 (HTTP ${res.status})`)
      showNotice('作业已重置为 pending，等待 worker 领取')
      list.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '重放失败')
    } finally {
      setBusy('')
    }
  }

  const jobColumns: Col<JobRow>[] = [
    { key: 'id', label: '作业 ID', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 14)}</span> },
    { key: 'queue', label: '队列', render: (row) => <span className="text-xs">{row.queueName ?? row.queue_name ?? '—'}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    {
      key: 'attempts',
      label: '尝试',
      render: (row) => (
        <span className="tabular-nums text-xs">
          {row.attempts ?? 0} / {row.maxAttempts ?? row.max_attempts ?? '—'}
        </span>
      ),
    },
    { key: 'error', label: '最近错误', render: (row) => <span className="block max-w-[360px] truncate text-xs text-rose-600">{row.lastError ?? row.last_error ?? '—'}</span> },
    { key: 'createdAt', label: '创建时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.createdAt ?? row.created_at)}</span> },
    {
      key: 'ops',
      label: '',
      className: 'text-right',
      render: (row) =>
        row.state === 'dead' ? (
          <button
            type="button"
            disabled={busy === row.id}
            onClick={() => void replay(row)}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-500/20 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> 重放
          </button>
        ) : null,
    },
  ]

  const callbackColumns: Col<CallbackRow>[] = [
    { key: 'id', label: '回调 ID', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 14)}</span> },
    { key: 'provider', label: '来源', render: (row) => <span className="text-sm">{row.provider ?? '—'}</span> },
    { key: 'kind', label: '类型', render: (row) => <span className="text-xs">{row.kind ?? '—'}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state ?? 'pending'} /> },
    { key: 'receivedAt', label: '接收时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.receivedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="作业队列"
          subtitle="后台任务队列（同步/分析/调仓等）：作业状态、死信重放与未处理回调"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <Panel
          title={`队列视图`}
          subtitle="常用队列：rwa-market-sync（行情同步）· basket-ops（组合运营）· withdrawal-execution（提现执行）"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <FilterTabs options={VIEW_TABS} value={view} onChange={setView} />
              {view !== 'callbacks' && (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      setQueueName(queueInput.trim() || 'rwa-market-sync')
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      value={queueInput}
                      onChange={(event) => setQueueInput(event.target.value)}
                      placeholder="队列名"
                      className="w-40 rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[13px] shadow-sm"
                    />
                    <button type="submit" className="rounded-xl bg-white px-3 py-1.5 text-[13px] font-medium ring-1 ring-ink/10 hover:bg-ink/5">
                      切换
                    </button>
                  </form>
                  {view === 'jobs' && <FilterTabs options={STATE_TABS} value={state} onChange={setState} />}
                </>
              )}
            </div>
          }
          delay={40}
          pad={false}
        >
          <div className="px-5 pb-5">
            {view === 'callbacks' ? (
              <DataTable columns={callbackColumns} rows={(list.data as CallbackRow[]) ?? null} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="没有未处理的回调" />
            ) : (
              <DataTable
                columns={jobColumns}
                rows={(list.data as JobRow[]) ?? null}
                loading={list.loading}
                error={list.error}
                onReload={list.reload}
                emptyHint={view === 'dead' ? '死信队列为空 — 恭喜，没有卡住的作业' : '该队列暂无作业'}
              />
            )}
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
