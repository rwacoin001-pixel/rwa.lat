'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { usePolled } from '@/components/ops/data'
import { ago, sgTime } from '@/components/ops/format'
import { Board, Chip, Face, FilterBar, Money, Notice, OutlineButton, PageTitle, SearchPill, SelectPill, Updated } from '@/components/ops/ui'
import { loginMethodName, type ManagedUser } from '@/components/user-detail'

const PAGE = 50
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USER_STATUS: Record<string, string> = { active: '正常', restricted: '受限', suspended: '暂停', closed: '已关闭' }

function List() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [params, router, pathname])
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const offset = Math.max(0, Number(params.get('offset') ?? 0) || 0)
  const [input, setInput] = useState(q)
  useEffect(() => setInput(q), [q])

  // A full user id goes straight to that user (search, links from other pages, Ctrl K).
  useEffect(() => { if (UUID.test(q.trim())) router.replace(`/users/${q.trim()}`) }, [q, router])

  const query = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
  if (q) query.set('q', q)
  if (status) query.set('status', status)
  const list = usePolled<{ total: number; count: number; users: ManagedUser[] }>(UUID.test(q.trim()) ? null : `/api/admin/users?${query}`, 0)
  const users = list.data?.users ?? []
  const total = list.data?.total ?? 0

  return (
    <>
      <PageTitle title="用户" meta={<span className="flex flex-wrap gap-x-3"><span>{list.data ? `共 ${total} 位` : '读取中'}</span><Updated at={list.updatedAt} loading={list.loading} /></span>} />
      <form onSubmit={(e) => { e.preventDefault(); set({ q: input.trim() || null, offset: null }) }}>
        <FilterBar active={(q ? 1 : 0) + (status ? 1 : 0)} onClear={() => { setInput(''); set({ q: null, status: null, offset: null }) }}>
          <SearchPill value={input} onChange={setInput} placeholder="完整邮箱、用户 ID、昵称或用户名，回车搜索" />
          <SelectPill value={status} onChange={(v) => set({ status: v || null, offset: null })} placeholder="全部状态" options={Object.entries(USER_STATUS).map(([value, label]) => ({ value, label }))} />
        </FilterBar>
      </form>
      {list.error && <Notice kind="error">{list.error}</Notice>}
      <div className="h-2" />
      <Board title={q ? `「${q}」的结果` : '用户列表'}
        tools={<div className="flex items-center gap-2 text-[12px] text-ops-sub">
          <span>{total ? `${offset + 1}–${Math.min(offset + PAGE, total)} / ${total}` : '0 位'}</span>
          <OutlineButton className="!h-9 !border-ops-rule !px-4 !text-ops-ink hover:!bg-[#F4F5F7]" disabled={offset === 0} onClick={() => set({ offset: String(Math.max(0, offset - PAGE)) })}>上一页</OutlineButton>
          <OutlineButton className="!h-9 !border-ops-rule !px-4 !text-ops-ink hover:!bg-[#F4F5F7]" disabled={offset + PAGE >= total} onClick={() => set({ offset: String(offset + PAGE) })}>下一页</OutlineButton>
        </div>}>
        <ul className="flex flex-col">
          {users.map((u) => (
            <li key={u.id} className="border-b border-ops-rule last:border-0">
              <Link href={`/users/${u.id}`} className="flex items-center gap-3 rounded-[20px] px-3 py-3 hover:bg-[#F4F5F7]">
                <Face id={u.id} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{u.email ?? (u.emailState === 'unavailable' ? '邮箱读取失败' : '未绑定邮箱')}</span>
                  <span className="block truncate text-[12px] text-ops-sub">{u.displayName || '未设置昵称'}{u.handle ? ` · @${u.handle}` : ''} · {u.loginMethods.map(loginMethodName).join(' / ') || '—'}</span>
                </span>
                <span className="hidden w-[150px] text-right text-[12px] text-ops-sub md:block" title={sgTime(u.lastSeenAt)}>{u.lastSeenAt ? `活跃 ${ago(u.lastSeenAt)}` : '没有活跃记录'}</span>
                <Money atomic={u.availableAtomic} className="w-[120px] text-right text-[15px]" />
                <span className="w-[72px] text-right"><Chip tone={u.status === 'active' ? 'plain' : u.status === 'closed' ? 'down' : 'warn'}>{USER_STATUS[u.status] ?? u.status}</Chip></span>
              </Link>
            </li>
          ))}
          {!users.length && !list.loading && <li className={cn('px-4 py-12 text-center text-[14px] text-ops-sub')}>{q ? '没有找到。邮箱要输入完整。' : '还没有用户。'}</li>}
        </ul>
      </Board>
    </>
  )
}

export default function UsersPage() {
  return <AppShell><Suspense fallback={null}><List /></Suspense></AppShell>
}
