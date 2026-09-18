'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type Order = {
  id: string
  userId: string
  productId: string
  productName: string | null
  side: string
  state: string
  outcomeKey: string
  settlementAssetCode: string
  requestedAtomicAmount: string
  filledAtomicAmount: string
  unitPriceAtomicAmount: string
  failureReason: string | null
  submittedAt: string
  completedAt: string | null
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'filled', label: '已成交' },
  { value: 'partially_filled', label: '部分成交' },
  { value: 'pending', label: '待处理' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

function usdt(atomic: string | null | undefined): string {
  if (!atomic) return '—'
  const n = Number(atomic)
  if (!Number.isFinite(n)) return atomic
  return (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function OrdersPage() {
  const [state, setState] = useState('')
  const orders = useApi<Order[]>(`/api/admin/console/orders${state ? `?state=${state}&limit=200` : '?limit=200'}`)
  const rows = orders.data ?? []

  const columns: Col<Order>[] = [
    { key: 'id', label: '订单号', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    {
      key: 'product',
      label: '产品',
      render: (row) => (
        <span>
          <span className="block font-medium">{row.productName ?? shortId(row.productId, 10)}</span>
          <span className="block text-xs text-text-faint">用户 {shortId(row.userId, 10)}</span>
        </span>
      ),
    },
    {
      key: 'side',
      label: '方向',
      render: (row) => (
        <span className={row.side === 'buy' ? 'pill bg-mint/12 text-mint' : 'pill bg-amber-500/12 text-amber-600'}>
          {row.side === 'buy' ? '买入' : row.side === 'sell' ? '卖出' : row.side}
        </span>
      ),
    },
    {
      key: 'amount',
      label: '金额（USDT）',
      render: (row) => (
        <span className="tabular-nums">
          <span className="font-medium">{usdt(row.requestedAtomicAmount)}</span>
          {row.filledAtomicAmount && row.filledAtomicAmount !== '0' && <span className="block text-xs text-text-faint">已成交 {usdt(row.filledAtomicAmount)}</span>}
        </span>
      ),
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'failureReason', label: '失败原因', render: (row) => <span className="block max-w-[220px] truncate text-xs text-rose-600">{row.failureReason ?? ''}</span> },
    { key: 'submittedAt', label: '提交时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.submittedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="订单管理"
          subtitle="全站用户买卖订单（产品级订单流水：锁定 → 成交 / 部分成交 / 失败）"
          actions={<RefreshButton loading={orders.loading} onClick={orders.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="订单总数" value={rows.length || '…'} delay={40} />
          <StatChip label="已成交" value={rows.filter((row) => row.state === 'filled').length || (orders.loading ? '…' : 0)} delay={90} />
          <StatChip label="部分成交" value={rows.filter((row) => row.state === 'partially_filled').length} delay={140} />
          <StatChip label="失败 / 取消" value={rows.filter((row) => row.state === 'failed' || row.state === 'cancelled').length} delay={190} />
        </div>

        <Panel title={`订单列表（${rows.length}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={orders.data} loading={orders.loading} error={orders.error} onReload={orders.reload} emptyHint="暂无订单" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
