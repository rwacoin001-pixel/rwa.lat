'use client'

import { useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, useApi } from '@/components/console/framework'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

type Asset = {
  slug: string
  name: string
  symbol: string | null
  assetClass: string
  rank: number | null
  isTokenized: boolean
  score: number | null
  riskLevel: string | null
  priceUsd: string | null
  marketCapUsd: string | null
  issuer: { slug: string; name: string } | null
}

function money(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

export default function AssetsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const list = useApi<{ items: Asset[]; total: number; page: number; limit: number }>(
    `/api/admin/console/assets?page=${page}&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  )
  const totalPages = list.data ? Math.max(Math.ceil(list.data.total / (list.data.limit || 50)), 1) : 1

  const columns: Col<Asset>[] = [
    { key: 'rank', label: '#', render: (row) => <span className="tabular-nums text-xs text-text-faint">{row.rank ?? '—'}</span> },
    {
      key: 'name',
      label: '资产',
      render: (row) => (
        <span>
          <span className="block font-medium">{row.name}</span>
          <span className="block font-mono text-xs text-text-faint">{row.slug}</span>
        </span>
      ),
    },
    { key: 'assetClass', label: '类别', render: (row) => <span className="pill bg-ink/[0.05] text-text-secondary">{row.assetClass}</span> },
    { key: 'issuer', label: '发行商', render: (row) => <span className="text-xs">{row.issuer?.name ?? '—'}</span> },
    {
      key: 'score',
      label: '评分',
      render: (row) =>
        row.score !== null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="tabular-nums font-semibold">{row.score}</span>
            {row.riskLevel && (
              <span className={`pill ${row.riskLevel === 'low' ? 'bg-emerald-500/12 text-emerald-600' : row.riskLevel === 'high' ? 'bg-rose-500/12 text-rose-600' : 'bg-amber-500/12 text-amber-600'}`}>
                {row.riskLevel}
              </span>
            )}
          </span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    { key: 'priceUsd', label: '价格', render: (row) => <span className="tabular-nums">{row.priceUsd ? `$${Number(row.priceUsd).toLocaleString('en-US', { maximumFractionDigits: 4 })}` : '—'}</span> },
    { key: 'marketCapUsd', label: '市值', render: (row) => <span className="tabular-nums">{money(row.marketCapUsd)}</span> },
    { key: 'tokenized', label: '代币化', render: (row) => (row.isTokenized ? <span className="pill bg-mint/12 text-mint">是</span> : <span className="text-xs text-text-faint">否</span>) },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="资产分析"
          subtitle="RWA 标准化资产目录浏览（行情 + 多维评分）— 全量目录的搜索与检索"
          actions={
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setSearch(searchInput.trim())
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="搜索名称 / 代码 / slug"
                  className="w-64 rounded-xl border border-ink/10 bg-white/80 py-2 pl-9 pr-3 text-[13px] shadow-sm"
                />
              </div>
              <button type="submit" className="rounded-xl bg-white px-3.5 py-2 text-[13px] font-medium ring-1 ring-ink/10 hover:bg-ink/5">
                搜索
              </button>
              <RefreshButton loading={list.loading} onClick={list.reload} label="" />
            </form>
          }
        />

        <Panel
          title={`目录（共 ${list.data?.total?.toLocaleString() ?? '…'} 个资产）`}
          subtitle={search ? `搜索：${search}` : '按排名排序；可通过搜索定位具体资产'}
          delay={40}
          pad={false}
        >
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={list.data?.items ?? null} loading={list.loading} error={list.error} onReload={list.reload} emptyHint={search ? '未找到匹配资产' : '暂无资产'} compact />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-text-faint">
                第 {page} / {totalPages} 页
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-ink/10 transition-colors hover:bg-ink/5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white ring-1 ring-ink/10 transition-colors hover:bg-ink/5 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
