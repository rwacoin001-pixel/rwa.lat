'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { openWork, usePolled, usePolledList, useToday } from '@/components/ops/data'
import { AREA_LABEL, QUEUES, alertText, topPriority, type QueueArea } from '@/components/ops/queues'
import { WAIT_BUCKETS, money, sgDateLabel, waitBucket, waited } from '@/components/ops/format'
import { TrendCard } from '@/components/ops/TrendCard'
import { BigStatCard, Board, Chip, LimeButton, Money, Notice, OutlineButton, PageTitle, SegmentTimeline, SideCard, Updated, WhiteButton } from '@/components/ops/ui'

type RawWithdrawal = { id: string; userId: string; requestedAt: string; atomicAmount: string }

function countdown(cutoffAt: string | undefined, now: number) {
  if (!cutoffAt) return '—'
  const left = Math.round((Date.parse(cutoffAt) - now) / 60000)
  if (left <= 0) return '已过截止'
  return left >= 60 ? `${Math.floor(left / 60)} 小时 ${left % 60} 分` : `${left} 分钟`
}

const QUANT_STEP: Record<string, string> = { none: '未录入', draft: '待确认', approved: '待过账', posted: '已结算' }
/** Nothing due (count 0) or posted: the quant day is done. */
const quantDone = (q: { count: number; state?: string } | undefined) => !q || q.count === 0 || q.state === 'posted'

export default function TodayPage() {
  const { data: today, error, updatedAt, reload } = useToday()
  const pending = usePolledList<RawWithdrawal>('/api/admin/wallet/withdrawals?state=risk_review&limit=200')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t) }, [])
  const [area, setArea] = useState<'all' | QueueArea>('all')
  const [showEmpty, setShowEmpty] = useState(false)
  const [selected, setSelected] = useState<string>('withdrawalReview')

  const work = openWork(today)
  const priority = topPriority(today, now)
  const quant = today?.queues.quantSettlement

  const segments = useMemo(() => WAIT_BUCKETS.map((b, i) => {
    const rows = (pending.data ?? []).filter((w) => waitBucket(w.requestedAt, now) === i)
    return { label: b.label, count: rows.length, share: rows.length, faces: rows.map((r) => r.userId), tone: i >= 3 ? 'down' as const : i === 2 ? 'warn' as const : 'lime' as const }
  }), [pending.data, now])

  const rows = QUEUES.filter((m) => area === 'all' || m.area === area).map((m) => ({ m, s: today?.queues[m.key] }))
  const open = rows.filter(({ s }) => s && (s.status !== 'ok' || s.count > 0))
  const empty = rows.filter(({ s }) => !s || (s.status === 'ok' && s.count === 0))
  const current = QUEUES.find((m) => m.key === selected) ?? QUEUES[0]
  const currentState = today?.queues[current.key]
  const areaCount = (a: QueueArea) => QUEUES.filter((m) => m.area === a).reduce((n, m) => n + (today?.queues[m.key]?.status === 'ok' ? today.queues[m.key].count : 0), 0)

  return (
    <AppShell>
      <PageTitle
        title="今日"
        meta={<span className="flex flex-wrap gap-x-3">{sgDateLabel(now)}<Updated at={updatedAt} loading={!today} /></span>}
        actions={quantDone(quant)
          ? <OutlineButton href="/quant/daily">查看今日结算</OutlineButton>
          : <LimeButton href="/quant/daily">录入今日结算</LimeButton>}
      />
      {error && <Notice kind="error" onClose={() => void reload()}>{error}（点关闭后重试）</Notice>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '待办', value: today ? work : '—', hint: work ? `${open.length} 类事情等你处理` : '都处理完了' },
          { label: '待审提现', value: <Money atomic={today?.queues.withdrawalReview.amountAtomic} unit="USDT" />, hint: today ? `${today.queues.withdrawalReview.count} 笔 · 最早已等 ${waited(today.queues.withdrawalReview.oldestAt, now)}` : undefined },
          { label: '量化结算截止', value: !quant ? '—' : quantDone(quant) ? '已结算' : quant.overdue ? '已过截止' : countdown(quant.cutoffAt ?? undefined, now), tone: quant && !quantDone(quant) && (quant.overdue ? 'down' : quant.cutoffAt && Date.parse(quant.cutoffAt) - now < 7200000 ? 'warn' : undefined) || undefined, hint: quant ? (quantDone(quant) ? `最近结算 ${quant.tradeDate ?? '—'}` : `${quant.tradeDate ?? ''} · ${QUANT_STEP[quant.state ?? 'none']}${quant.count > 1 ? ` · 落后 ${quant.count} 天` : ''}`) : undefined },
        ]}>
          <div className="mb-3 text-[12px] text-ops-muted">待审提现 · 按已等待时间</div>
          <SegmentTimeline segments={segments} />
        </BigStatCard>

        <SideCard
          label={priority ? '现在最该做的事' : '今日净流入'}
          value={priority ? <span className={cn('text-[26px] leading-tight', priority.tone === 'down' && 'text-ops-down')}>{priority.title}</span> : <Money atomic={today?.today.netAtomic} unit="USDT" />}
          action={priority ? <WhiteButton href={priority.href}>{priority.action}<ArrowRight className="h-4 w-4" /></WhiteButton> : undefined}
        >
          <p className="mt-3 text-[14px] text-ops-muted">{priority ? priority.detail : '今天的事都处理完了。'}</p>
        </SideCard>
      </div>

      <div className="h-10" />
      <Board
        tabs={[
          { key: 'all', label: '全部', count: work },
          { key: 'funds', label: AREA_LABEL.funds, count: areaCount('funds') },
          { key: 'care', label: AREA_LABEL.care, count: areaCount('care') },
          { key: 'community', label: AREA_LABEL.community, count: areaCount('community') },
        ]}
        active={area}
        onTab={(k) => setArea(k as typeof area)}
        title="待办"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="flex flex-col gap-1">
            {[...open, ...(showEmpty ? empty : [])].map(({ m, s }) => {
              const on = selected === m.key
              const late = s && s.status === 'ok' && s.oldestAt && (now - Date.parse(s.oldestAt)) / 60000 > m.lateAfter
              return (
                <li key={m.key}>
                  <button type="button" onClick={() => setSelected(m.key)} className={cn('flex w-full items-center gap-3 rounded-full px-4 py-3 text-left transition-colors', on ? 'bg-ops-bg text-ops-text' : 'hover:bg-[#F4F5F7]')}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-medium tabular-nums', on ? 'bg-ops-lime text-ops-ink' : s?.count ? 'bg-ops-ink text-ops-text' : 'bg-[#F0F1F4] text-[#8A909C]')}>{s?.status === 'ok' ? s.count : '—'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{m.label}</span>
                      <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>
                        {s?.status === 'forbidden' ? '没有权限' : s?.status === 'error' ? '读取失败' : s?.oldestAt ? `最早已等 ${waited(s.oldestAt, now)}` : m.key === 'quantSettlement' && s?.state ? QUANT_STEP[s.state] : AREA_LABEL[m.area]}
                      </span>
                    </span>
                    {s?.status === 'error' ? <Chip tone="down" on={on}>读取失败</Chip> : late ? <Chip tone="warn" on={on}>超时</Chip> : null}
                    {s?.amountAtomic && s.amountAtomic !== '0' && <Money atomic={s.amountAtomic} className="w-[110px] text-right text-[15px]" />}
                  </button>
                </li>
              )
            })}
            {!open.length && today && <li className="px-4 py-8 text-center text-[14px] text-ops-sub">这一类都处理完了。</li>}
            {empty.length > 0 && (
              <li>
                <button type="button" onClick={() => setShowEmpty((v) => !v)} className="flex w-full items-center justify-center gap-1 py-3 text-[13px] text-ops-sub hover:text-ops-ink">
                  {showEmpty ? '收起没有待办的' : `还有 ${empty.length} 类没有待办`}<ChevronDown className={cn('h-4 w-4 transition-transform', showEmpty && 'rotate-180')} />
                </button>
              </li>
            )}
          </ul>

          <div className="flex min-h-[320px] flex-col rounded-[24px] bg-ops-bg p-6 text-ops-text">
            <div className="text-[13px] text-ops-muted">{AREA_LABEL[current.area]}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h3 className="text-[28px] font-normal tracking-[-0.02em]">{current.label}</h3>
              {currentState?.status === 'ok' && <Chip on>{currentState.count} 件</Chip>}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-ops-line bg-ops-raised/60 p-4">
                <div className="text-[20px] tabular-nums">{currentState?.oldestAt ? waited(currentState.oldestAt, now) : '—'}</div>
                <div className="mt-2 text-[12px] text-ops-muted">最早一件已等待</div>
              </div>
              <div className="rounded-[18px] border border-ops-line bg-ops-raised/60 p-4">
                <div className="text-[20px] tabular-nums">{currentState?.amountAtomic && currentState.amountAtomic !== '0' ? `${money(currentState.amountAtomic)} USDT` : current.key === 'quantSettlement' ? (quantDone(currentState) ? '已结算' : countdown(currentState?.cutoffAt ?? undefined, now)) : '—'}</div>
                <div className="mt-2 text-[12px] text-ops-muted">{current.key === 'quantSettlement' ? '离截止' : '涉及金额'}</div>
              </div>
            </div>
            {current.key === 'withdrawalReview' && (pending.data?.length ?? 0) > 0 && (
              <ul className="mt-4 divide-y divide-ops-line">
                {pending.data!.slice().sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)).slice(0, 4).map((w) => (
                  <li key={w.id}>
                    <Link href={`/funds/withdrawals?view=review&id=${w.id}`} className="flex items-center justify-between py-2.5 text-[14px] hover:text-ops-lime">
                      <span className="text-ops-muted">已等 {waited(w.requestedAt, now)}</span><Money atomic={w.atomicAmount} unit="USDT" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 pt-6">
              <span className="text-[12px] text-ops-muted">{currentState?.status === 'forbidden' ? '你没有这类事的权限' : currentState?.status === 'error' ? '这一项读取失败，其他数据不受影响' : ''}</span>
              <LimeButton href={current.href}>去处理<ArrowRight className="h-4 w-4" /></LimeButton>
            </div>
          </div>
        </div>
      </Board>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {today && today.today.series.length > 1 && <TrendCard title="近 7 天充值与提现" aLabel="充值" bLabel="提现" points={today.today.series.map((d) => ({ date: d.day, a: d.depositsAtomic, b: d.withdrawalsAtomic }))} />}
        <section className="min-w-0 rounded-[28px] border border-ops-line bg-ops-card p-5 sm:p-6">
          <h2 className="text-[15px] font-medium">今天的数字</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            {([
              ['充值', <Money key="d" atomic={today?.today.deposits?.amountAtomic} />],
              ['提现', <Money key="w" atomic={today?.today.withdrawals?.amountAtomic} />],
              ['净流入', <Money key="n" atomic={today?.today.netAtomic} />],
              ['量化在投', <Money key="q" atomic={today?.today.quantPrincipalAtomic} places={0} />],
              ['活跃用户', today?.today.activeUsers ?? '—'],
              ['新注册', today?.today.registrations ?? '—'],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="text-[12px] text-ops-muted">{k}</dt><dd className="mt-1 text-[20px] tabular-nums">{v}</dd></div>
            ))}
          </dl>
          {(today?.alerts.length ?? 0) > 0 && (
            <div className="mt-6 border-t border-ops-line pt-4">
              <div className="text-[12px] text-ops-muted">需要注意</div>
              <ul className="mt-2 space-y-2">
                {today!.alerts.map((a) => <li key={a.kind} className={cn('text-[13px]', a.severity === 'critical' ? 'text-ops-down' : 'text-ops-warn')}>{alertText(a)}</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
