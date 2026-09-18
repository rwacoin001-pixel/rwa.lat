'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
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
  const kyc = useApi<KycCase[]>(`/api/admin/console/kyc${state ? `?state=${state}&limit=200` : '?limit=200'}`)
  const rows = kyc.data ?? []

  const columns: Col<KycCase>[] = [
    { key: 'id', label: '档案号', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs">{shortId(row.userId, 12)}</span> },
    { key: 'provider', label: '认证服务商', render: (row) => <span className="pill bg-ink/[0.06] text-text-secondary">{row.provider}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'reasonCode', label: '理由码', render: (row) => <span className="text-xs text-text-faint">{row.reasonCode ?? '—'}</span> },
    { key: 'submittedAt', label: '提交时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.submittedAt ?? row.createdAt)}</span> },
    { key: 'decidedAt', label: '决定时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.decidedAt)}</span> },
    { key: 'expiresAt', label: '过期时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.expiresAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="KYC 审核"
          subtitle="身份认证档案（Didit 服务商回调写入）— 审核决策在认证服务商与合规流程中执行"
          actions={<RefreshButton loading={kyc.loading} onClick={kyc.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="档案总数" value={rows.length || '…'} delay={40} />
          <StatChip label="已通过" value={rows.filter((row) => row.state === 'approved').length} delay={90} />
          <StatChip label="已驳回" value={rows.filter((row) => row.state === 'rejected').length} delay={140} />
          <StatChip label="待处理" value={rows.filter((row) => !['approved', 'rejected', 'expired', 'not_started'].includes(row.state)).length} delay={190} />
        </div>

        <Panel title={`认证档案（${rows.length}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={kyc.data} loading={kyc.loading} error={kyc.error} onReload={kyc.reload} emptyHint="暂无 KYC 档案" />
          </div>
        </Panel>

        <Panel title="流程说明" delay={260}>
          <ul className="space-y-1.5 text-[13px] text-text-secondary">
            <li className="flex items-start gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />用户在前台发起认证 → 跳转 Didit 托管页 → 回调写入本档案（提交/通过/驳回/过期）</li>
            <li className="flex items-start gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />档案中的证件信息加密存储（数据库仅保存哈希与密文），本页不展示任何个人敏感信息</li>
            <li className="flex items-start gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />驳回后的复核与申诉入口由合规流程处理；认证服务商处可查看完整审核记录</li>
          </ul>
        </Panel>
      </div>
    </AdminLayout>
  )
}
