'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, formatDateTime, shortId, useApi } from '@/components/console/framework'

type AiAnalysis = {
  id: string
  assetId: string
  assetSlug: string | null
  assetName: string | null
  model: string
  analysisVersion: string
  summary: string | null
  generatedAt: string
}

export default function AiOpsPage() {
  const list = useApi<AiAnalysis[]>('/api/admin/console/ai-analysis?limit=100')
  const rows = list.data ?? []

  const columns: Col<AiAnalysis>[] = [
    {
      key: 'asset',
      label: '资产',
      render: (row) => (
        <span>
          <span className="block font-medium">{row.assetName ?? shortId(row.assetId, 10)}</span>
          <span className="block font-mono text-xs text-text-faint">{row.assetSlug ?? ''}</span>
        </span>
      ),
    },
    { key: 'model', label: '模型', render: (row) => <span className="pill bg-ink/[0.05] text-text-secondary">{row.model}</span> },
    { key: 'version', label: '版本', render: (row) => <span className="font-mono text-xs">{row.analysisVersion}</span> },
    { key: 'summary', label: '分析摘要', render: (row) => <span className="block max-w-[520px] text-xs leading-relaxed text-text-secondary">{row.summary ?? '—'}</span> },
    { key: 'generatedAt', label: '生成时间', render: (row) => <span className="whitespace-nowrap text-xs text-text-faint">{formatDateTime(row.generatedAt)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="AI 运维"
          subtitle="资产 AI 分析产物（DeepSeek 生成：摘要 / 多空论点 / 风险提示）— 分析在同步管线中自动运行"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        <Panel title={`最近分析（${rows.length}）`} subtitle="最近 100 条 AI 分析记录；点击资产名可在「资产分析」中检索详情" delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={list.data} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无 AI 分析记录 — 等待同步管线生成" compact />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
