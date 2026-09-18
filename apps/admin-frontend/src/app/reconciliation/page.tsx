'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import Link from 'next/link'

type ReconRun = {
  id: string
  provider: string
  network: string | null
  assetCode: string
  expectedAtomicBalance: string
  observedAtomicBalance: string
  differenceAtomicAmount: string
  state: string
  createdAt: string
  completedAt: string | null
  cases: Array<Record<string, unknown>>
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'matched', label: '一致' },
  { value: 'differences_found', label: '有差异' },
  { value: 'failed', label: '失败' },
]

export default function ReconciliationPage() {
  const [state, setState] = useState('')
  const recon = useApi<{ runs: ReconRun[] }>(`/api/admin/ledger/reconciliations${state ? `?state=${state}` : ''}`)
  const rows = recon.data?.runs ?? []

  const columns: Col<ReconRun>[] = [
    { key: 'provider', label: '来源', render: (row) => <span className="font-medium">{row.provider}</span> },
    { key: 'asset', label: '资产', render: (row) => <span className="font-mono text-xs">{row.assetCode}{row.network ? ` · ${row.network}` : ''}</span> },
    { key: 'expected', label: '账本期望（原子）', render: (row) => <span className="tabular-nums">{row.expectedAtomicBalance}</span> },
    { key: 'observed', label: '托管观测（原子）', render: (row) => <span className="tabular-nums">{row.observedAtomicBalance}</span> },
    {
      key: 'diff',
      label: '差异',
      render: (row) => <span className={row.differenceAtomicAmount === '0' ? 'tabular-nums text-text-faint' : 'tabular-nums font-medium text-rose-600'}>{row.differenceAtomicAmount}</span>,
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'cases', label: '差异单', render: (row) => <span className="text-xs text-text-faint">{row.cases.length ? `${row.cases.length} 个` : '—'}</span> },
    { key: 'completedAt', label: '完成时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.completedAt ?? row.createdAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="对账中心" subtitle="托管余额对账（账本期望 vs 链上观测）— 三方一致性（现金/份数/NAV）在 Basket 运营页对账" actions={<RefreshButton loading={recon.loading} onClick={recon.reload} />} />

        <Panel title={`对账记录（${rows.length}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={recon.data?.runs ?? null} loading={recon.loading} error={recon.error} onReload={recon.reload} emptyHint="暂无对账记录" compact />
          </div>
        </Panel>

        <Panel title="相关页面" delay={80}>
          <p className="text-[13px] text-text-secondary">
            组合级三方对账（现金 / 份数 / NAV）在
            <Link href="/basket" className="mx-1 font-medium text-mint hover:underline">
              Basket 运营
            </Link>
            页执行；账本调整单在
            <Link href="/ledger" className="mx-1 font-medium text-mint hover:underline">
              账本明细
            </Link>
            页审批。
          </p>
        </Panel>
      </div>
    </AdminLayout>
  )
}
