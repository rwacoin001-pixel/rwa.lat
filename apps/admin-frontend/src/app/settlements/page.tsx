'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, formatDateTime, shortId, useApi } from '@/components/console/framework'

type Settlement = {
  id: string
  productId: string
  productName: string | null
  outcomeKey: string
  requestId: string
  settledAt: string
}

export default function SettlementsPage() {
  const list = useApi<Settlement[]>('/api/admin/console/settlements?limit=200')
  const rows = list.data ?? []

  const columns: Col<Settlement>[] = [
    { key: 'id', label: '结算单', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 12)}</span> },
    { key: 'product', label: '产品', render: (row) => <span className="font-medium">{row.productName ?? shortId(row.productId, 10)}</span> },
    {
      key: 'outcome',
      label: '结算结果',
      render: (row) => (
        <span className={row.outcomeKey === 'yes' ? 'pill bg-emerald-500/12 text-emerald-600' : row.outcomeKey === 'no' ? 'pill bg-rose-500/12 text-rose-600' : 'pill bg-ink/[0.06] text-text-secondary'}>
          {row.outcomeKey === 'yes' ? 'YES' : row.outcomeKey === 'no' ? 'NO' : row.outcomeKey === 'void' ? '作废' : row.outcomeKey}
        </span>
      ),
    },
    { key: 'requestId', label: '请求号', render: (row) => <span className="font-mono text-[11px] text-text-faint">{shortId(row.requestId, 14)}</span> },
    { key: 'settledAt', label: '结算时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.settledAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="结算管理"
          subtitle="预测市场/收益类产品的结算记录（结算后按持有份额将收益或赔付入账用户可用余额）"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        <Panel title={`结算记录（${rows.length}）`} subtitle="最近 200 条；结算动作由资金侧执行（开关默认关闭）" delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={list.data} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无结算记录" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
