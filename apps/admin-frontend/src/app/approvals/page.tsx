'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { PlusCircle } from 'lucide-react'

type Approval = {
  id: string
  action: string
  objectType: string
  objectId: string | null
  payloadJson: Record<string, unknown>
  state: string
  requestedBy: string
  approvedBy: string | null
  decidedAt: string | null
  reasonCode: string | null
  createdAt: string
}

const STATE_TABS = [
  { value: '', label: '全部' },
  { value: 'requested', label: '待审批' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]

export default function ApprovalsPage() {
  const [state, setState] = useState('requested')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const approvals = useApi<Approval[]>(`/api/admin/approvals${state ? `?state=${state}` : ''}`)

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 7000)
  }

  const create = async () => {
    const action = window.prompt('审批事项动作名（如 treasury.address.add）：')
    if (!action) return
    const objectType = window.prompt('对象类型（如 wallet_treasury_address）：')
    if (!objectType) return
    const objectId = window.prompt('对象 ID（可选）：') || undefined
    setBusy('create')
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, objectType, objectId, payload: {} }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `创建失败 (HTTP ${res.status})`)
      showNotice('审批请求已创建（需由另一位管理员通过）')
      approvals.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '创建失败')
    } finally {
      setBusy('')
    }
  }

  const decide = async (row: Approval, approve: boolean) => {
    const reasonCode = window.prompt(approve ? '通过备注（可选）' : '驳回理由（可选）', '') ?? ''
    setBusy(row.id)
    try {
      const res = await fetch(`/api/admin/approvals/${row.id}/${approve ? 'decide' : 'reject'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reasonCode: reasonCode || undefined }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `操作失败 (HTTP ${res.status})`)
      showNotice(approve ? '已通过' : '已驳回')
      approvals.reload()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy('')
    }
  }

  const columns: Col<Approval>[] = [
    {
      key: 'action',
      label: '事项',
      render: (row) => (
        <span>
          <span className="font-mono text-xs font-medium">{row.action}</span>
          <span className="block text-xs text-text-faint">
            {row.objectType}
            {row.objectId ? ` · ${shortId(row.objectId, 12)}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    {
      key: 'people',
      label: '请求 → 决策',
      render: (row) => (
        <span className="text-xs text-text-faint">
          {shortId(row.requestedBy)}
          {row.approvedBy ? ` → ${shortId(row.approvedBy)}` : ' → —'}
        </span>
      ),
    },
    { key: 'reasonCode', label: '备注', render: (row) => <span className="text-xs text-text-faint">{row.reasonCode ?? '—'}</span> },
    { key: 'decidedAt', label: '时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.decidedAt ?? row.createdAt)}</span> },
    {
      key: 'ops',
      label: '',
      className: 'text-right',
      render: (row) =>
        row.state === 'requested' ? (
          <span className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => void decide(row, true)}
              className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              通过
            </button>
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => void decide(row, false)}
              className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-500/20 disabled:opacity-50"
            >
              驳回
            </button>
          </span>
        ) : null,
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="审批中心"
          subtitle="管理员双人复核队列：关键动作需由另一位管理员通过（请求人与审批人不可相同）"
          actions={
            <>
              <button
                type="button"
                disabled={busy === 'create'}
                onClick={() => void create()}
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110 disabled:opacity-60"
              >
                <PlusCircle className="h-4 w-4" /> 新建审批
              </button>
              <RefreshButton loading={approvals.loading} onClick={approvals.reload} />
            </>
          }
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <Panel title={`审批队列（${approvals.data?.length ?? 0}）`} actions={<FilterTabs options={STATE_TABS} value={state} onChange={setState} />} delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable
              columns={columns}
              rows={approvals.data ?? null}
              loading={approvals.loading}
              error={approvals.error}
              onReload={approvals.reload}
              emptyHint="当前筛选下暂无审批请求"
            />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
