'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type Eligibility = {
  id: string
  userId: string
  policyVersion: string
  productScope: string
  decision: string
  reasonCodes: string[]
  decidedAt: string
  expiresAt: string | null
}

export default function EligibilityPage() {
  const list = useApi<Eligibility[]>('/api/admin/console/eligibility?limit=200')
  const rows = list.data ?? []

  const columns: Col<Eligibility>[] = [
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs">{shortId(row.userId, 12)}</span> },
    { key: 'productScope', label: '产品范围', render: (row) => <span className="font-mono text-xs">{row.productScope}</span> },
    { key: 'decision', label: '结论', render: (row) => <StatusPill value={row.decision === 'eligible' ? 'approved' : row.decision === 'blocked' ? 'blocked' : row.decision} /> },
    {
      key: 'reasonCodes',
      label: '理由',
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {(row.reasonCodes ?? []).map((code) => (
            <span key={code} className="pill bg-ink/[0.05] text-text-secondary">
              {code}
            </span>
          ))}
          {!row.reasonCodes?.length && <span className="text-xs text-text-faint">—</span>}
        </span>
      ),
    },
    { key: 'policyVersion', label: '策略版本', render: (row) => <span className="font-mono text-[11px] text-text-faint">{row.policyVersion}</span> },
    { key: 'decidedAt', label: '评估时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.decidedAt)}</span> },
    { key: 'expiresAt', label: '有效期至', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.expiresAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="适当性评估"
          subtitle="产品适当性评估结论（基于用户地区、认证状态与风险评估）：browse_only / eligible 等"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        <Panel title={`评估记录（${rows.length}）`} subtitle="最近 200 条；用户完成评估后由系统按产品范围写入" delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={list.data} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无评估记录" />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
