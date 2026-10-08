'use client'

import { useState } from 'react'
import { AccountClosures } from '@/components/account-closures'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { UserDetailDialog, emailStateName, loginMethodName, type ManagedUser } from '@/components/user-detail'
import { formatUsdt } from '@/lib/user-balances'

const pageSize = 50
export default function UsersPage() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
  if (query) params.set('q', query)
  if (status) params.set('status', status)
  const list = useApi<{ total: number; count: number; users: ManagedUser[] }>(`/api/admin/users?${params}`)
  const profile = useApi<{ id: string; permissions: string[] }>('/api/admin/auth/me')
  const canAdjust = ['users.read', 'ledger.adjustments.manage', 'ledger.adjustments.post'].every((p) => profile.data?.permissions.includes(p))
  const columns: Col<ManagedUser>[] = [
    { key: 'email', label: '用户', render: (u) => <div className="min-w-[180px]"><button type="button" className="break-all text-left font-medium hover:underline" onClick={() => setSelected(u.id)}>{u.email ?? (u.emailState === 'unavailable' ? '邮箱读取失败' : '未绑定邮箱')}</button><p className="mt-1 text-xs text-text-faint">{u.displayName || '未设置昵称'}{u.handle ? ` · @${u.handle}` : ''}</p><span className="font-mono text-[10px] text-text-faint" title={u.id}>{shortId(u.id, 18)}</span></div> },
    { key: 'status', label: '状态', render: (u) => <StatusPill value={u.status} /> },
    { key: 'emailState', label: '邮箱验证', render: (u) => <span className="text-xs">{emailStateName(u.emailState)}</span> },
    { key: 'loginMethods', label: '登录方式', render: (u) => <span className="text-xs">{u.loginMethods.map(loginMethodName).join(' / ') || '—'}</span> },
    { key: 'availableAtomic', label: '可用 USDT', className: 'text-right', render: (u) => <span className="font-mono text-xs tabular-nums">{formatUsdt(u.availableAtomic)}</span> },
    { key: 'lockedAtomic', label: '锁定 USDT', className: 'text-right', render: (u) => <span className="font-mono text-xs tabular-nums">{formatUsdt(u.lockedAtomic)}</span> },
    { key: 'created_at', label: '注册时间', render: (u) => <span className="whitespace-nowrap text-xs text-text-faint">{formatDateTime(u.created_at)}</span> },
    { key: 'lastSeenAt', label: '最近活跃', render: (u) => <span className="whitespace-nowrap text-xs text-text-faint">{u.lastSeenAt ? formatDateTime(u.lastSeenAt) : '—'}</span> },
    { key: 'details', label: '操作', render: (u) => <button className="rounded-lg border border-ink/15 px-3 py-2 text-xs hover:bg-ink/5" onClick={() => setSelected(u.id)}>详情{canAdjust ? ' / 调账' : ''}</button> },
  ]
  const total = list.data?.total ?? 0
  return <AdminLayout><div className="space-y-5">
    <Panel title="用户管理" actions={<RefreshButton loading={list.loading} onClick={list.reload} />}>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(input.trim()); list.reload() }}>
        <input className="h-11 min-w-[220px] flex-1 rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-ink/50" aria-label="搜索用户" placeholder="完整邮箱、用户 ID、昵称或用户名" maxLength={200} value={input} onChange={(e) => setInput(e.target.value)} />
        <select className="h-11 rounded-xl border border-ink/15 bg-white px-3 text-sm" aria-label="用户状态" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0) }}><option value="">所有状态</option><option value="active">正常</option><option value="restricted">受限</option><option value="suspended">暂停</option><option value="closed">已关闭</option></select>
        <button className="rounded-xl bg-ink px-5 py-2 text-sm text-white" type="submit">搜索</button>{(query || status) && <button type="button" className="px-3 text-sm" onClick={() => { setQuery(''); setInput(''); setStatus(''); setOffset(0) }}>清除</button>}
      </form>
    </Panel>
    <Panel title={`用户列表 · ${list.data ? total : '…'}`} pad={false}>
      <div className="px-5 pb-5"><DataTable columns={columns} rows={list.data?.users ?? []} loading={list.loading} error={list.error} onReload={list.reload} emptyHint={query ? '未找到匹配用户，请确认完整邮箱。' : '暂无用户'} compact />
        <div className="mt-4 flex items-center justify-between text-xs text-text-faint"><span>{total > 0 ? `${offset + 1}–${Math.min(offset + pageSize, total)} / ${total}` : '0 条'}</span><div className="flex gap-2"><button type="button" className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40" disabled={list.loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>上一页</button><button type="button" className="rounded-lg border border-ink/15 px-3 py-2 disabled:opacity-40" disabled={list.loading || offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>下一页</button></div></div>
      </div>
    </Panel>
    <AccountClosures />
    {selected && profile.loading && <p role="status" className="text-sm text-text-faint">正在获取管理员权限…</p>}
    {selected && profile.error && <p role="alert" className="text-sm text-red-700">管理员权限读取失败。<button className="ml-2 underline" onClick={profile.reload}>重试</button></p>}
    {selected && profile.data && <UserDetailDialog key={selected} id={selected} actorId={profile.data.id} canAdjust={canAdjust} onClose={() => setSelected(null)} onChanged={list.reload} />}
  </div></AdminLayout>
}
