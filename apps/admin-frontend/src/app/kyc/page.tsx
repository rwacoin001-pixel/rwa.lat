'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { Confirm } from '@/components/ops/Confirm'
import { sendJson, usePolled, usePolledList, useToday } from '@/components/ops/data'
import { ago, shortAddress, sgTime, waited } from '@/components/ops/format'
import { BigStatCard, Board, Chip, DangerButton, Face, FilterBar, LimeButton, Notice, PageTitle, SearchPill, SideCard, Tile, Updated } from '@/components/ops/ui'

type KycCase = { id: string; userId: string; state: string; provider: string; reasonCode: string | null; submittedAt: string | null; decidedAt: string | null; expiresAt: string | null; createdAt: string }
type Check = { status: 'Approved' | 'Declined'; score?: number; warnings: string[] }
type Evidence = { kind: 'hosted' | 'native'; phase?: string; requestIds: string[]; document?: Check; liveness?: Check; faceMatch?: Check }

const VIEWS = { review: 'submitted', approved: 'approved', rejected: 'rejected', all: '' } as const
type View = keyof typeof VIEWS
const STATE_TEXT: Record<string, string> = { submitted: '待审', approved: '已通过', rejected: '已驳回', expired: '已过期', not_started: '未开始', pending: '进行中' }
const CHECKS = [['document', '证件真实性'], ['liveness', '活体检测'], ['faceMatch', '人证比对']] as const
const REJECT_REASONS = ['证件照片不清晰', '证件与本人不符', '证件已过期', '活体检测未通过', '资料信息不一致']

function Workspace() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [params, router, pathname])
  const view = (params.get('view') as View) in VIEWS ? (params.get('view') as View) : 'review'
  const q = params.get('q') ?? ''
  const all = usePolledList<KycCase>('/api/admin/console/kyc?limit=200')
  const { reload: reloadToday } = useToday()
  const [now] = useState(() => Date.now())
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const rows = useMemo(() => (all.data ?? [])
    .filter((c) => !VIEWS[view] || c.state === VIEWS[view])
    .filter((c) => !q || [c.id, c.userId].some((v) => v.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => view === 'review' ? (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt) : (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt)), [all.data, view, q])
  const count = (state: string) => (all.data ?? []).filter((c) => c.state === state).length
  const selected = rows.find((c) => c.id === params.get('id')) ?? rows[0] ?? null
  const evidence = usePolled<Evidence>(selected ? `/api/admin/kyc/${encodeURIComponent(selected.id)}/checks` : null, 0)
  useEffect(() => { setReason('') }, [selected?.id])

  const pending = (all.data ?? []).filter((c) => c.state === 'submitted')
  const sgDay = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10) : '')
  const today = sgDay(new Date(now).toISOString())
  const decidedToday = (all.data ?? []).filter((c) => sgDay(c.decidedAt) === today).length
  const decided = (all.data ?? []).filter((c) => c.state === 'approved' || c.state === 'rejected')
  const passRate = decided.length ? Math.round((decided.filter((c) => c.state === 'approved').length / decided.length) * 100) : null
  const ev = evidence.data
  const allPassed = ev?.kind === 'native' && ev.phase === 'complete' && CHECKS.every(([k]) => ev[k]?.status === 'Approved')
  const reviewable = selected?.state === 'submitted' && ev?.kind === 'native'

  const decide = async (decision: 'approved' | 'rejected') => {
    if (!selected) return
    const reasonCode = decision === 'approved' ? (reason.trim() || '资料核验通过') : reason.trim()
    if (reasonCode.length < 2) throw new Error('请写明驳回原因。')
    await sendJson(`/api/admin/kyc/${encodeURIComponent(selected.id)}/decision`, 'POST', { decision, reasonCode })
    setNotice({ kind: 'ok', text: decision === 'approved' ? 'KYC 已通过。' : `已驳回：${reasonCode}` })
    const index = rows.findIndex((c) => c.id === selected.id)
    const next = rows[index + 1] ?? rows[index - 1]
    set({ id: next && next.id !== selected.id ? next.id : null })
    await all.reload()
    void reloadToday()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      const index = selected ? rows.findIndex((c) => c.id === selected.id) : -1
      if (e.key === 'j' && rows[index + 1]) set({ id: rows[index + 1].id })
      if (e.key === 'k' && index > 0) set({ id: rows[index - 1].id })
      if (e.key === 'a' && reviewable && allPassed) setDialog('approve')
      if (e.key === 'r' && reviewable) setDialog('reject')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, rows, selected, set, reviewable, allPassed])

  return (
    <>
      <PageTitle title="KYC 审核" meta={<span className="flex flex-wrap gap-x-3"><span>三项自动检查都通过才能人工通过</span><Updated at={all.updatedAt} loading={all.loading} /></span>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '待审', value: pending.length, hint: pending.length ? `最早已等 ${waited(pending.map((c) => c.submittedAt ?? c.createdAt).sort()[0], now)}` : '没有待审的' },
          { label: '今天已处理', value: decidedToday, hint: '新加坡时间' },
          { label: '通过率', value: passRate === null ? '—' : `${passRate}%`, hint: `最近 ${decided.length} 份已决定` },
        ]} />
        <SideCard label="人工复核资料" value="Didit" badge={selected ? shortAddress(selected.id, 6, 4) : undefined}
          action={<a href="https://business.didit.me" target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-ops-paper px-5 text-[14px] font-medium text-ops-ink">打开 Didit<ArrowUpRight className="h-4 w-4" /></a>}>
          <p className="mt-3 text-[13px] text-ops-muted">证件照片和活体视频在 Didit 后台查看；这里只显示检查结果和编号。</p>
        </SideCard>
      </div>

      <FilterBar active={q ? 1 : 0} onClear={() => set({ q: null, id: null })}>
        <SearchPill value={q} onChange={(v) => set({ q: v || null, id: null })} placeholder="搜索档案号或用户 ID" />
      </FilterBar>
      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
      {all.error && <Notice kind="error">{all.error}</Notice>}
      <div className="h-4" />

      <Board title={view === 'review' ? '待审档案' : '档案'} tabs={[{ key: 'review', label: '待审', count: count('submitted') }, { key: 'approved', label: '已通过' }, { key: 'rejected', label: '已驳回' }, { key: 'all', label: '全部' }]}
        active={view} onTab={(k) => set({ view: k, id: null })} tools={<span className="hidden text-[12px] text-ops-sub sm:inline">J / K 上下 · A 通过 · R 驳回</span>}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <ul className={cn('flex flex-col gap-1', params.get('id') && 'hidden lg:flex')}>
            {rows.map((c) => {
              const on = selected?.id === c.id
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => set({ id: c.id })} className={cn('flex w-full items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                    <Face id={c.userId} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px]">{shortAddress(c.userId, 8, 4)}</span>
                      <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{c.state === 'submitted' ? `已等 ${waited(c.submittedAt ?? c.createdAt, now)}` : c.decidedAt ? ago(c.decidedAt) : ago(c.createdAt)} · {c.provider}</span>
                    </span>
                    <Chip on={on} tone={c.state === 'submitted' ? 'warn' : c.state === 'approved' ? 'up' : c.state === 'rejected' ? 'down' : 'plain'}>{STATE_TEXT[c.state] ?? c.state}</Chip>
                  </button>
                </li>
              )
            })}
            {!rows.length && !all.loading && <li className="px-4 py-12 text-center text-[14px] text-ops-sub">{view === 'review' ? '没有待审的 KYC。' : '没有符合条件的档案。'}</li>}
          </ul>

          {selected ? (
            <article className={cn('flex flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6', !params.get('id') && 'hidden lg:flex')}>
              <button type="button" onClick={() => set({ id: null })} className="mb-2 self-start text-[13px] text-ops-muted lg:hidden">← 返回列表</button>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[13px] text-ops-muted">档案 · {selected.provider}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3"><span className="font-mono text-[22px]">{shortAddress(selected.id, 8, 6)}</span><Chip on>{STATE_TEXT[selected.state] ?? selected.state}</Chip></div>
                  <div className="mt-2 text-[12px] text-ops-muted" title={sgTime(selected.submittedAt)}>{selected.submittedAt ? `${ago(selected.submittedAt)}提交` : `${ago(selected.createdAt)}创建`}{selected.reasonCode ? ` · ${selected.reasonCode}` : ''}</div>
                </div>
                <a href={`/users?q=${encodeURIComponent(selected.userId)}`} className="flex items-center gap-3 rounded-full border border-ops-line py-1.5 pl-1.5 pr-4 hover:bg-ops-raised">
                  <Face id={selected.userId} size={40} /><span className="font-mono text-[13px]">{shortAddress(selected.userId, 8, 4)}</span><ArrowUpRight className="h-4 w-4 text-ops-muted" />
                </a>
              </div>

              {evidence.loading && !ev && <p className="mt-6 text-[14px] text-ops-muted">读取检查结果…</p>}
              {evidence.error && <p className="mt-6 text-[14px] text-ops-down">检查结果读取失败：{evidence.error}</p>}
              {ev && (ev.kind === 'native' ? (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {CHECKS.map(([key, label]) => {
                    const c = ev[key]
                    return (
                      <Tile key={key} label={label} tone={!c ? 'warn' : c.status === 'Approved' ? 'ok' : 'down'}
                        value={<span className="flex items-center gap-2">{!c ? '未完成' : c.status === 'Approved' ? <><Check className="h-5 w-5 text-ops-lime" />通过</> : <><X className="h-5 w-5" />未通过</>}</span>}>
                        <div className="mt-1 text-[12px] text-ops-muted">{c?.score !== undefined ? `分数 ${c.score}` : ''}{c?.warnings.length ? ` · ${c.warnings.length} 条提示` : ''}</div>
                        {c?.warnings.map((w) => <div key={w} className="mt-1 break-all font-mono text-[11px] text-ops-warn">{w}</div>)}
                      </Tile>
                    )
                  })}
                </div>
              ) : <p className="mt-6 text-[14px] text-ops-muted">这份档案走的是托管流程，检查结果请在 Didit 后台查看。</p>)}
              {ev && ev.requestIds.length > 0 && <div className="mt-4 text-[12px] text-ops-muted">Didit 编号：{ev.requestIds.map((r) => <span key={r} className="ml-1 font-mono">{r}</span>)}</div>}

              {reviewable && (
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-6">
                  {!allPassed && <span className="mr-auto text-[12px] text-ops-warn">有检查项未通过，只能驳回</span>}
                  <DangerButton onClick={() => setDialog('reject')}>驳回</DangerButton>
                  <LimeButton disabled={!allPassed} onClick={() => setDialog('approve')}>通过</LimeButton>
                </div>
              )}
            </article>
          ) : <div className="hidden min-h-[320px] items-center justify-center rounded-[24px] bg-ops-bg text-[14px] text-ops-muted lg:flex">选一份档案查看</div>}
        </div>
      </Board>

      {selected && <>
        <Confirm open={dialog === 'approve'} onClose={() => setDialog(null)} title="通过这份 KYC？" confirmLabel="通过"
          rows={[{ label: '用户', value: <span className="font-mono text-[13px]">{selected.userId}</span> }, { label: '检查', value: '三项都通过' }]}
          note="通过后用户可以使用需要实名的功能。" onConfirm={() => decide('approved')} />
        <Confirm open={dialog === 'reject'} onClose={() => setDialog(null)} title="驳回这份 KYC？" danger confirmLabel="驳回" disabled={reason.trim().length < 2}
          rows={[{ label: '用户', value: <span className="font-mono text-[13px]">{selected.userId}</span> }]} note="原因会记录下来，用户需要重新提交。" onConfirm={() => decide('rejected')}>
          <div className="mt-4 flex flex-wrap gap-2">
            {REJECT_REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1.5 text-[13px]', reason === r ? 'border-ops-lime bg-ops-lime text-ops-ink' : 'border-ops-line text-ops-text hover:bg-ops-card')}>{r}</button>)}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="或者写下原因" rows={2} maxLength={128} className="mt-3 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
        </Confirm>
      </>}
    </>
  )
}

export default function KycPage() {
  return <AppShell><Suspense fallback={null}><Workspace /></Suspense></AppShell>
}
