'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { Confirm } from '@/components/ops/Confirm'
import { sendJson, usePolled, useToday } from '@/components/ops/data'
import { ago, sgTime, waited } from '@/components/ops/format'
import { BigStatCard, Board, Chip, DangerButton, Face, LimeButton, Notice, OutlineButton, PageTitle, SideCard, Tile, Updated, WhiteButton } from '@/components/ops/ui'
import { CommunityPublications } from '@/components/community-publications'

type QueueItem = {
  id: string; kind: string; state: string; source: string | null; scheduledFor: string | null; reviewNote: string | null; reviewedBy: string | null
  attempts: number; createdAt: string; profile: { displayName?: string; handle?: string } | null; payload: Record<string, unknown> | null
}
type ReportItem = { id: string; targetType: string; targetId: string; reason: string; state: string; createdAt: string }
type Stats = { profiles: number; posts: number; comments: number; queuePending: number; postsLast24h: number }

const VIEWS = ['queue', 'reports', 'approved', 'published'] as const
type View = (typeof VIEWS)[number]
const KIND_TEXT: Record<string, string> = { post: '帖子', comment: '评论', reply: '回复' }
const TARGET_TEXT: Record<string, string> = { post: '帖子', comment: '评论', profile: '用户主页', message: '私信' }
const REJECT_REASONS = ['内容不实或夸大收益', '与投资无关', '语气不合适', '重复内容', '图片或链接有问题']

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
function content(item: QueueItem) {
  const p = item.payload ?? {}
  const images = Array.isArray(p.images) ? (p.images as unknown[]).map(str).filter(Boolean) as string[] : str(p.imageUrl) ? [str(p.imageUrl)!] : []
  return { title: str(p.title), text: str(p.text) ?? str(p.body) ?? str(p.content), lang: str(p.lang) ?? str(p.language), images, raw: p }
}
const persona = (item: QueueItem) => item.profile?.displayName ?? item.profile?.handle ?? item.source ?? '—'

function Workspace() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [params, router, pathname])
  const view: View = (VIEWS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as View) : 'queue'
  const stats = usePolled<Stats>('/api/admin/community/stats')
  const drafts = usePolled<QueueItem[]>('/api/admin/community/queue?state=draft&limit=200')
  const approved = usePolled<QueueItem[]>(view === 'approved' ? '/api/admin/community/queue?state=approved&limit=200' : null)
  const reports = usePolled<ReportItem[]>('/api/admin/community/reports?state=open&limit=200')
  const { reload: reloadToday } = useToday()
  const [now] = useState(() => Date.now())
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'approveAll' | 'reviewed' | 'dismissed' | 'publishDue' | null>(null)
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const queue = useMemo(() => (view === 'approved' ? approved.data ?? [] : drafts.data ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [view, approved.data, drafts.data])
  const openReports = useMemo(() => (reports.data ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [reports.data])
  const id = params.get('id')
  const item = view === 'queue' || view === 'approved' ? queue.find((q) => q.id === id) ?? queue[0] ?? null : null
  const report = view === 'reports' ? openReports.find((r) => r.id === id) ?? openReports[0] ?? null : null
  useEffect(() => { setNote('') }, [item?.id, report?.id])

  const advance = (list: Array<{ id: string }>, doneId: string) => {
    const index = list.findIndex((x) => x.id === doneId)
    const next = list[index + 1] ?? list[index - 1]
    set({ id: next && next.id !== doneId ? next.id : null })
  }
  const refresh = async () => { await Promise.all([drafts.reload(), reports.reload(), stats.reload(), approved.reload()]); void reloadToday() }
  const review = async (action: 'approve' | 'reject') => {
    if (!item) return
    await sendJson(`/api/admin/community/queue/${item.id}/review`, 'PUT', { action, ...(action === 'reject' && note.trim() ? { note: note.trim() } : {}) })
    setNotice({ kind: 'ok', text: action === 'approve' ? '已通过，到计划时间会发布。' : '已驳回，这条不会发布。' })
    advance(queue, item.id)
    await refresh()
  }
  const approveAll = async () => {
    let done = 0
    for (const q of drafts.data ?? []) {
      try { await sendJson(`/api/admin/community/queue/${q.id}/review`, 'PUT', { action: 'approve' }); done++ } catch { /* the rest still go; the count says how many */ }
    }
    setNotice({ kind: done === (drafts.data ?? []).length ? 'ok' : 'error', text: `已通过 ${done} / ${(drafts.data ?? []).length} 条。` })
    set({ id: null })
    await refresh()
  }
  const resolve = async (action: 'reviewed' | 'dismissed') => {
    if (!report) return
    await sendJson(`/api/admin/community/reports/${report.id}`, 'PUT', { action })
    setNotice({ kind: 'ok', text: action === 'reviewed' ? '举报已标记为处理完。' : '已忽略这条举报。' })
    advance(openReports, report.id)
    await refresh()
  }
  const publishDue = async () => {
    const result = await sendJson<{ published?: number }>('/api/admin/community/queue/publish-due', 'POST', { limit: 100 })
    setNotice({ kind: 'ok', text: `已发布 ${result?.published ?? 0} 条到期内容。` })
    await refresh()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      const list: Array<{ id: string }> = view === 'reports' ? openReports : queue
      const current = view === 'reports' ? report : item
      const index = current ? list.findIndex((x) => x.id === current.id) : -1
      if (e.key === 'j' && list[index + 1]) set({ id: list[index + 1].id })
      if (e.key === 'k' && index > 0) set({ id: list[index - 1].id })
      if (view === 'queue' && item && e.key === 'a') setDialog('approve')
      if (view === 'queue' && item && e.key === 'r') setDialog('reject')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, view, queue, openReports, item, report, set])

  const c = item ? content(item) : null
  const oldestDraft = (drafts.data ?? []).map((q) => q.createdAt).sort()[0]
  const oldestReport = openReports[0]?.createdAt

  return (
    <>
      <PageTitle title="社区" meta={<span className="flex flex-wrap gap-x-3"><span>内容审核与举报</span><Updated at={drafts.updatedAt} loading={drafts.loading} /></span>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '待审内容', value: drafts.data?.length ?? '—', hint: oldestDraft ? `最早已等 ${waited(oldestDraft, now)}` : '没有待审的' },
          { label: '待处理举报', value: reports.data?.length ?? '—', hint: oldestReport ? `最早已等 ${waited(oldestReport, now)}` : '没有新举报', tone: (reports.data?.length ?? 0) > 0 ? 'warn' : undefined },
          { label: '近 24 小时新帖', value: stats.data?.postsLast24h ?? '—', hint: stats.data ? `共 ${stats.data.posts} 帖 · ${stats.data.profiles} 位用户` : undefined },
        ]} />
        <SideCard label="待审内容一次处理" value={`${drafts.data?.length ?? 0} 条`}
          action={<WhiteButton disabled={!(drafts.data?.length)} onClick={() => setDialog('approveAll')}>全部通过</WhiteButton>}>
          <p className="mt-3 text-[13px] text-ops-muted">逐条看完再用。通过的内容按各自的计划时间发布。</p>
        </SideCard>
      </div>
      <div className="h-6" />
      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
      {(drafts.error || reports.error) && <Notice kind="error">{drafts.error || reports.error}</Notice>}
      <div className="h-4" />

      <Board
        title={view === 'queue' ? '待审内容' : view === 'reports' ? '举报' : view === 'approved' ? '已通过，待发布' : '已发布'}
        tabs={[{ key: 'queue', label: '待审', count: drafts.data?.length ?? 0 }, { key: 'reports', label: '举报', count: reports.data?.length ?? 0 }, { key: 'approved', label: '待发布' }, { key: 'published', label: '已发布' }]}
        active={view} onTab={(k) => set({ tab: k, id: null })}
        tools={view === 'approved' ? <OutlineButton className="!border-ops-rule !text-ops-ink hover:!bg-[#F4F5F7]" onClick={() => setDialog('publishDue')}>发布已到时间的</OutlineButton> : view === 'queue' ? <span className="hidden text-[12px] text-ops-sub sm:inline">J / K 上下 · A 通过 · R 驳回</span> : undefined}
      >
        {view === 'published' ? <div className="p-2"><CommunityPublications /></div> : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <ul className={cn('flex flex-col gap-1', id && 'hidden lg:flex')}>
              {view !== 'reports' && queue.map((q) => {
                const on = item?.id === q.id
                const qc = content(q)
                return (
                  <li key={q.id}>
                    <button type="button" onClick={() => set({ id: q.id })} className={cn('flex w-full items-center gap-3 rounded-[22px] py-2.5 pl-2.5 pr-4 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                      <Face id={persona(q)} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{qc.title ?? qc.text ?? '（没有文字）'}</span>
                        <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{persona(q)} · {KIND_TEXT[q.kind] ?? q.kind} · {q.scheduledFor ? (Date.parse(q.scheduledFor) > now ? `计划 ${sgTime(q.scheduledFor).slice(5, 16)}` : '已到发布时间') : `已等 ${waited(q.createdAt, now)}`}</span>
                      </span>
                      {qc.images.length > 0 && <Chip on={on}>{qc.images.length} 图</Chip>}
                    </button>
                  </li>
                )
              })}
              {view === 'reports' && openReports.map((r) => {
                const on = report?.id === r.id
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => set({ id: r.id })} className={cn('flex w-full items-center gap-3 rounded-[22px] py-2.5 pl-4 pr-4 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{r.reason || '没有写理由'}</span>
                        <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{TARGET_TEXT[r.targetType] ?? r.targetType} · 已等 {waited(r.createdAt, now)}</span>
                      </span>
                      <Chip on={on} tone="warn">待处理</Chip>
                    </button>
                  </li>
                )
              })}
              {((view === 'reports' && !openReports.length && !reports.loading) || (view !== 'reports' && !queue.length && !(view === 'approved' ? approved.loading : drafts.loading))) && (
                <li className="px-4 py-12 text-center text-[14px] text-ops-sub">{view === 'reports' ? '没有待处理的举报。' : view === 'approved' ? '没有等待发布的内容。' : '没有待审的内容。'}</li>
              )}
            </ul>

            {item && c && view !== 'reports' ? (
              <article className={cn('flex flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6', !id && 'hidden lg:flex')}>
                <button type="button" onClick={() => set({ id: null })} className="mb-2 self-start text-[13px] text-ops-muted lg:hidden">← 返回列表</button>
                <div className="flex items-center gap-3">
                  <Face id={persona(item)} size={44} />
                  <div className="min-w-0"><div className="truncate text-[16px]">{persona(item)}</div><div className="text-[12px] text-ops-muted">{KIND_TEXT[item.kind] ?? item.kind}{c.lang ? ` · ${c.lang}` : ''} · {item.scheduledFor ? `计划发布 ${sgTime(item.scheduledFor)}` : `${ago(item.createdAt)}生成`}</div></div>
                </div>
                {c.title && <h3 className="mt-5 text-[20px] leading-snug">{c.title}</h3>}
                {c.text ? <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ops-text/90">{c.text}</p> : <pre className="mt-3 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-[18px] bg-ops-card p-4 text-[12px] text-ops-muted">{JSON.stringify(c.raw, null, 2)}</pre>}
                {c.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.images.map((src) => <img key={src} src={src} alt="" className="aspect-square w-full rounded-[14px] object-cover" />)}
                  </div>
                )}
                {item.reviewNote && <p className="mt-4 text-[13px] text-ops-muted">审核备注：{item.reviewNote}</p>}
                {view === 'queue' && (
                  <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
                    <DangerButton onClick={() => setDialog('reject')}>驳回</DangerButton>
                    <LimeButton onClick={() => setDialog('approve')}>通过</LimeButton>
                  </div>
                )}
              </article>
            ) : report && view === 'reports' ? (
              <article className={cn('flex flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6', !id && 'hidden lg:flex')}>
                <button type="button" onClick={() => set({ id: null })} className="mb-2 self-start text-[13px] text-ops-muted lg:hidden">← 返回列表</button>
                <div className="text-[13px] text-ops-muted">举报 · {ago(report.createdAt)}</div>
                <h3 className="mt-1 text-[24px] leading-snug">{report.reason || '没有写理由'}</h3>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Tile label="被举报的" value={TARGET_TEXT[report.targetType] ?? report.targetType} />
                  <Tile label="对象编号" value={<span className="break-all font-mono text-[13px]">{report.targetId}</span>} />
                </div>
                <p className="mt-4 text-[13px] text-ops-muted">要删除内容，请在「已发布」里找到它再处理；这里只记录举报的结果。</p>
                <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
                  <DangerButton onClick={() => setDialog('dismissed')}>忽略</DangerButton>
                  <LimeButton onClick={() => setDialog('reviewed')}>已处理</LimeButton>
                </div>
              </article>
            ) : <div className="hidden min-h-[320px] items-center justify-center rounded-[24px] bg-ops-bg text-[14px] text-ops-muted lg:flex">选一条查看</div>}
          </div>
        )}
      </Board>

      <Confirm open={dialog === 'approve'} onClose={() => setDialog(null)} title="通过这条内容？" confirmLabel="通过" rows={item ? [{ label: '人设', value: persona(item) }, { label: '计划发布', value: item.scheduledFor ? sgTime(item.scheduledFor) : '尽快' }] : []} onConfirm={() => review('approve')} />
      <Confirm open={dialog === 'reject'} onClose={() => setDialog(null)} title="驳回这条内容？" danger confirmLabel="驳回" note="驳回后不会发布。" onConfirm={() => review('reject')}>
        <div className="mt-4 flex flex-wrap gap-2">{REJECT_REASONS.map((r) => <button key={r} type="button" onClick={() => setNote(r)} className={cn('rounded-full border px-3 py-1.5 text-[13px]', note === r ? 'border-ops-lime bg-ops-lime text-ops-ink' : 'border-ops-line text-ops-text hover:bg-ops-card')}>{r}</button>)}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" rows={2} className="mt-3 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
      </Confirm>
      <Confirm open={dialog === 'approveAll'} onClose={() => setDialog(null)} title={`通过全部 ${drafts.data?.length ?? 0} 条？`} confirmLabel={`通过 ${drafts.data?.length ?? 0} 条`}
        note="每条按自己的计划时间发布。建议先逐条看过再全部通过。" typeToConfirm={String(drafts.data?.length ?? 0)} typeLabel={`请输入条数 ${drafts.data?.length ?? 0} 确认`} onConfirm={approveAll} />
      <Confirm open={dialog === 'reviewed'} onClose={() => setDialog(null)} title="标记为已处理？" confirmLabel="已处理" note="表示你已经处理了被举报的内容。" onConfirm={() => resolve('reviewed')} />
      <Confirm open={dialog === 'dismissed'} onClose={() => setDialog(null)} title="忽略这条举报？" danger confirmLabel="忽略" note="被举报的内容保持不变。" onConfirm={() => resolve('dismissed')} />
      <Confirm open={dialog === 'publishDue'} onClose={() => setDialog(null)} title="发布已到时间的内容？" confirmLabel="发布" note="只发布计划时间已经到了的、已通过的内容，最多 100 条。" onConfirm={publishDue} />
    </>
  )
}

export default function CommunityPage() {
  return <AppShell><Suspense fallback={null}><Workspace /></Suspense></AppShell>
}
