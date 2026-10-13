'use client'

import { useState, type FormEvent } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { adminApi } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { Loader2, PlusCircle } from 'lucide-react'

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

const FIELD = 'w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm'
const EMPTY_FORM = { action: '', objectType: '', objectId: '', payload: '' }

function parsePayload(text: string): Record<string, unknown> | undefined {
  if (!text.trim()) return undefined
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('附加数据必须是合法的 JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('附加数据必须是 JSON 对象，例如 {"amount": "100"}')
  return value as Record<string, unknown>
}

export default function ApprovalsPage() {
  const [state, setState] = useState('requested')
  const [notice, setNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deciding, setDeciding] = useState<{ row: Approval; approve: boolean } | null>(null)
  const [reasonCode, setReasonCode] = useState('')
  const approvals = useApi<Approval[]>(`/api/admin/approvals${state ? `?state=${state}` : ''}`)

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 7000)
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setCreateOpen(true)
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (creating) return
    const action = form.action.trim()
    const objectType = form.objectType.trim()
    if (!action || !objectType) {
      setFormError('请填写动作名与对象类型')
      return
    }
    setCreating(true)
    setFormError('')
    try {
      const payload = parsePayload(form.payload)
      await adminApi.createApproval({ action, objectType, objectId: form.objectId.trim() || undefined, payload })
      setCreateOpen(false)
      showNotice('审批请求已创建，请核对后批准')
      approvals.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const openDecide = (row: Approval, approve: boolean) => {
    setReasonCode('')
    setDeciding({ row, approve })
  }

  // 失败时抛出，由 ConfirmDialog 保持打开并显示错误
  const decide = async () => {
    if (!deciding) return
    await adminApi.decideApproval(deciding.row.id, deciding.approve, reasonCode.trim() || undefined)
    showNotice(deciding.approve ? '已通过' : '已驳回')
    approvals.reload()
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
              onClick={() => openDecide(row, true)}
              className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              通过
            </button>
            <button
              type="button"
              onClick={() => openDecide(row, false)}
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
          subtitle="有权限的管理员核对后批准，操作全程留档"
          actions={
            <>
              <button
                type="button"
                onClick={openCreate}
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

        <Dialog open={createOpen} onOpenChange={(open) => { if (!creating) setCreateOpen(open) }}>
          <DialogContent>
            <form onSubmit={(event) => void create(event)} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>新建审批</DialogTitle>
                <DialogDescription>创建后进入「待审批」，由有权限的管理员核对后批准或驳回。</DialogDescription>
              </DialogHeader>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">动作名 *</span>
                <input required autoFocus value={form.action} onChange={(event) => setForm((prev) => ({ ...prev, action: event.target.value }))} placeholder="treasury.address.add" className={cn(FIELD, 'font-mono')} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">对象类型 *</span>
                <input required value={form.objectType} onChange={(event) => setForm((prev) => ({ ...prev, objectType: event.target.value }))} placeholder="wallet_treasury_address" className={cn(FIELD, 'font-mono')} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">对象 ID（可选）</span>
                <input value={form.objectId} onChange={(event) => setForm((prev) => ({ ...prev, objectId: event.target.value }))} className={cn(FIELD, 'font-mono')} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">附加数据（可选，JSON 对象）</span>
                <textarea rows={4} value={form.payload} onChange={(event) => setForm((prev) => ({ ...prev, payload: event.target.value }))} placeholder='{"reason": "…"}' className={cn(FIELD, 'font-mono')} />
              </label>
              {formError && <p role="alert" className="text-sm text-negative">{formError}</p>}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>取消</Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  创建
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(deciding)}
          onOpenChange={(open) => { if (!open) setDeciding(null) }}
          title={deciding?.approve ? '批准审批请求' : '驳回审批请求'}
          description={deciding?.approve ? '批准后将记录决策人并写入审计日志。' : '驳回后该请求不可再批准。'}
          details={deciding ? [
            { label: '事项', value: deciding.row.action, mono: true },
            { label: '对象', value: `${deciding.row.objectType}${deciding.row.objectId ? ` · ${deciding.row.objectId}` : ''}`, mono: true },
            { label: '请求人', value: deciding.row.requestedBy, mono: true },
          ] : []}
          confirmLabel={deciding?.approve ? '确认通过' : '确认驳回'}
          destructive={!deciding?.approve}
          onConfirm={decide}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">{deciding?.approve ? '备注（可选）' : '驳回理由（可选）'}</span>
            <input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className={FIELD} />
          </label>
        </ConfirmDialog>
      </div>
    </AdminLayout>
  )
}
