'use client'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'

type UserRow = {
  id: string
  status: string
  locale: string
  created_at: string
  updated_at: string
}

export default function UsersPage() {
  const list = useApi<{ count: number; users: UserRow[] }>('/api/admin/users?limit=200')
  const rows = list.data?.users ?? []

  const columns: Col<UserRow>[] = [
    { key: 'id', label: '用户 ID', render: (row) => <span className="font-mono text-xs">{shortId(row.id, 18)}</span> },
    { key: 'status', label: '状态', render: (row) => <StatusPill value={row.status} /> },
    { key: 'locale', label: '语言', render: (row) => <span className="text-xs">{row.locale}</span> },
    { key: 'created_at', label: '注册时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.created_at)}</span> },
    { key: 'updated_at', label: '最近更新', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.updated_at)}</span> },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="用户管理"
          subtitle={`注册用户（只读）— 共 ${list.data?.count ?? '…'} 条记录，用户身份信息加密存储、不在此展示`}
          actions={<RefreshButton loading={list.loading} onClick={list.reload} />}
        />

        <Panel title={`用户列表（${rows.length}）`} subtitle="最新 200 条；用户详情、KYC/KYB 与适当性见对应模块" delay={40} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={columns} rows={rows} loading={list.loading} error={list.error} onReload={list.reload} emptyHint="暂无用户" compact />
          </div>
        </Panel>
      </div>
    </AdminLayout>
  )
}
