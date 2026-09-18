'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, FilterTabs, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type RiskFlag = {
  id: string
  userId: string
  category: string
  severity: string
  state: string
  source: string
  reasonCode: string
  openedAt: string
  resolvedAt: string | null
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'open', label: '未处理' },
  { value: 'resolved', label: '已解决' },
]

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-rose-500/15 text-rose-600',
  high: 'bg-amber-500/15 text-amber-700',
  medium: 'bg-sky-500/15 text-sky-600',
  low: 'bg-ink/[0.06] text-text-secondary',
}

export default function RiskPage() {
  const [state, setState] = useState('open')
  const flags = useApi<RiskFlag[]>(`/api/admin/console/risk-flags${state ? `?state=${state}&limit=200` : '?limit=200'}`)
  const rows = flags.data ?? []

  const columns: Col<RiskFlag>[] = [
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs">{shortId(row.userId, 12)}</span> },
    { key: 'category', label: '类别', render: (row) => <span className="font-mono text-xs">{row.category}</span> },
    {
      key: 'severity',
      label: '严重度',
      render: (row) => <span className={`pill ${SEVERITY_STYLE[row.severity] ?? 'bg-ink/[0.06] text-text-secondary'}`}>{row.severity}</span>,
    },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'source', label: '来源', render: (row) => <span className="text-xs text-text-faint">{row.source}</span> },
    { key: 'reasonCode', label: '理由码', render: (row) => <span className="text-xs">{row.reasonCode}</span> },
    { key: 'openedAt', label: '打开时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.openedAt)}</span> },
    { key: 'resolvedAt', label: '解决时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.resolvedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="风险控制"
          subtitle="合规风险标记（筛查命中、行为异常等）— 由合规引擎自动开立与消解"
          actions={<RefreshButton loading={flags.loading} onClick={flags.reload} />}
        />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatChip label="未处理" value={rows.filter((row) => row.state === 'open').length || (flags.loading ? '…' : 0)} delay={40} />
          <StatChip label="critical / high" value={rows.filter((row) => ['critical', 'high'].includes(row.severity)).length} delay={90} />
          <StatChip label="当前筛选总数" value={rows.length} delay={140} />
          <StatChip label="数据范围" value="最近 200 条" delay={190} />
        </div>

        <Panel title={`风险标记（${rows.length}）`} actions={<FilterTabs options={TABS} value={state} onChange={setState} />} delay={220} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={flags.data} loading={flags.loading} error={flags.error} onReload={flags.reload} emptyHint="没有风险标记" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
