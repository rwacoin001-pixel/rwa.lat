'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type CollectionData = {
  stats: { total: number; credited: number; pending: number; creditedAtomicTotal: string }
  recent: Array<{
    id: string
    userId: string
    assetCode: string
    atomicAmount: string
    state: string
    detectedAt: string
    creditedAt: string | null
  }>
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'credited', label: '已入账' },
  { value: 'detected', label: '已检测' },
  { value: 'failed', label: '失败' },
]

function usdt(atomic: string | null | undefined): string {
  if (!atomic) return '0'
  const n = Number(atomic)
  return Number.isFinite(n) ? (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) : atomic
}

export default function CollectionsPage() {
  const [state, setState] = useState('')
  const data = useApi<CollectionData>(`/api/admin/console/collections${state ? `?state=${state}` : ''}`)

  const columns: Col<CollectionData['recent'][number]>[] = [
    { key: 'id', label: '充值单', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs">{shortId(row.userId, 12)}</span> },
    {
      key: 'amount',
      label: '金额',
      render: (row) => (
        <span className="tabular-nums">
          <span className="font-medium">{usdt(row.atomicAmount)}</span> <span className="text-xs text-text-faint">{row.assetCode}</span>
        </span>
      ),
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'detectedAt', label: '检测时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.detectedAt)}</span> },
    { key: 'creditedAt', label: '入账时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.creditedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="归集管理"
          subtitle="用户充值入账全流程观察（链上检测 → 确认数满足 → 入账账本）— 资金动作由提现/充值开关控制"
          actions={<RefreshButton loading={data.loading} onClick={data.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="充值单总数" value={data.data?.stats.total ?? '…'} delay={40} />
          <StatChip label="已入账" value={data.data?.stats.credited ?? '…'} delay={90} />
          <StatChip label="待入账" value={data.data?.stats.pending ?? '…'} delay={140} />
          <StatChip label="累计入账（USDT）" value={usdt(data.data?.stats.creditedAtomicTotal)} delay={190} />
        </div>

        <Panel title={`近期充值（${data.data?.recent.length ?? 0}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={data.data?.recent ?? null} loading={data.loading} error={data.error} onReload={data.reload} emptyHint="暂无充值记录" compact />
          </div>
        </Panel>

        <Panel title="说明" delay={260}>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            充值地址为每用户独立派发（地址池管理见「钱包财资」）；用户充值到账依赖链上回调与确认数策略。归集（将分散充值地址资金集中）当前按运营流程人工/脚本执行，
            自动化归集任务的调度界面规划中。
          </p>
        </Panel>
      </div>
    </AdminLayout>
  )
}
