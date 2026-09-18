'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { ProgressBar } from '@/components/ui/visuals'

type YieldBatch = {
  id: string
  productId: string
  productName: string | null
  assetCode: string
  totalAtomicAmount: string
  state: string
  periodStart: string
  periodEnd: string
  approvedAt: string | null
  executedAt: string | null
  createdAt: string
  allocationCount: number
  creditedAtomicAmount: string
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'approved', label: '已审批' },
  { value: 'executed', label: '已执行' },
]

const DAY = 86400000

function periodProgress(row: YieldBatch): number | null {
  const start = new Date(row.periodStart).getTime()
  const end = new Date(row.periodEnd).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  const now = Date.now()
  return Math.min(Math.max(((now - start) / (end - start)) * 100, 0), 100)
}

export default function YieldsPage() {
  const [state, setState] = useState('')
  const batches = useApi<{ items?: YieldBatch[] } | YieldBatch[]>(`/api/admin/console/yields${state ? `?state=${state}&limit=200` : '?limit=200'}`)
  const rows: YieldBatch[] = Array.isArray(batches.data) ? batches.data : (batches.data?.items ?? [])

  const columns: Col<YieldBatch>[] = [
    { key: 'id', label: '批次', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    { key: 'product', label: '产品', render: (row) => <span className="font-medium">{row.productName ?? shortId(row.productId, 10)}</span> },
    {
      key: 'period',
      label: '计息期间',
      render: (row) => (
        <span className="block min-w-[150px]">
          <span className="block text-xs text-text-secondary">
            {new Date(row.periodStart).toLocaleDateString('zh-CN')} → {new Date(row.periodEnd).toLocaleDateString('zh-CN')}
          </span>
          <span className="mt-1 block">
            <ProgressBar value={periodProgress(row)} tone="sky" height={4} label={undefined} valueText=" " />
          </span>
        </span>
      ),
    },
    {
      key: 'total',
      label: '总额 / 已入账（原子）',
      render: (row) => (
        <span className="tabular-nums">
          <span className="block font-medium">{row.totalAtomicAmount}</span>
          <span className="block text-xs text-emerald-600">已入账 {row.creditedAtomicAmount}</span>
        </span>
      ),
    },
    { key: 'allocationCount', label: '分配合数', render: (row) => <span className="tabular-nums">{row.allocationCount}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'executedAt', label: '执行时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.executedAt ?? row.approvedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="收益管理"
          subtitle="收益批次（计息 → 审批 → 执行入账到用户账本）— 执行动作由资金侧按开关控制"
          actions={<RefreshButton loading={batches.loading} onClick={batches.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="批次总数" value={rows.length || '…'} delay={40} />
          <StatChip label="待执行" value={rows.filter((row) => row.state === 'draft' || row.state === 'approved').length} delay={90} />
          <StatChip label="已执行" value={rows.filter((row) => row.state === 'executed').length} delay={140} />
          <StatChip label="数据范围" value="最近 200 批" delay={190} />
        </div>

        <Panel title={`收益批次（${rows.length}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={rows} loading={batches.loading} error={batches.error} onReload={batches.reload} emptyHint="暂无收益批次" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
