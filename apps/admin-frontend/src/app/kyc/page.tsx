'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import KycReview from '@/components/kyc-review'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type KycCase = {
  id: string
  userId: string
  state: string
  provider: string
  reasonCode: string | null
  submittedAt: string | null
  decidedAt: string | null
  expiresAt: string | null
  createdAt: string
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'submitted', label: '已提交' },
  { value: 'expired', label: '已过期' },
]

export default function KycPage() {
  const [state, setState] = useState('')
  const [selected, setSelected] = useState<KycCase | null>(null)
  const kyc = useApi<KycCase[]>(`/api/admin/console/kyc${state ? `?state=${state}&limit=200` : '?limit=200'}`)
  const rows = kyc.data ?? []
  // 加载中显示 …，失败显示 —，加载完成后（含 0）显示真实数值
  const count = (value: number) => (kyc.loading ? '…' : kyc.error ? '—' : value)

  const columns: Col<KycCase>[] = [
    { key: 'id', label: '档案号', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs">{shortId(row.userId, 12)}</span> },
    { key: 'provider', label: '认证服务商', render: (row) => <span className="pill bg-ink/[0.06] text-text-secondary">{row.provider}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'reasonCode', label: '理由码', render: (row) => <span className="text-xs text-text-faint">{row.reasonCode ?? '—'}</span> },
    { key: 'submittedAt', label: '提交时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.submittedAt ?? row.createdAt)}</span> },
    { key: 'decidedAt', label: '决定时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.decidedAt)}</span> },
    { key: 'expiresAt', label: '过期时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.expiresAt)}</span> },
    { key: 'review', label: '核验', render: (row) => <button type="button" className="text-xs underline" onClick={() => setSelected(row)}>查看记录</button> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="KYC 审核"
          subtitle="身份核验与人工复核"
          actions={<RefreshButton loading={kyc.loading} onClick={kyc.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="档案总数" value={count(rows.length)} delay={40} />
          <StatChip label="已通过" value={count(rows.filter((row) => row.state === 'approved').length)} delay={90} />
          <StatChip label="已驳回" value={count(rows.filter((row) => row.state === 'rejected').length)} delay={140} />
          <StatChip label="待处理" value={count(rows.filter((row) => !['approved', 'rejected', 'expired', 'not_started'].includes(row.state)).length)} delay={190} />
        </div>

        <Panel title={`认证档案（${count(rows.length)}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={kyc.data} loading={kyc.loading} error={kyc.error} onReload={kyc.reload} emptyHint="暂无 KYC 档案" />
          </div>
        </Panel>

        {selected && <KycReview key={selected.id} id={selected.id} state={selected.state} onClose={() => setSelected(null)} onDone={() => { setSelected(null); kyc.reload() }} />}
      </div>
    </AdminLayout>
  )
}
