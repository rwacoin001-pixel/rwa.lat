'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { MiniBars, ProgressBar, ProgressRing, StatCard } from '@/components/ui/visuals'
import { cn } from '@/lib/utils'
import { Activity, ArrowUpRight, MessageCircle, PieChart, RefreshCw, ShieldCheck, Sparkles, Store } from 'lucide-react'

type FacetClass = { assetClass: string; total: number; priced: number; scored: number; aboveMinScore: number; maxScore: number | null; inDefaultSet: boolean }
type Facets = { minScore: number; totalCandidates: number; classes: FacetClass[] }
type CommunityStats = { profiles: number; posts: number; comments: number; queuePending: number; postsLast24h: number }
type StrategyRow = { id: string; slug: string; name: string; status: string; versionCount: number }
type PortfolioRow = { id: string; name: string; status: string; aumUsd: string | null; navPerUnit: string | null }
type ReconRow = { id: string; state: string; completed_at: string | null; source_reference?: string }

const CLASS_LABELS: Record<string, string> = {
  equity: '股权 Equity',
  fund: '基金 Fund',
  commodity: '商品 Commodity',
  treasury: '国债 Treasury',
  money_market: '货币市场 Money Mkt',
  bond: '债券 Bond',
  stable_value: '稳定价值 Stable',
  real_estate: '不动产 Real Estate',
}

const STATE_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: '运行中', className: 'bg-emerald-500/12 text-emerald-600' },
  pilot: { label: '试运行', className: 'bg-sky-500/12 text-sky-600' },
  draft: { label: '草稿', className: 'bg-ink/[0.06] text-text-secondary' },
  closed: { label: '已关闭', className: 'bg-ink/[0.06] text-text-faint' },
  matched: { label: '一致', className: 'bg-emerald-500/12 text-emerald-600' },
  differences_found: { label: '有差异', className: 'bg-rose-500/12 text-rose-600' },
}

function greeting(hour: number) {
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export default function DashboardPage() {
  const [facets, setFacets] = useState<Facets | null>(null)
  const [community, setCommunity] = useState<CommunityStats | null>(null)
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([])
  const [recons, setRecons] = useState<ReconRow[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState('')

  const load = async () => {
    setLoading(true)
    const [facetsRes, communityRes, strategiesRes, portfoliosRes, reconsRes] = await Promise.allSettled([
      fetch('/api/admin/basket/candidate-facets', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/admin/community/stats', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/admin/basket/strategies', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/admin/basket/portfolios?includeClosed=true', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
      fetch('/api/admin/basket/reconciliations?limit=50', { credentials: 'include' }).then((res) => (res.ok ? res.json() : null)),
    ])
    if (facetsRes.status === 'fulfilled' && facetsRes.value) setFacets(facetsRes.value as Facets)
    if (communityRes.status === 'fulfilled' && communityRes.value) setCommunity(communityRes.value as CommunityStats)
    if (strategiesRes.status === 'fulfilled') {
      const value = strategiesRes.value as unknown
      if (Array.isArray(value)) setStrategies(value as StrategyRow[])
      else if (value && Array.isArray((value as { strategies?: unknown }).strategies)) setStrategies((value as { strategies: StrategyRow[] }).strategies)
    }
    if (portfoliosRes.status === 'fulfilled') {
      const value = portfoliosRes.value as unknown
      if (Array.isArray(value)) setPortfolios(value as PortfolioRow[])
      else if (value && Array.isArray((value as { portfolios?: unknown }).portfolios)) setPortfolios((value as { portfolios: PortfolioRow[] }).portfolios)
    }
    if (reconsRes.status === 'fulfilled') {
      const value = reconsRes.value as unknown
      if (Array.isArray(value)) setRecons(value as ReconRow[])
      else if (value && Array.isArray((value as { runs?: unknown }).runs)) setRecons((value as { runs: ReconRow[] }).runs)
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    setNow(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(() => {
    if (!facets) return null
    const total = facets.classes.reduce((sum, row) => sum + row.total, 0)
    const priced = facets.classes.reduce((sum, row) => sum + row.priced, 0)
    const scored = facets.classes.reduce((sum, row) => sum + row.scored, 0)
    return {
      total,
      priced,
      scored,
      priceCoverage: total ? (priced / total) * 100 : 0,
      scoreCoverage: total ? (scored / total) * 100 : 0,
      candidateCoverage: total ? (facets.totalCandidates / total) * 100 : 0,
    }
  }, [facets])

  const reconStats = useMemo(() => {
    if (!recons.length) return { matched: 0, total: 0, rate: null as number | null, latest: null as ReconRow | null }
    const matched = recons.filter((row) => row.state === 'matched').length
    return { matched, total: recons.length, rate: (matched / recons.length) * 100, latest: recons[0] ?? null }
  }, [recons])

  const barData = useMemo(() => {
    if (!facets) return []
    return facets.classes.map((row) => ({
      label: row.assetClass,
      value: row.total,
      highlight: row.aboveMinScore > 0,
      hint: `${CLASS_LABELS[row.assetClass] ?? row.assetClass}：共 ${row.total.toLocaleString()} · 有行情 ${row.priced} · 评分≥${facets.minScore} ${row.aboveMinScore}${row.maxScore ? ` · 最高分 ${row.maxScore}` : ''}`,
    }))
  }, [facets])

  const activeStrategies = strategies.filter((row) => row.status === 'active').length
  const activePortfolios = portfolios.filter((row) => row.status === 'active' || row.status === 'pilot').length

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* ── 页头 ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-rise">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">工作台</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {now ? `${now} · ` : ''}
              {greeting(new Date().getHours())}，管理员 — 平台核心指标一览
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="glass-strong card-lift flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 刷新数据
          </button>
        </div>

        {/* ── KPI 卡片 ─────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="资产目录规模"
            value={totals ? totals.total.toLocaleString() : loading ? '…' : '—'}
            sub={totals ? `有行情报价 ${totals.priced.toLocaleString()} 个` : 'RWA 标准化目录'}
            icon={Store}
            tone="mint"
            delay={40}
          />
          <StatCard
            label={`可入篮候选（评分 ≥ ${facets?.minScore ?? 60}）`}
            value={facets ? facets.totalCandidates.toLocaleString() : loading ? '…' : '—'}
            sub="确定性评分驱动 · 供目标配置使用"
            icon={Sparkles}
            tone="violet"
            delay={90}
          />
          <StatCard
            label="策略 / 组合"
            value={loading && !strategies.length ? '…' : `${strategies.length} / ${portfolios.length}`}
            sub={`运行中策略 ${activeStrategies} · 在管组合 ${activePortfolios}`}
            icon={PieChart}
            tone="sky"
            delay={140}
          />
          <StatCard
            label="社区帖子"
            value={community ? community.posts.toLocaleString() : loading ? '…' : '—'}
            sub={community ? `近 24 小时 +${community.postsLast24h} · 待审 ${community.queuePending}` : '内容雷达自动巡查'}
            icon={MessageCircle}
            tone="emerald"
            delay={190}
          />
        </div>

        {/* ── 柱状图 + 覆盖健康 ────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass-strong card-lift animate-rise rounded-card p-5 xl:col-span-2" style={{ animationDelay: '220ms' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">资产目录构成</h2>
                <p className="mt-0.5 text-xs text-text-faint">
                  按资产类别分布（共 {facets?.classes.length ?? '—'} 类 · {(totals?.total ?? 0).toLocaleString()} 个资产）
                </p>
              </div>
              <Link href="/basket" className="flex items-center gap-1 text-xs font-medium text-mint transition-colors hover:text-accent-2">
                生成目标配置 <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {barData.length ? (
              <MiniBars data={barData} height={190} tone="mint" />
            ) : (
              <div className="flex h-[190px] items-center justify-center text-sm text-muted-foreground">{loading ? '加载中…' : '暂无目录数据（等待市场同步）'}</div>
            )}
            <p className="mt-3 border-t border-ink/[0.06] pt-3 text-[11px] leading-relaxed text-text-faint">
              高亮柱 = 该类别存在达到评分线（≥{facets?.minScore ?? 60} 分）且带行情价格的候选资产；灰柱 = 仅有目录记录，暂不可入篮。
            </p>
          </div>

          <div className="glass-strong card-lift animate-rise flex flex-col rounded-card p-5" style={{ animationDelay: '260ms' }}>
            <h2 className="text-base font-semibold">目录数据覆盖</h2>
            <p className="mt-0.5 text-xs text-text-faint">同步管线对目录资产的行情 / 评分覆盖</p>
            <div className="mt-4 flex-1 space-y-4">
              <ProgressBar
                value={totals?.scoreCoverage ?? null}
                tone="emerald"
                label="评分覆盖"
                valueText={totals ? `${totals.scoreCoverage.toFixed(1)}%` : '—'}
              />
              <ProgressBar
                value={totals?.priceCoverage ?? null}
                tone="sky"
                label="实时行情覆盖"
                valueText={totals ? `${totals.priceCoverage.toFixed(1)}%` : '—'}
              />
              <ProgressBar
                value={totals?.candidateCoverage ?? null}
                tone="violet"
                label="候选转化（≥评分线）"
                valueText={totals ? `${totals.candidateCoverage.toFixed(1)}%` : '—'}
              />
            </div>
            <p className="mt-4 border-t border-ink/[0.06] pt-3 text-[11px] leading-relaxed text-text-faint">
              行情覆盖受上游数据源（CMC 免费档）同步范围限制；评分覆盖接近全量，候选转化为严格入篮口径。
            </p>
          </div>
        </div>

        {/* ── 对账 + 社区 ──────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass-strong card-lift animate-rise rounded-card p-5 xl:col-span-2" style={{ animationDelay: '300ms' }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">最近对账</h2>
              <Link href="/basket" className="flex items-center gap-1 text-xs font-medium text-mint transition-colors hover:text-accent-2">
                对账中心 <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {recons.slice(0, 5).map((row) => {
                const state = STATE_LABELS[row.state] ?? { label: row.state, className: 'bg-ink/[0.06] text-text-secondary' }
                return (
                  <div key={row.id} className="flex items-center justify-between rounded-xl bg-ink/[0.03] px-4 py-2.5 text-sm transition-colors hover:bg-ink/[0.05]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={cn('pill', state.className)}>{state.label}</span>
                      <span className="truncate font-mono text-xs text-text-faint">
                        {String(row.source_reference ?? '').replace('basket-portfolio:', '组合 ').slice(0, 18) || row.id.slice(0, 8)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-text-faint">
                      {row.completed_at ? new Date(row.completed_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                )
              })}
              {!recons.length && (
                <div className="flex items-center gap-3 rounded-xl bg-ink/[0.03] px-4 py-6 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  {loading ? '加载中…' : '暂无对账记录 — 在 Basket 运营页对组合执行「对账」后展示。'}
                </div>
              )}
            </div>
          </div>

          <div className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '340ms' }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">对账健康</h2>
              <Activity className="h-4 w-4 text-text-faint" />
            </div>
            <div className="flex items-center justify-center py-1">
              <ProgressRing value={reconStats.rate} tone={reconStats.rate === null ? 'slate' : reconStats.rate >= 99 ? 'emerald' : reconStats.rate >= 90 ? 'amber' : 'rose'} label="对账一致率" />
            </div>
            <p className="mt-3 border-t border-ink/[0.06] pt-3 text-center text-xs text-text-faint">
              {reconStats.total ? `近 ${reconStats.total} 次对账 · 一致 ${reconStats.matched} 次` : '暂无对账数据'}
            </p>
          </div>
        </div>

        {/* ── 社区概览 ─────────────────────────────────── */}
        <div className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '380ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">社区概览</h2>
            <Link href="/community" className="flex items-center gap-1 text-xs font-medium text-mint transition-colors hover:text-accent-2">
              审核台 <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: '社区人设', value: community?.profiles },
              { label: '帖子', value: community?.posts },
              { label: '评论', value: community?.comments },
              { label: '待审内容', value: community?.queuePending, warn: true },
            ].map((entry) => (
              <div key={entry.label} className="rounded-2xl bg-ink/[0.03] px-4 py-3.5 transition-colors hover:bg-ink/[0.05]">
                <p className="text-xs text-text-faint">{entry.label}</p>
                <p className={cn('mt-1 text-xl font-bold tabular-nums', entry.warn && (entry.value ?? 0) > 0 ? 'text-amber-600' : 'text-ink')}>
                  {entry.value ?? (loading ? '…' : '—')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
