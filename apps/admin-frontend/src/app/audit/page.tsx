'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, formatDateTime, shortId, useApi } from '@/components/console/framework'

type AuditRow = {
  id: string
  occurredAt: string
  actorType: string
  actorId: string | null
  userId: string | null
  action: string
  objectType: string
  objectId: string | null
  requestId: string
  reasonCode: string | null
  metadata: Record<string, unknown>
}

const ACTOR_TABS = [
  { value: '', label: '全部' },
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '用户' },
  { value: 'service', label: '服务' },
  { value: 'partner', label: '合作方' },
]

export default function AuditPage() {
  const [actorType, setActorType] = useState('')
  const [action, setAction] = useState('')
  const [actionInput, setActionInput] = useState('')

  const query = new URLSearchParams({ limit: '200' })
  if (actorType) query.set('actorType', actorType)
  if (action) query.set('action', action)
  const audit = useApi<AuditRow[]>(`/api/admin/audit?${query.toString()}`)

  const columns: Col<AuditRow>[] = [
    { key: 'occurredAt', label: '时间', render: (row) => <span className="whitespace-nowrap text-xs text-text-faint">{formatDateTime(row.occurredAt)}</span> },
    { key: 'action', label: '操作', render: (row) => <span className="font-mono text-xs font-medium">{row.action}</span> },
    {
      key: 'object',
      label: '对象',
      render: (row) => (
        <span className="text-xs">
          <span className="font-medium">{row.objectType}</span>
          {row.objectId && <span className="ml-1.5 font-mono text-text-faint">{shortId(row.objectId, 12)}</span>}
        </span>
      ),
    },
    {
      key: 'actor',
      label: '操作者',
      render: (row) => (
        <span className="text-xs">
          <span className="pill bg-ink/[0.06] text-text-secondary">{row.actorType}</span>
          {row.actorId && <span className="ml-1.5 font-mono text-text-faint">{shortId(row.actorId, 10)}</span>}
        </span>
      ),
    },
    { key: 'requestId', label: '请求号', render: (row) => <span className="font-mono text-[11px] text-text-faint">{shortId(row.requestId, 10)}</span> },
    { key: 'reasonCode', label: '理由码', render: (row) => <span className="text-xs text-text-faint">{row.reasonCode ?? '—'}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="审计日志"
          subtitle="不可变审计流水（append-only）：管理员、用户与服务的关键动作全程留痕，可按操作者类型与操作名筛选"
          actions={<RefreshButton loading={audit.loading} onClick={audit.reload} />}
        />

        <Panel
          title={`记录（最近 ${audit.data?.length ?? 0} 条）`}
          actions={
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setAction(actionInput.trim())
              }}
              className="flex items-center gap-2"
            >
              <input
                value={actionInput}
                onChange={(event) => setActionInput(event.target.value)}
                placeholder="操作名（如 admin.session.login）"
                className="w-56 rounded-xl border border-ink/10 bg-white/80 px-3 py-1.5 text-[13px] shadow-sm"
              />
              <button type="submit" className="rounded-xl bg-white px-3 py-1.5 text-[13px] font-medium ring-1 ring-ink/10 hover:bg-ink/5">
                筛选
              </button>
              <FilterTabs options={ACTOR_TABS} value={actorType} onChange={setActorType} />
            </form>
          }
          delay={40}
          pad={false}
        >
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={audit.data ?? null} loading={audit.loading} error={audit.error} onReload={audit.reload} emptyHint="暂无审计记录" compact />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
