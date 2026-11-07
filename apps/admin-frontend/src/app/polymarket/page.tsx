'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { type Col, DataTable, PageHeader, Panel, RefreshButton, StatChip, StatusPill, formatDateTime, useApi } from '@/components/console/framework'
import { CloudDownload } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Stats = {
  counts: { markets: number; tokens: number; orders: number; settlements: number }
  watermarks: Array<{
    provider: string
    stream: string
    state: string
    cursor: string | null
    lastEventAt: string | null
    lastSuccessAt: string | null
    consecutiveFailures: number
    lastErrorCode: string | null
    updatedAt: string
  }>
}

type PredictionStats = {
  totals: {
    total: number
    placed: number
    won: number
    lost: number
    void: number
    openStakeAtomic: string
    totalStakeAtomic: string
    paidOutAtomic: string
  }
  settlementRuns: number
  exposureTop: Array<{ marketId: string; question: string; slug: string; openStakeAtomic: string; bets: number }>
  limits: Record<string, string | number>
}

type BetRow = {
  id: string
  userId: string
  status: string
  side: string
  stakeAtomic: string
  shares: string
  price: string
  createdAt: string
  settledAt: string | null
  question: string | null
  slug: string | null
  outcome: string | null
}

type BetList = { total: number; page: number; items: BetRow[] }

type SettlementRow = {
  id: string
  marketId: string
  question: string | null
  slug: string | null
  outcome: string
  betsSettled: number
  totalStakeAtomic: string
  totalPaidAtomic: string
  executedAt: string
}

type SettlementList = { total: number; page: number; items: SettlementRow[] }

function fmtUsdt(atomic: string | null | undefined): string {
  if (!atomic) return '—'
  const n = Number(atomic) / 1e6
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT'
}

function fmtPrice(value: string | null | undefined): string {
  if (!value) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(4)
}

const BET_STATUS: Record<string, string> = {
  placed: '待开奖',
  won: '已赢',
  lost: '未中',
  void: '已退款',
}

type TabKey = 'markets' | 'bets' | 'settlements'
type SettlementMonitor = {
  count: number; overdue: number; failed: number; review: number; waitingResults: number; workerHealthy: boolean; auditHealthy: boolean; reconciliationMismatches: number
  health: { heartbeatAt?: string; lastSuccessAt?: string; auditCheckedAt?: string; audit?: { checkedOrders: number } } | null
  auditIncidents: Array<{ id: string; checkedAt: string; payload: { orderMismatches: number; unbalancedTransactions: number; affectedOrderIds: string[] | null } }>
  jobs: Array<{ id: string; state: string; attempts: number; lastError: string | null; nextRunAt: string; question: string; marketEndAt: string | null; confirmedAt: string | null; payload: { stage: string; lastCheckedAt?: string } }>
}
const settlementStage: Record<string, string> = { waiting_result: '等待官方结果', settling: '等待派彩', settled: '已完成', failed: '自动重试', review: '人工复核' }

export default function PolymarketPage() {
  const stats = useApi<Stats>('/api/admin/console/polymarket/stats')
  const prediction = useApi<PredictionStats>('/api/admin/predictions/stats')
  const monitor = useApi<SettlementMonitor>('/api/admin/predictions/monitor')
  const [retrying, setRetrying] = useState('')
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) monitor.reload() }, 30_000)
    return () => window.clearInterval(timer)
  }, [monitor.reload])
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<TabKey>('markets')
  const [betStatus, setBetStatus] = useState('')
  const [settling, setSettling] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)
  const [settleTarget, setSettleTarget] = useState<PredictionStats['exposureTop'][number] | null>(null)

  const bets = useApi<BetList>(`/api/admin/predictions/bets?limit=50${betStatus ? `&status=${betStatus}` : ''}`)
  const settlements = useApi<SettlementList>('/api/admin/predictions/settlements?limit=50')

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 8000)
  }

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      const response = await fetch(`/api/admin/predictions/monitor/${id}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (!response.ok) throw new Error('重试申请失败，请刷新后再试')
      showNotice('已重新排队，将按正式结果重新核对并处理')
      monitor.reload()
    } catch (error) { showNotice(error instanceof Error ? error.message : '重试失败') }
    finally { setRetrying('') }
  }

  // sync / settle 失败时抛出，由 ConfirmDialog 保持打开并显示错误
  const sync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/polymarket/sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `同步失败 (HTTP ${res.status})`)
      showNotice(`市场同步完成${body && typeof body === 'object' && 'upserted' in body ? `：更新 ${String((body as Record<string, unknown>).upserted)} 个市场` : ''}`)
      stats.reload()
      prediction.reload()
    } finally {
      setSyncing(false)
    }
  }

  const settle = async (marketId: string) => {
    setSettling(marketId)
    try {
      const res = await fetch(`/api/admin/predictions/settle/${marketId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `结算失败 (HTTP ${res.status})`)
      const settled = body?.settled === true ? `已结算 ${body.betsSettled ?? 0} 笔投注` : '该市场尚未开奖或已结算过'
      showNotice(settled)
      prediction.reload()
      settlements.reload()
      bets.reload()
    } finally {
      setSettling('')
    }
  }

  const watermarkColumns: Col<Stats['watermarks'][number]>[] = [
    { key: 'provider', label: '提供方', render: (row) => <span className="font-medium">{row.provider}</span> },
    { key: 'stream', label: '数据流', render: (row) => <span className="font-mono text-xs">{row.stream}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state === 'ok' || row.state === 'idle' ? 'active' : row.state} /> },
    { key: 'cursor', label: '游标', render: (row) => <span className="font-mono text-[11px] text-text-faint">{row.cursor ? `${row.cursor.slice(0, 24)}…` : '—'}</span> },
    { key: 'lastSuccessAt', label: '最近成功', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.lastSuccessAt)}</span> },
    { key: 'consecutiveFailures', label: '连续失败', render: (row) => <span className={row.consecutiveFailures > 0 ? 'text-red-400' : ''}>{row.consecutiveFailures}</span> },
    { key: 'lastErrorCode', label: '最近错误', render: (row) => <span className="font-mono text-[11px] text-text-faint">{row.lastErrorCode || '—'}</span> },
  ]

  const betColumns: Col<BetRow>[] = [
    { key: 'createdAt', label: '时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.createdAt)}</span> },
    { key: 'question', label: '市场', render: (row) => <span className="max-w-[280px] truncate" title={row.question || ''}>{row.question || row.slug || '—'}</span> },
    { key: 'side', label: '方向', render: (row) => <span className="font-medium">{row.outcome || row.side}</span> },
    { key: 'stakeAtomic', label: '投注额', render: (row) => <span className="tabular-nums">{fmtUsdt(row.stakeAtomic)}</span> },
    { key: 'price', label: '成交价', render: (row) => <span className="tabular-nums">{fmtPrice(row.price)}</span> },
    { key: 'status', label: '状态', render: (row) => <StatusPill value={row.status === 'won' ? 'active' : row.status === 'lost' ? 'rejected' : row.status === 'void' ? 'disabled' : 'pending'} /> },
    { key: 'settledAt', label: '结算时间', render: (row) => <span className="text-xs text-text-faint">{row.settledAt ? formatDateTime(row.settledAt) : '—'}</span> },
  ]

  const settleColumns: Col<SettlementRow>[] = [
    { key: 'executedAt', label: '结算时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.executedAt)}</span> },
    { key: 'question', label: '市场', render: (row) => <span className="max-w-[300px] truncate" title={row.question || ''}>{row.question || row.slug || '—'}</span> },
    { key: 'outcome', label: '结果', render: (row) => <span className="font-medium">{row.outcome === 'resolved' ? '正常开奖' : '无效退款'}</span> },
    { key: 'betsSettled', label: '结算笔数', render: (row) => <span className="tabular-nums">{row.betsSettled}</span> },
    { key: 'totalStakeAtomic', label: '本金总额', render: (row) => <span className="tabular-nums">{fmtUsdt(row.totalStakeAtomic)}</span> },
    { key: 'totalPaidAtomic', label: '派彩总额', render: (row) => <span className="tabular-nums">{fmtUsdt(row.totalPaidAtomic)}</span> },
  ]

  const totals = prediction.data?.totals
  const limits = prediction.data?.limits

  return (
    <AdminLayout>
      <PageHeader
        title="预测市场"
        subtitle="内部盘（路线 A）：用户余额投注 · Polymarket 官方开奖自动结算 · 复式记账；外部交易功能保持关闭。"
        actions={<RefreshButton onClick={() => { stats.reload(); prediction.reload(); bets.reload(); settlements.reload(); monitor.reload() }} />}
      />

      {notice && (
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-text-muted">{notice}</div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip label="投注总数" value={totals?.total ?? '…'} sub={`待开奖 ${totals?.placed ?? 0}`} />
        <StatChip label="未结算敞口" value={fmtUsdt(totals?.openStakeAtomic)} sub="平台池风险敞口" />
        <StatChip label="已派彩" value={fmtUsdt(totals?.paidOutAtomic)} sub={`已结算批次 ${prediction.data?.settlementRuns ?? 0}`} />
        <StatChip label="累计投注额" value={fmtUsdt(totals?.totalStakeAtomic)} sub={limits ? `单笔上限 ${Number(limits.maxStakeAtomic) / 1e6} USDT` : ''} />
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">自动结算监控</h2>
        {monitor.data && !monitor.error ? <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatChip label="任务状态" value={monitor.data.workerHealthy ? '运行正常' : '需要检查'} sub={`最近心跳 ${formatDateTime(monitor.data.health?.heartbeatAt)}`} />
            <StatChip label="正式结果已确认" value={monitor.data.count} sub={`超过 5 分钟 ${monitor.data.overdue} 笔`} />
            <StatChip label="待处理任务" value={monitor.data.failed} sub={`其中人工复核 ${monitor.data.review} 个`} />
            <StatChip label="资金对账" value={monitor.data.auditHealthy ? (monitor.data.reconciliationMismatches ? '存在差异' : '核对一致') : '需要检查'} sub={`核对 ${monitor.data.health?.audit?.checkedOrders ?? '—'} 笔 · ${formatDateTime(monitor.data.health?.auditCheckedAt)}`} />
          </div>
          <p className="my-3 text-xs text-text-muted">市场截止后仍可能等待官方结果。只有正式结果通过核对，才进入派彩。任务每分钟运行，对账每 15 分钟更新。</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">市场</th><th>处理状态</th><th>本轮尝试</th><th>结果确认</th><th>最近核对</th><th>下次执行</th><th>操作</th></tr></thead>
            <tbody>{monitor.data.jobs.map(job => <tr key={job.id} className="border-t border-border">
              <td className="max-w-sm py-3 pr-3">{job.question || '市场资料待核对'}<small className="block text-text-muted">截止 {formatDateTime(job.marketEndAt)}</small>{job.lastError && <small className="block text-text-muted">{job.lastError}</small>}</td>
              <td>{job.state === 'dead' ? (job.payload.stage === 'review' ? '人工复核' : '重试已用尽') : job.state === 'running' ? '处理中' : settlementStage[job.payload.stage] ?? job.state}</td>
              <td>{job.attempts}</td><td>{formatDateTime(job.confirmedAt)}</td><td>{formatDateTime(job.payload.lastCheckedAt)}</td><td>{job.state === 'completed' || job.state === 'dead' ? '—' : formatDateTime(job.nextRunAt)}</td>
              <td>{job.state === 'dead' && <button className="underline" disabled={Boolean(retrying)} onClick={() => void retry(job.id)}>{retrying === job.id ? '排队中…' : '重新核对'}</button>}</td>
            </tr>)}</tbody></table></div>
          {monitor.data.auditIncidents.length > 0 && <details className="mt-4 text-sm"><summary>对账异常历史</summary>{monitor.data.auditIncidents.map(issue => <p className="mt-2 break-all" key={issue.id}>{formatDateTime(issue.checkedAt)} · 订单差异 {issue.payload.orderMismatches} · 账本差异 {issue.payload.unbalancedTransactions}{issue.payload.affectedOrderIds?.length ? ` · 订单 ${issue.payload.affectedOrderIds.join('、')}` : ''}</p>)}</details>}
        </> : <p role="status" className="text-sm text-text-muted">{monitor.error ? '结算监控暂不可用，请刷新重试' : '正在读取结算任务…'}</p>}
      </div>
      <div className="mb-4 flex gap-2">
        {([['markets', '市场数据同步'], ['bets', '投注管理'], ['settlements', '结算记录']] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${tab === key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'markets' && (
        <>
          <Panel
            title="市场数据（Gamma API 同步）"
            subtitle="外部市场映射与同步水位；交易功能保持关闭，仅做数据面。"
            actions={
              <button
                onClick={() => setSyncOpen(true)}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-text disabled:opacity-50"
              >
                <CloudDownload size={14} /> {syncing ? '同步中…' : '同步市场'}
              </button>
            }
            className="mb-6"
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatChip label="市场映射" value={stats.data?.counts.markets ?? '…'} />
              <StatChip label="Token 映射" value={stats.data?.counts.tokens ?? '…'} />
              <StatChip label="订单映射" value={stats.data?.counts.orders ?? '…'} />
              <StatChip label="结算映射" value={stats.data?.counts.settlements ?? '…'} />
            </div>
          </Panel>

          <Panel title="同步水位（watermarks）" subtitle="每个数据流的游标推进与失败计数；连续失败会自动退避">
            <DataTable
              columns={watermarkColumns}
              rows={stats.data?.watermarks ?? []}
              loading={stats.loading}
              emptyHint="暂无水位记录"
            />
          </Panel>
        </>
      )}

      {tab === 'bets' && (
        <Panel
          title={`投注列表（${bets.data?.total ?? 0}）`}
          subtitle="用户余额投注流水；每条投注在结算前占用平台敞口"
          actions={
            <select
              value={betStatus}
              onChange={(e) => setBetStatus(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-text-muted"
            >
              <option value="">全部状态</option>
              <option value="placed">待开奖</option>
              <option value="won">已赢</option>
              <option value="lost">未中</option>
              <option value="void">已退款</option>
            </select>
          }
        >
          <DataTable
            columns={betColumns}
            rows={bets.data?.items ?? []}
            loading={bets.loading}
            emptyHint="暂无投注记录"
          />
        </Panel>
      )}

      {tab === 'settlements' && (
        <>
          {prediction.data?.exposureTop && prediction.data.exposureTop.length > 0 && (
            <Panel title="当前敞口（Top 10 市场）" subtitle="待开奖投注的按市场聚合；超过单市场上限会自动暂停收注" className="mb-6">
              <div className="space-y-2">
                {prediction.data.exposureTop.map((row) => (
                  <div key={row.marketId} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm" title={row.question}>{row.question || row.slug}</span>
                    <span className="tabular-nums text-sm text-text-muted">{fmtUsdt(row.openStakeAtomic)} · {row.bets} 笔</span>
                    <button
                      onClick={() => setSettleTarget(row)}
                      disabled={settling === row.marketId}
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
                    >
                      {settling === row.marketId ? '结算中…' : '手动结算'}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title={`结算记录（${settlements.data?.total ?? 0}）`} subtitle="每个市场的结算批次（幂等）；派彩经复式账本入账">
            <DataTable
              columns={settleColumns}
              rows={settlements.data?.items ?? []}
              loading={settlements.loading}
              emptyHint="暂无结算记录（市场开奖后自动生成）"
            />
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        title="同步市场数据"
        description="从 Polymarket Gamma API 同步市场数据。"
        confirmLabel="开始同步"
        onConfirm={sync}
      />
      <ConfirmDialog
        open={settleTarget !== null}
        onOpenChange={(open) => { if (!open) setSettleTarget(null) }}
        title="手动结算该市场"
        description="结算后将按开奖结果派彩（幂等，重复触发安全）。"
        details={settleTarget ? [
          { label: '市场', value: settleTarget.question || settleTarget.slug || '—' },
          { label: '市场 ID', value: settleTarget.marketId, mono: true },
          { label: '待开奖投注', value: `${settleTarget.bets} 笔` },
          { label: '敞口', value: fmtUsdt(settleTarget.openStakeAtomic), emphasis: true },
        ] : []}
        typeToConfirm={settleTarget?.marketId.slice(-6)}
        typeToConfirmLabel={settleTarget ? '请输入市场 ID 的最后 6 位以确认' : undefined}
        confirmLabel="确认结算"
        destructive
        onConfirm={async () => { if (settleTarget) await settle(settleTarget.marketId) }}
      />
    </AdminLayout>
  )
}
