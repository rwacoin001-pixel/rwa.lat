'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, Check, Copy, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { Confirm } from '@/components/ops/Confirm'
import { sendJson, usePolled, useToday } from '@/components/ops/data'
import { WAIT_BUCKETS, ago, money, networkLabel, sgTime, shortAddress, waitBucket, waited } from '@/components/ops/format'
import { BigStatCard, Board, Chip, CircleButton, DangerButton, Face, FilterBar, LimeButton, Money, Notice, OutlineButton, PageTitle, SearchPill, SegmentTimeline, SelectPill, SideCard, Tile, Updated, WhiteButton } from '@/components/ops/ui'

type Raw = {
  id: string; userId: string; userEmail?: string | null; network: string; assetCode: string; atomicAmount: string; feeAtomicAmount: string
  destination: string; state: string; requestedAt: string; approvedAt?: string | null; completedAt?: string | null; transactionHash?: string | null; reasonCode?: string | null
}
type Signal = { code: string; level: 'info' | 'warn' | 'high'; message: string }
type Context = {
  user: { id: string; email: string; accountAgeDays: number; kycState: string; availableAtomic: string; totalDepositedAtomic: string; totalWithdrawnAtomic: string; withdrawalCount: number; lastLoginAt?: string | null; lastLoginCountry?: string | null }
  address: { firstUsedByThisUser: boolean; previousWithdrawalsToAddress: number; otherAccountsUsingAddress: number; whitelisted: boolean }
  recentSecurity: { passwordChangedWithin24h: boolean; newDeviceWithin24h: boolean; twoFactorChangedWithin24h: boolean }
  signals: Signal[]
}
type AuditRow = { id: string; occurredAt: string; actorType: string; action: string; reasonCode?: string | null }
type Funds = { hotWallet: { usdtAtomic: string | null; error: string | null; checkedAt: string | null } }
type Switch = {
  current: { enabled: boolean; reason: string | null; updatedAt: string | null } | null
  pending: Array<{ id: string; changeId: string; requestedAt: string; reason: string }>
  environmentAllowsExecution: boolean
}
type SwitchDialog = 'pause' | 'resume' | { approve: string } | { reject: string } | null
const SWITCH_URL = '/api/admin/operations/funds/withdrawal-execution'
const CHANGE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$/

const VIEWS = { review: ['risk_review'], approved: ['approved'], all: [] as string[] } as const
type View = keyof typeof VIEWS
const STATE_TEXT: Record<string, string> = { risk_review: '待审', approved: '待执行', signing: '签名中', broadcast: '已广播', confirming: '确认中', completed: '已到账', rejected: '已拒绝', failed: '失败', cancelled: '已取消' }
const ACTION_TEXT: Record<string, string> = { 'withdrawal.requested': '用户发起提现', 'withdrawal.approved': '审核通过', 'withdrawal.rejected': '已拒绝', 'withdrawal.broadcast': '已提交链上广播', 'withdrawal.completed': '已到账' }
const KYC_TEXT: Record<string, string> = { approved: '已通过', pending: '审核中', rejected: '未通过', none: '未提交' }
const REASONS = ['地址与身份不符', '需要补充 KYC 资料', '地址与其他账户共用，可疑', '用户要求取消', '金额异常，需要人工核实']
/** Withdrawals at or above this amount need the amount typed again before approving or broadcasting. */
const LARGE_ATOMIC = BigInt(1000) * BigInt(1000000)
const DECIMALS = 6

function useUrlState() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const set = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [params, router, pathname])
  return { params, set }
}

function Workspace() {
  const { params, set } = useUrlState()
  const view = (params.get('view') as View) in VIEWS ? (params.get('view') as View) : 'review'
  const q = params.get('q') ?? ''
  const network = params.get('network') ?? ''
  const selectedId = params.get('id')
  const list = usePolled<Raw[]>('/api/admin/wallet/withdrawals?limit=200')
  const funds = usePolled<Funds>('/api/admin/console/funds?days=1', 60_000)
  const execution = usePolled<Switch>(SWITCH_URL, 60_000)
  const [switchDialog, setSwitchDialog] = useState<SwitchDialog>(null)
  const [switchReason, setSwitchReason] = useState('')
  const [changeId, setChangeId] = useState('')
  const { reload: reloadToday } = useToday()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t) }, [])
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'execute' | null>(null)
  const [reason, setReason] = useState('')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => {
    const all = list.data ?? []
    const term = q.trim().toLowerCase()
    return all
      .filter((w) => !VIEWS[view].length || (VIEWS[view] as readonly string[]).includes(w.state))
      .filter((w) => !network || w.network === network)
      .filter((w) => !term || [w.id, w.userId, w.userEmail ?? '', w.destination, w.transactionHash ?? ''].some((v) => v.toLowerCase().includes(term)))
      .sort((a, b) => (view === 'all' ? b.requestedAt.localeCompare(a.requestedAt) : a.requestedAt.localeCompare(b.requestedAt)))
  }, [list.data, view, network, q])
  const counts = useMemo(() => ({
    review: (list.data ?? []).filter((w) => w.state === 'risk_review').length,
    approved: (list.data ?? []).filter((w) => w.state === 'approved').length,
  }), [list.data])

  const selected = rows.find((w) => w.id === selectedId) ?? rows[0] ?? null
  const ctx = usePolled<Context>(selected ? `/api/admin/wallet/withdrawals/${selected.id}/context` : null, 0)
  const audit = usePolled<AuditRow[]>(selected && timelineOpen ? `/api/admin/audit?objectId=${encodeURIComponent(selected.id)}&limit=30` : null, 0)
  useEffect(() => { setTimelineOpen(false); setCopied(false) }, [selected?.id])

  const pendingReview = (list.data ?? []).filter((w) => w.state === 'risk_review')
  const pendingExecute = (list.data ?? []).filter((w) => w.state === 'approved')
  const sum = (ws: Raw[]) => ws.reduce((n, w) => n + BigInt(w.atomicAmount), BigInt(0))
  const reviewed = (list.data ?? []).filter((w) => w.approvedAt).slice(0, 50)
  const avgMinutes = reviewed.length ? Math.round(reviewed.reduce((n, w) => n + (Date.parse(w.approvedAt!) - Date.parse(w.requestedAt)), 0) / reviewed.length / 60000) : null
  const segments = WAIT_BUCKETS.map((b, i) => {
    const inBucket = pendingReview.filter((w) => waitBucket(w.requestedAt, now) === i)
    return { label: b.label, count: inBucket.length, share: inBucket.length, faces: inBucket.map((w) => w.userId), tone: i >= 3 ? 'down' as const : i === 2 ? 'warn' as const : 'lime' as const }
  })
  const networks = Array.from(new Set((list.data ?? []).map((w) => w.network)))
  const hot = funds.data?.hotWallet
  const hotShort = hot?.usdtAtomic != null && BigInt(hot.usdtAtomic) < sum(pendingExecute)

  const moveAfter = useCallback((doneId: string) => {
    const index = rows.findIndex((w) => w.id === doneId)
    const next = rows[index + 1] ?? rows[index - 1]
    set({ id: next && next.id !== doneId ? next.id : null })
  }, [rows, set])

  const act = async (kind: 'approve' | 'reject' | 'execute') => {
    if (!selected) return
    const base = `/api/admin/wallet/withdrawals/${selected.id}`
    if (kind === 'approve') await sendJson(`${base}/approve`, 'PUT', {})
    if (kind === 'reject') {
      if (reason.trim().length < 3) throw new Error('请写明拒绝原因（至少 3 个字）。')
      await sendJson(`${base}/reject`, 'PUT', { reasonCode: reason.trim() })
    }
    if (kind === 'execute') await sendJson(`${base}/execute`, 'POST')
    const amount = `${money(selected.atomicAmount)} USDT`
    setNotice({ kind: 'ok', text: kind === 'approve' ? `已通过 ${amount}，进入待执行。` : kind === 'reject' ? `已拒绝 ${amount}，锁定的资金退回用户可用余额。` : `已提交链上广播 ${amount}。` })
    moveAfter(selected.id)
    setReason('')
    await list.reload()
    void reloadToday()
  }

  // Keyboard: J/K move, A approve, R reject, E execute. Ignored while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || switchDialog || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const index = selected ? rows.findIndex((w) => w.id === selected.id) : -1
      if (e.key === 'j' && rows[index + 1]) set({ id: rows[index + 1].id })
      if (e.key === 'k' && index > 0) set({ id: rows[index - 1].id })
      if (e.key === 'a' && selected?.state === 'risk_review') setDialog('approve')
      if (e.key === 'r' && selected?.state === 'risk_review') setDialog('reject')
      if (e.key === 'e' && selected?.state === 'approved') setDialog('execute')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, switchDialog, rows, selected, set])

  const paused = execution.data?.current ? !execution.data.current.enabled : false
  const runSwitch = async () => {
    const d = switchDialog
    if (d === 'pause') {
      if (switchReason.trim().length < 3) throw new Error('请写明暂停原因（至少 3 个字）。')
      await sendJson(`${SWITCH_URL}/pause`, 'POST', { reason: switchReason.trim() })
      setNotice({ kind: 'ok', text: '提现执行已暂停。审核照常，广播会被拦住。' })
    } else if (d === 'resume') {
      if (!CHANGE_ID.test(changeId.trim())) throw new Error('变更单号格式不对：字母或数字开头，3 到 120 位。')
      if (switchReason.trim().length < 3) throw new Error('请写明恢复原因（至少 3 个字）。')
      await sendJson(`${SWITCH_URL}/resume-requests`, 'POST', { changeId: changeId.trim(), reason: switchReason.trim() })
      setNotice({ kind: 'ok', text: '已提交恢复申请，批准后才恢复执行。' })
    } else if (d && 'approve' in d) {
      await sendJson(`${SWITCH_URL}/resume-requests/${d.approve}/approve`, 'PUT')
      setNotice({ kind: 'ok', text: '已批准，提现执行恢复。' })
    } else if (d && 'reject' in d) {
      await sendJson(`${SWITCH_URL}/resume-requests/${d.reject}/reject`, 'PUT')
      setNotice({ kind: 'ok', text: '已拒绝这份恢复申请。' })
    }
    setSwitchReason('')
    setChangeId('')
    await execution.reload()
    void reloadToday()
  }
  const filters = (network ? 1 : 0) + (q ? 1 : 0)
  const signals = ctx.data?.signals ?? []
  const high = signals.filter((s) => s.level === 'high').length
  const warn = signals.filter((s) => s.level === 'warn').length
  const large = selected ? BigInt(selected.atomicAmount) >= LARGE_ATOMIC : false
  const net = selected ? BigInt(selected.atomicAmount) - BigInt(selected.feeAtomicAmount || '0') : BigInt(0)

  return (
    <>
      <PageTitle
        title="提现"
        meta={<span className="flex flex-wrap gap-x-3"><span>审核后进入待执行，执行即链上广播</span><Updated at={list.updatedAt} loading={list.loading} /></span>}
        actions={<>
          <OutlineButton href="/withdrawal-whitelist">白名单</OutlineButton>
          {execution.data && (paused
            ? <OutlineButton onClick={() => setSwitchDialog('resume')}>申请恢复执行</OutlineButton>
            : <DangerButton onClick={() => setSwitchDialog('pause')}>暂停执行</DangerButton>)}
        </>}
      />
      {paused && <Notice kind="error">提现执行已暂停{execution.data?.current?.reason ? `：${execution.data.current.reason}` : ''}。审核照常，广播会被拦住。</Notice>}
      {execution.data && !execution.data.environmentAllowsExecution && <Notice kind="error">当前环境不允许执行提现广播，只能审核。</Notice>}
      {(execution.data?.pending.length ?? 0) > 0 && (
        <div className="mb-4 rounded-[22px] border border-ops-line bg-ops-card p-4">
          <div className="text-[13px] text-ops-muted">待批准的恢复申请</div>
          {execution.data!.pending.map((r) => (
            <div key={r.id} className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
              <span className="font-mono text-[13px]">{r.changeId}</span>
              <span className="min-w-0 flex-1 text-ops-muted" title={sgTime(r.requestedAt)}>{r.reason} · {ago(r.requestedAt)}</span>
              <DangerButton onClick={() => setSwitchDialog({ reject: r.id })}>拒绝</DangerButton>
              <LimeButton onClick={() => setSwitchDialog({ approve: r.id })}>批准恢复</LimeButton>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '待审金额', value: <Money atomic={String(sum(pendingReview))} unit="USDT" />, hint: `${pendingReview.length} 笔 · 最早已等 ${pendingReview.length ? waited(pendingReview.map((w) => w.requestedAt).sort()[0], now) : '—'}` },
          { label: '待执行', value: <Money atomic={String(sum(pendingExecute))} unit="USDT" />, hint: `${pendingExecute.length} 笔已通过、未广播` },
          { label: '平均审核用时', value: avgMinutes === null ? '—' : <>{avgMinutes}<span className="ml-1 text-[0.5em] text-ops-muted">分钟</span></>, hint: `最近 ${reviewed.length} 笔` },
        ]}>
          <div className="mb-3 text-[12px] text-ops-muted">待审 · 按已等待时间</div>
          <SegmentTimeline segments={segments} />
        </BigStatCard>
        <SideCard
          label="热钱包可用 USDT"
          value={<Money atomic={hot?.usdtAtomic ?? null} />}
          badge={hot?.error ? '查询失败' : hot?.checkedAt ? ago(hot.checkedAt) : undefined}
          chips={networks.map((n) => ({ key: n, label: networkLabel(n), sub: `${pendingExecute.filter((w) => w.network === n).length} 笔待执行`, active: network === n, onClick: () => set({ network: network === n ? null : n, id: null }) }))}
          action={<WhiteButton onClick={() => set({ view: 'approved', id: null })}>去执行</WhiteButton>}
        >
          {paused && <p className="mt-3 text-[13px] text-ops-down">执行已暂停，广播会被拦住。</p>}
          {hotShort &&<p className="mt-3 text-[13px] text-ops-warn">余额少于待执行的总额，执行前请先补充热钱包。</p>}
        </SideCard>
      </div>

      <FilterBar active={filters} onClear={() => set({ network: null, q: null, id: null })}>
        <SelectPill value={network} onChange={(v) => set({ network: v || null, id: null })} placeholder="全部网络" options={networks.map((n) => ({ value: n, label: networkLabel(n) }))} />
        <SearchPill value={q} onChange={(v) => set({ q: v || null, id: null })} placeholder="搜索提现编号、用户、地址或交易哈希" />
      </FilterBar>
      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
      {list.error && <Notice kind="error">{list.error}</Notice>}

      <div className="h-4" />
      <Board
        title={view === 'review' ? '待审提现' : view === 'approved' ? '待执行提现' : '全部提现'}
        tabs={[{ key: 'review', label: '待审', count: counts.review }, { key: 'approved', label: '待执行', count: counts.approved }, { key: 'all', label: '全部' }]}
        active={view}
        onTab={(k) => set({ view: k, id: null })}
        tools={<span className="hidden text-[12px] text-ops-sub sm:inline">J / K 上下 · A 通过 · R 拒绝 · E 执行</span>}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <ul className={cn('flex flex-col gap-1', selectedId && 'hidden lg:flex')}>
            {rows.map((w) => {
              const on = selected?.id === w.id
              return (
                <li key={w.id}>
                  <button type="button" onClick={() => set({ id: w.id })} className={cn('flex w-full items-center gap-3 rounded-full py-2.5 pl-2.5 pr-5 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                    <Face id={w.userId} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{w.userEmail || shortAddress(w.userId, 8, 4)}</span>
                      <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{w.state === 'risk_review' || w.state === 'approved' ? `已等 ${waited(w.requestedAt, now)}` : ago(w.requestedAt)} · {networkLabel(w.network)}</span>
                    </span>
                    <Chip on={on} tone={w.state === 'risk_review' ? 'warn' : w.state === 'approved' ? 'lime' : w.state === 'rejected' || w.state === 'failed' ? 'down' : 'plain'}>{STATE_TEXT[w.state] ?? w.state}</Chip>
                    <Money atomic={w.atomicAmount} className="w-[110px] text-right text-[16px]" />
                  </button>
                </li>
              )
            })}
            {!rows.length && !list.loading && <li className="px-4 py-12 text-center text-[14px] text-ops-sub">{view === 'review' ? '没有待审的提现。' : view === 'approved' ? '没有待执行的提现。' : '没有符合条件的提现。'}</li>}
          </ul>

          {selected ? (
            <article className={cn('flex flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6', !selectedId && 'hidden lg:flex')}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <button type="button" onClick={() => set({ id: null })} className="mb-2 text-[13px] text-ops-muted lg:hidden">← 返回列表</button>
                  <div className="text-[13px] text-ops-muted">提现金额 · {networkLabel(selected.network)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[30px] font-normal leading-none tracking-[-0.02em] tabular-nums"><Money atomic={selected.atomicAmount} unit="USDT" /></span>
                    <Chip on>{STATE_TEXT[selected.state] ?? selected.state}</Chip>
                  </div>
                  <div className="mt-2 text-[12px] text-ops-muted" title={sgTime(selected.requestedAt)}>编号 {selected.id} · {ago(selected.requestedAt)}发起</div>
                </div>
                <a href={`/users?q=${encodeURIComponent(ctx.data?.user.email ?? selected.userId)}`} className="flex min-w-0 items-center gap-3 rounded-full border border-ops-line py-1.5 pl-1.5 pr-4 hover:bg-ops-raised">
                  <Face id={selected.userId} size={40} />
                  <span className="min-w-0">
                    <span className="block max-w-[180px] truncate text-[14px]">{ctx.data?.user.email ?? selected.userEmail ?? shortAddress(selected.userId, 8, 4)}</span>
                    <span className="block text-[12px] text-ops-muted">{ctx.data ? `注册 ${ctx.data.user.accountAgeDays} 天 · KYC ${KYC_TEXT[ctx.data.user.kycState] ?? ctx.data.user.kycState}` : '读取中…'}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-ops-muted" />
                </a>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Tile label="收款地址" tone={ctx.data ? (ctx.data.address.otherAccountsUsingAddress > 0 ? 'down' : ctx.data.address.firstUsedByThisUser ? 'warn' : 'ok') : undefined}
                  value={<span className="font-mono text-[15px]">{shortAddress(selected.destination, 6, 6)}</span>}>
                  <div className="mt-1 text-[12px] text-ops-muted">{ctx.data ? (ctx.data.address.otherAccountsUsingAddress > 0 ? `另有 ${ctx.data.address.otherAccountsUsingAddress} 个账户用过` : ctx.data.address.firstUsedByThisUser ? '第一次使用' : `用过 ${ctx.data.address.previousWithdrawalsToAddress} 次`) + (ctx.data.address.whitelisted ? ' · 白名单' : '') : ''}</div>
                </Tile>
                <Tile label="累计充值 / 已提现" tone={signals.some((s) => s.code === 'large_vs_deposits') ? 'warn' : 'ok'}
                  value={ctx.data ? <span>{money(ctx.data.user.totalDepositedAtomic, DECIMALS, 0)}<span className="text-ops-muted"> / {money(ctx.data.user.totalWithdrawnAtomic, DECIMALS, 0)}</span></span> : '—'}>
                  <div className="mt-1 text-[12px] text-ops-muted">{ctx.data ? `完成提现 ${ctx.data.user.withdrawalCount} 次` : ''}</div>
                </Tile>
                <Tile label="风险信号" tone={high ? 'down' : warn ? 'warn' : 'ok'} value={ctx.data ? (signals.length ? `${signals.length} 条需要注意` : '正常') : ctx.error ? '读取失败' : '—'}>
                  <div className="mt-1 text-[12px] text-ops-muted">{ctx.data?.user.lastLoginAt ? `最近登录 ${ago(ctx.data.user.lastLoginAt)}${ctx.data.user.lastLoginCountry ? ' · ' + ctx.data.user.lastLoginCountry : ''}` : ''}</div>
                </Tile>
              </div>
              {signals.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {signals.map((s) => <li key={s.code} className={cn('rounded-full border px-3 py-1 text-[12px]', s.level === 'high' ? 'border-ops-down/50 text-ops-down' : s.level === 'warn' ? 'border-ops-warn/40 text-ops-warn' : 'border-ops-line text-ops-muted')}>{s.message}</li>)}
                </ul>
              )}
              {ctx.error && <p className="mt-3 text-[13px] text-ops-down">风险背景读取失败：{ctx.error}</p>}

              {timelineOpen && (
                <ol className="mt-5 space-y-3 border-l border-ops-line pl-4">
                  {(audit.data ?? []).map((a) => (
                    <li key={a.id} className="relative text-[13px]">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ops-lime" />
                      <span className="text-ops-text">{ACTION_TEXT[a.action] ?? a.action}</span>
                      {a.reasonCode && <span className="text-ops-muted"> · {a.reasonCode}</span>}
                      <span className="block text-[12px] text-ops-muted" title={sgTime(a.occurredAt)}>{a.actorType === 'admin' ? '管理员' : a.actorType === 'user' ? '用户' : a.actorType} · {ago(a.occurredAt)}</span>
                    </li>
                  ))}
                  {audit.loading && <li className="text-[13px] text-ops-muted">读取中…</li>}
                  {!audit.loading && !audit.data?.length && <li className="text-[13px] text-ops-muted">没有记录。</li>}
                </ol>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[22px] border border-ops-line bg-ops-card p-3 pl-5">
                <dl className="grid flex-1 grid-cols-3 gap-4">
                  <div><dt className="text-[11px] text-ops-muted">金额</dt><dd className="text-[16px] tabular-nums"><Money atomic={selected.atomicAmount} /></dd></div>
                  <div><dt className="text-[11px] text-ops-muted">手续费</dt><dd className="text-[16px] tabular-nums"><Money atomic={selected.feeAtomicAmount} /></dd></div>
                  <div><dt className="text-[11px] text-ops-muted">实际到账</dt><dd className="text-[16px] tabular-nums"><Money atomic={String(net)} /></dd></div>
                </dl>
                <div className="flex items-center gap-2">
                  <CircleButton label={copied ? '已复制' : '复制地址'} onClick={() => { void navigator.clipboard.writeText(selected.destination); setCopied(true) }}>{copied ? <Check className="h-4 w-4 text-ops-lime" /> : <Copy className="h-4 w-4" />}</CircleButton>
                  <CircleButton label="时间线" active={timelineOpen} onClick={() => setTimelineOpen((v) => !v)}><History className="h-4 w-4" /></CircleButton>
                  {selected.state === 'risk_review' && <>
                    <DangerButton onClick={() => setDialog('reject')}>拒绝</DangerButton>
                    <LimeButton onClick={() => setDialog('approve')}>通过</LimeButton>
                  </>}
                  {selected.state === 'approved' && <LimeButton onClick={() => setDialog('execute')}>广播</LimeButton>}
                </div>
              </div>
            </article>
          ) : (
            <div className="hidden min-h-[320px] items-center justify-center rounded-[24px] bg-ops-bg text-[14px] text-ops-muted lg:flex">选一笔提现查看详情</div>
          )}
        </div>
      </Board>

      {selected && <>
        <Confirm open={dialog === 'approve'} onClose={() => setDialog(null)} title="通过这笔提现？" confirmLabel={`通过 ${money(selected.atomicAmount)} USDT`}
          rows={[{ label: '金额', value: `${money(selected.atomicAmount)} USDT`, strong: true }, { label: '用户', value: ctx.data?.user.email ?? selected.userId }, { label: '地址', value: <span className="font-mono text-[13px]">{selected.destination}</span> }, { label: '网络', value: networkLabel(selected.network) }]}
          note={signals.length ? `这笔提现有 ${signals.length} 条风险信号：${signals.map((s) => s.message).join('、')}。` : '通过后进入待执行，广播前还会再确认一次。'}
          typeToConfirm={large ? money(selected.atomicAmount) : undefined} typeLabel={large ? `金额较大，请输入 ${money(selected.atomicAmount)} 确认` : undefined}
          onConfirm={() => act('approve')} />
        <Confirm open={dialog === 'reject'} onClose={() => setDialog(null)} title="拒绝这笔提现？" danger confirmLabel="拒绝并退回资金" disabled={reason.trim().length < 3}
          rows={[{ label: '金额', value: `${money(selected.atomicAmount)} USDT`, strong: true }, { label: '用户', value: ctx.data?.user.email ?? selected.userId }]}
          note="锁定的资金会退回用户的可用余额。原因会记录在审计日志里。"
          onConfirm={() => act('reject')}>
          <div className="mt-4 flex flex-wrap gap-2">
            {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full border px-3 py-1.5 text-[13px]', reason === r ? 'border-ops-lime bg-ops-lime text-ops-ink' : 'border-ops-line text-ops-text hover:bg-ops-card')}>{r}</button>)}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="或者写下原因" rows={2} className="mt-3 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
        </Confirm>
        <Confirm open={dialog === 'execute'} onClose={() => setDialog(null)} title="广播到链上？" confirmLabel={`广播 ${money(selected.atomicAmount)} USDT 到 ${shortAddress(selected.destination, 4, 4)}`}
          rows={[{ label: '实际到账', value: `${money(String(net))} USDT`, strong: true }, { label: '地址', value: <span className="font-mono text-[13px]">{selected.destination}</span> }, { label: '网络', value: networkLabel(selected.network) }, { label: '热钱包可用', value: hot?.usdtAtomic ? `${money(hot.usdtAtomic)} USDT` : '—' }]}
          note="广播后无法撤回，链上确认后到账。"
          typeToConfirm={large ? money(selected.atomicAmount) : undefined} typeLabel={large ? `金额较大，请输入 ${money(selected.atomicAmount)} 确认` : undefined}
          onConfirm={() => act('execute')} />
      </>}

      <Confirm open={switchDialog === 'pause'} onClose={() => setSwitchDialog(null)} title="暂停提现执行？" danger confirmLabel="暂停执行" disabled={switchReason.trim().length < 3}
        note="暂停后，已通过的提现不会再广播，审核不受影响。恢复要先提交申请，再批准。" onConfirm={runSwitch}>
        <textarea value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} rows={2} placeholder="暂停原因，例如：热钱包补充中" className="mt-4 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
      </Confirm>
      <Confirm open={switchDialog === 'resume'} onClose={() => setSwitchDialog(null)} title="申请恢复提现执行" confirmLabel="提交申请" disabled={switchReason.trim().length < 3 || !changeId.trim()}
        note="提交后还要批准一次，才会恢复广播。" onConfirm={runSwitch}>
        <input value={changeId} onChange={(e) => setChangeId(e.target.value)} placeholder="变更单号，例如 CHG-20261104-01" autoComplete="off" className="mt-4 h-11 w-full rounded-full border border-ops-line bg-ops-card px-4 font-mono text-[14px] outline-none focus:border-ops-lime" />
        <textarea value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} rows={2} placeholder="恢复原因" className="mt-3 w-full rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
      </Confirm>
      <Confirm open={typeof switchDialog === 'object' && switchDialog !== null && 'approve' in switchDialog} onClose={() => setSwitchDialog(null)} title="批准恢复提现执行？" confirmLabel="批准恢复"
        note="批准后，已通过的提现可以再次广播。" onConfirm={runSwitch} />
      <Confirm open={typeof switchDialog === 'object' && switchDialog !== null && 'reject' in switchDialog} onClose={() => setSwitchDialog(null)} title="拒绝这份恢复申请？" danger confirmLabel="拒绝申请" onConfirm={runSwitch} />
    </>
  )
}

export default function WithdrawalsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}><Workspace /></Suspense>
    </AppShell>
  )
}
