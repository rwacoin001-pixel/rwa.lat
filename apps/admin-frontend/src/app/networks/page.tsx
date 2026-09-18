'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, useApi } from '@/components/console/framework'
import Link from 'next/link'

type Network = {
  slug: string
  name: string
  chainId: number | null
  nativeSymbol: string | null
  explorerUrl: string | null
  active: boolean
}

export default function NetworksPage() {
  const list = useApi<{ items: Network[] }>('/api/admin/console/networks')
  const rows = list.data?.items ?? []

  const columns: Col<Network>[] = [
    {
      key: 'name',
      label: '网络',
      render: (row) => (
        <span>
          <span className="block font-medium">{row.name}</span>
          <span className="block font-mono text-xs text-text-faint">{row.slug}</span>
        </span>
      ),
    },
    { key: 'chainId', label: 'Chain ID', render: (row) => <span className="font-mono text-xs">{row.chainId ?? '—'}</span> },
    { key: 'nativeSymbol', label: '原生代币', render: (row) => <span className="font-mono text-xs">{row.nativeSymbol ?? '—'}</span> },
    {
      key: 'explorerUrl',
      label: '区块浏览器',
      render: (row) =>
        row.explorerUrl ? (
          <a href={row.explorerUrl} target="_blank" rel="noreferrer" className="text-xs text-mint hover:underline">
            {row.explorerUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-xs text-text-faint">—</span>
        ),
    },
    { key: 'active', label: '状态', render: () => <span className="pill bg-emerald-500/12 text-emerald-600">启用中</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="网络配置"
          subtitle="RWA 资产目录覆盖的区块链网络（用于资产页筛选与链上数据关联）"
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        <Panel title={`网络列表（${rows.length}）`} subtitle="数据同步自 CMC 目录管线" delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={rows} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无网络数据" compact />
          </div>
        </Panel>

        <Panel title="相关配置" delay={80}>
          <p className="text-[13px] text-text-secondary">
            链上托管地址（热钱包、国库地址）在
            <Link href="/control" className="mx-1 font-medium text-mint hover:underline">
              运营控制
            </Link>
            中管理；钱包网络能力（充值/提现）见
            <Link href="/wallets" className="mx-1 font-medium text-mint hover:underline">
              钱包财资
            </Link>
            。
          </p>
        </Panel>
      </div>
    </AdminLayout>
  )
}
