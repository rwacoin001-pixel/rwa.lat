'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { ConfirmDialog } from '@/components/confirm-dialog'

type ReconRun = {
  id: string
  provider: string
  network: string | null
  assetCode: string
  expectedAtomicBalance: string
  observedAtomicBalance: string
  differenceAtomicAmount: string
  state: string
  sourceReference: string | null
  createdAt: string
  completedAt: string | null
  cases: Array<Record<string, unknown>>
}

type Adjustment = {
  id: string
  side: string
  atomicAmount: string
  reasonCode: string
  state: string
  requestedBy: string
  approvedBy: string | null
  requestedAt: string
  postedAt: string | null
  ownerType: string
  userId: string | null
  ownerReference: string | null
  purpose: string
  assetCode: string
}

const ACTION_COPY = {
  approve: { title: '通过调整单', description: '通过后等待过账。', confirm: '确认通过' },
  reject: { title: '驳回调整单', description: '驳回后该调整单不可再过账。', confirm: '确认驳回' },
  post: { title: '过账调整单', description: '将通过不可变账本写入一笔记账分录，过账后不可撤销。', confirm: '确认过账' },
} as const

const FIELD = 'w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm'

const RECON_TABS = [
  { value: '', label: '全部' },
  { value: 'matched', label: '一致' },
  { value: 'differences_found', label: '有差异' },
  { value: 'failed', label: '失败' },
]

const ADJ_TABS = [
  { value: '', label: '全部' },
  { value: 'requested', label: '待审批' },
  { value: 'approved', label: '已通过' },
  { value: 'posted', label: '已过账' },
  { value: 'rejected', label: '已驳回' },
]

export default function LedgerPage() {
  const [reconState, setReconState] = useState('')
  const [adjState, setAdjState] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<{ row: Adjustment; action: 'approve' | 'reject' | 'post' } | null>(null)
  const [reason, setReason] = useState('')

  const recon = useApi<{ runs: ReconRun[] }>(`/api/admin/ledger/reconciliations${reconState ? `?state=${reconState}` : ''}`)
  const adjustments = useApi<{ adjustments: Adjustment[] }>(`/api/admin/ledger/adjustments${adjState ? `?state=${adjState}` : ''}`)

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 6000)
  }

  const openAct = (row: Adjustment, action: 'approve' | 'reject' | 'post') => {
    setReason('')
    setPending({ row, action })
  }

  // 失败时抛出，由 ConfirmDialog 保持打开并显示错误
  const act = async (row: Adjustment, action: 'approve' | 'reject' | 'post') => {
    if (action === 'reject' && !reason) throw new Error('请填写驳回理由')
    setBusy(row.id)
    try {
      const res = await fetch(`/api/admin/ledger/adjustments/${row.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'post' ? {} : { reason: reason || undefined }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `操作失败 (HTTP ${res.status})`)
      showNotice(action === 'approve' ? '已通过（等待过账）' : action === 'reject' ? '已驳回' : '已过账（写入账本）')
      await adjustments.reload()
    } finally {
      setBusy('')
    }
  }

  const reconColumns: Col<ReconRun>[] = [
    { key: 'provider', label: '来源', render: (row) => <span className="font-medium">{row.provider}</span> },
    {
      key: 'asset',
      label: '资产',
      render: (row) => (
        <span>
          <span className="font-mono text-xs">{row.assetCode}</span>
          {row.network && <span className="ml-1.5 text-xs text-text-faint">{row.network}</span>}
        </span>
      ),
    },
    { key: 'expected', label: '账本余额（原子）', render: (row) => <span className="tabular-nums">{row.expectedAtomicBalance}</span> },
    { key: 'observed', label: '托管观测（原子）', render: (row) => <span className="tabular-nums">{row.observedAtomicBalance}</span> },
    {
      key: 'diff',
      label: '差异',
      render: (row) => (
        <span className={row.differenceAtomicAmount === '0' ? 'tabular-nums text-text-faint' : 'tabular-nums font-medium text-rose-600'}>{row.differenceAtomicAmount}</span>
      ),
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'cases', label: '差异单', render: (row) => <span className="text-xs text-text-faint">{row.cases.length ? `${row.cases.length} 个` : '—'}</span> },
    { key: 'completedAt', label: '完成时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.completedAt)}</span> },
  ]

  const adjColumns: Col<Adjustment>[] = [
    {
      key: 'account',
      label: '目标账户',
      render: (row) => (
        <span>
          <span className="font-medium">{row.purpose}</span>
          <span className="ml-1.5 text-xs text-text-faint">
            {row.ownerType === 'user' ? `用户 ${shortId(row.userId)}` : row.ownerReference || row.ownerType}
          </span>
          <span className="ml-1.5 font-mono text-xs text-text-faint">{row.assetCode}</span>
        </span>
      ),
    },
    {
      key: 'amount',
      label: '方向 / 金额（原子）',
      render: (row) => (
        <span className={row.side === 'credit' ? 'tabular-nums text-emerald-600' : 'tabular-nums text-amber-600'}>
          {row.side === 'credit' ? '+' : '−'} {row.atomicAmount}
        </span>
      ),
    },
    { key: 'reasonCode', label: '理由', render: (row) => <span className="text-xs">{row.reasonCode}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    {
      key: 'requestedBy',
      label: '请求 / 决策',
      render: (row) => (
        <span className="text-xs text-text-faint">
          {shortId(row.requestedBy)}
          {row.approvedBy ? ` → ${shortId(row.approvedBy)}` : ''}
        </span>
      ),
    },
    { key: 'requestedAt', label: '时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.requestedAt)}</span> },
    {
      key: 'actions',
      label: '操作',
      className: 'text-right',
      render: (row) => (
        <span className="flex items-center justify-end gap-1.5">
          {row.state === 'requested' && (
            <>
              <button
                type="button"
                disabled={busy === row.id}
                onClick={() => openAct(row, 'approve')}
                className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                通过
              </button>
              <button
                type="button"
                disabled={busy === row.id}
                onClick={() => openAct(row, 'reject')}
                className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-500/20 disabled:opacity-50"
              >
                驳回
              </button>
            </>
          )}
          {row.state === 'approved' && (
            <button
              type="button"
              disabled={busy === row.id}
              onClick={() => openAct(row, 'post')}
              className="rounded-lg bg-mint/10 px-2.5 py-1 text-xs font-medium text-mint hover:bg-mint/20 disabled:opacity-50"
            >
              过账
            </button>
          )}
        </span>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="账本明细"
          subtitle="托管对账与账本调整；批准后过账，保留完整流水"
          actions={<RefreshButton loading={recon.loading || adjustments.loading} onClick={() => { recon.reload(); adjustments.reload() }} />}
        />

        {notice && <div className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <Panel title={`托管对账（${recon.data?.runs?.length ?? 0}）`} subtitle="现金余额对照：账本期望 vs 托管地址观测" actions={<FilterTabs options={RECON_TABS} value={reconState} onChange={setReconState} />} delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={reconColumns} rows={recon.data?.runs ?? null} loading={recon.loading} error={recon.error} onReload={recon.reload} emptyHint="暂无对账记录 — 由资金运营侧定时登记" />
          </div>
        </Panel>

        <Panel
          title={`调整单（${adjustments.data?.adjustments?.length ?? 0}）`}
          subtitle="申请 → 批准 → 过账；同一授权管理员可完成，操作全程留档"
          actions={<FilterTabs options={ADJ_TABS} value={adjState} onChange={setAdjState} />}
          delay={90}
          pad={false}
        >
          <div className="px-5 pb-5">
            <DataTable
              columns={adjColumns}
              rows={adjustments.data?.adjustments ?? null}
              loading={adjustments.loading}
              error={adjustments.error}
              onReload={adjustments.reload}
              emptyHint="暂无调整单"
            />
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null) }}
        title={pending ? ACTION_COPY[pending.action].title : ''}
        description={pending ? ACTION_COPY[pending.action].description : undefined}
        details={pending ? [
          { label: '调整单', value: pending.row.id, mono: true },
          { label: '目标账户', value: `${pending.row.purpose} · ${pending.row.ownerType === 'user' ? `用户 ${pending.row.userId ?? '—'}` : pending.row.ownerReference || pending.row.ownerType}`, mono: true },
          { label: '资产', value: pending.row.assetCode, mono: true },
          { label: '方向 / 金额', value: `${pending.row.side === 'credit' ? '+ 入账' : '− 出账'} ${pending.row.atomicAmount}（原子）`, emphasis: true },
          { label: '申请理由', value: pending.row.reasonCode },
          { label: '申请人', value: pending.row.requestedBy, mono: true },
        ] : []}
        typeToConfirm={pending && pending.action !== 'reject' ? pending.row.atomicAmount : undefined}
        typeToConfirmLabel={pending && pending.action !== 'reject' ? '请输入原子金额以确认' : undefined}
        confirmLabel={pending ? ACTION_COPY[pending.action].confirm : '确认'}
        destructive={pending?.action !== 'approve'}
        confirmDisabled={pending?.action === 'reject' && !reason}
        onConfirm={async () => { if (pending) await act(pending.row, pending.action) }}
      >
        {pending && pending.action !== 'post' && (
          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">{pending.action === 'approve' ? '通过理由（可选）' : '驳回理由（必填）'}</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={FIELD} />
          </label>
        )}
      </ConfirmDialog>
    </AdminLayout>
  )
}
