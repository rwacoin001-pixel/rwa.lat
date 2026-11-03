'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { Confirm } from '@/components/ops/Confirm'
import { getJson, sendJson, usePolled, useToday } from '@/components/ops/data'
import { ago, shortAddress, sgTime, waited } from '@/components/ops/format'
import { Board, Chip, DangerButton, Face, LimeButton, Notice, PageTitle, Tile, Updated } from '@/components/ops/ui'

type Row = { id: string; userId: string; state: string; reason: string; createdAt: string }
type Detail = Row & { blockers: Array<{ code: string; count: number }> }

const STATE_TEXT: Record<string, string> = { requested: '待处理', closed: '已关闭', rejected: '已拒绝', cancelled: '已撤回' }
// What still ties the account to money or open work; the core rechecks all of it inside the closing transaction.
// Codes as apps/api/src/notification/account-closure.service.ts returns them (Postgres lower-cases the aliases).
const BLOCKER_TEXT: Record<string, string> = {
  balances: '账户里还有余额', positions: '还有持仓', orders: '有未完成的订单', redemptions: '有未完成的赎回', withdrawals: '有未完成的提现',
  deposits: '有在途充值', transfers: '有未完成的转账', recurring: '有生效中的定投', rebalances: '有未完成的再平衡', trading: '有未成交的交易',
  subscriptions: '有生效中的订阅', yields: '有待发放的收益', quantlots: '还有考拉量化本金', quantorders: '有未完成的量化申购或赎回',
  basketpending: '有未完成的篮子申购或赎回', basketholdings: '还持有篮子份额',
}

function Workspace() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [params, router, pathname])
  const view = params.get('view') === 'all' ? 'all' : 'open'
  const list = usePolled<Row[]>('/api/admin/account-closures')
  const { reload: reloadToday } = useToday()
  const [now] = useState(() => Date.now())
  const rows = useMemo(() => (list.data ?? []).filter((r) => view === 'all' || r.state === 'requested').sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [list.data, view])
  const selected = rows.find((r) => r.id === params.get('id')) ?? rows[0] ?? null
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [note, setNote] = useState('')
  const [ack, setAck] = useState(false)
  const [dialog, setDialog] = useState<'close' | 'reject' | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const selectedId = selected?.id

  useEffect(() => {
    setDetail(null); setDetailError(''); setNote(''); setAck(false)
    if (!selectedId) return
    let alive = true
    getJson<Detail>(`/api/admin/account-closures/${encodeURIComponent(selectedId)}`)
      .then((d) => { if (alive) setDetail(d) })
      .catch((e) => { if (alive) setDetailError(e instanceof Error ? e.message : '读取失败') })
    return () => { alive = false }
  }, [selectedId])

  const review = async (decision: 'close' | 'reject') => {
    if (!detail) return
    if (!note.trim()) throw new Error('请写处理说明。')
    await sendJson(`/api/admin/account-closures/${encodeURIComponent(detail.id)}/review`, 'POST', { decision, note: note.trim() })
    setNotice({ kind: 'ok', text: decision === 'close' ? '账户已关闭，用户的登录已全部退出。' : '已拒绝这份注销申请。' })
    set({ id: null })
    await list.reload()
    void reloadToday()
  }

  const blockers = detail?.blockers ?? []
  const open = (list.data ?? []).filter((r) => r.state === 'requested').length

  return (
    <>
      <PageTitle title="账户注销" meta={<span className="flex flex-wrap gap-x-3"><span>有余额、持仓或未完成的事时不能关闭；不会自动转移资金</span><Updated at={list.updatedAt} loading={list.loading} /></span>} />
      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
      {list.error && <Notice kind="error">{list.error}</Notice>}
      <div className="h-6" />
      <Board title="注销申请" tabs={[{ key: 'open', label: '待处理', count: open }, { key: 'all', label: '全部' }]} active={view} onTab={(k) => set({ view: k, id: null })}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <ul className={cn('flex flex-col gap-1', params.get('id') && 'hidden lg:flex')}>
            {rows.map((r) => {
              const on = selected?.id === r.id
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => set({ id: r.id })} className={cn('flex w-full items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                    <Face id={r.userId} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px]">{shortAddress(r.userId, 8, 4)}</span>
                      <span className={cn('block truncate text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{r.state === 'requested' ? `已等 ${waited(r.createdAt, now)}` : ago(r.createdAt)} · {r.reason || '没有写原因'}</span>
                    </span>
                    <Chip on={on} tone={r.state === 'requested' ? 'warn' : r.state === 'closed' ? 'down' : 'plain'}>{STATE_TEXT[r.state] ?? r.state}</Chip>
                  </button>
                </li>
              )
            })}
            {!rows.length && !list.loading && <li className="px-4 py-12 text-center text-[14px] text-ops-sub">没有待处理的注销申请。</li>}
          </ul>

          {selected ? (
            <article className={cn('flex flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6', !params.get('id') && 'hidden lg:flex')}>
              <button type="button" onClick={() => set({ id: null })} className="mb-2 self-start text-[13px] text-ops-muted lg:hidden">← 返回列表</button>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13px] text-ops-muted" title={sgTime(selected.createdAt)}>{ago(selected.createdAt)}申请</div>
                  <h3 className="mt-1 text-[22px] leading-snug">{selected.reason || '没有写原因'}</h3>
                </div>
                <a href={`/users?q=${encodeURIComponent(selected.userId)}`} className="flex items-center gap-3 rounded-full border border-ops-line py-1.5 pl-1.5 pr-4 hover:bg-ops-raised">
                  <Face id={selected.userId} size={40} /><span className="font-mono text-[13px]">{shortAddress(selected.userId, 8, 4)}</span><ArrowUpRight className="h-4 w-4 text-ops-muted" />
                </a>
              </div>
              {detailError && <p className="mt-5 text-[14px] text-ops-down">读取失败：{detailError}</p>}
              {!detail && !detailError && <p className="mt-5 text-[14px] text-ops-muted">正在核查…</p>}
              {detail && (blockers.length ? (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {blockers.map((b) => <Tile key={b.code} tone="down" label={BLOCKER_TEXT[b.code] ?? b.code} value={`${b.count} 项`} />)}
                </div>
              ) : <p className="mt-5 flex items-center gap-2 text-[14px]"><Check className="h-4 w-4 text-ops-lime" />没有阻塞项，可以关闭。关闭时服务端会再核查一次。</p>)}
              {detail?.state === 'requested' && <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="处理说明（必填，会记录在案）" className="mt-5 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
                {!blockers.length && (
                  <label className="mt-3 flex items-start gap-3 text-[13px] text-ops-muted">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C5F23B]" />
                    我已核实，知道关闭后用户的所有登录都会退出，之后再到账的充值要人工处理。
                  </label>
                )}
                <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
                  <DangerButton disabled={!note.trim()} onClick={() => setDialog('reject')}>拒绝申请</DangerButton>
                  <LimeButton disabled={blockers.length > 0 || !ack || !note.trim()} onClick={() => setDialog('close')}>关闭账户</LimeButton>
                </div>
              </>}
            </article>
          ) : <div className="hidden min-h-[280px] items-center justify-center rounded-[24px] bg-ops-bg text-[14px] text-ops-muted lg:flex">选一份申请查看</div>}
        </div>
      </Board>
      {detail && <>
        <Confirm open={dialog === 'close'} onClose={() => setDialog(null)} title="关闭这个账户？" danger confirmLabel="关闭账户"
          rows={[{ label: '用户', value: <span className="font-mono text-[13px]">{detail.userId}</span> }, { label: '说明', value: note.trim() }]}
          note="关闭后无法恢复，用户的登录会全部退出。" typeToConfirm="关闭" typeLabel="请输入「关闭」确认" onConfirm={() => review('close')} />
        <Confirm open={dialog === 'reject'} onClose={() => setDialog(null)} title="拒绝这份申请？" confirmLabel="拒绝申请" rows={[{ label: '说明', value: note.trim() }]} onConfirm={() => review('reject')} />
      </>}
    </>
  )
}

export default function AccountClosuresPage() {
  return <AppShell><Suspense fallback={null}><Workspace /></Suspense></AppShell>
}
