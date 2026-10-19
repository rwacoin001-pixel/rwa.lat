'use client'

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ErrorState, useApi } from '@/components/console/framework'
import { denies, useAdminProfile } from '@/components/rbac-gate'
import { MiniBars, ProgressBar, ProgressRing, StatCard } from '@/components/ui/visuals'
import { cn } from '@/lib/utils'
import { Activity, ArrowUpRight, CheckCircle2, MessageCircle, PieChart, Receipt, RefreshCw, ShieldCheck, Sparkles, Store, Wallet } from 'lucide-react'

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

const QUEUE_LIMIT = 200

type Source<T> = { data: T | null; loading: boolean; error: string; denied: boolean; reload: () => void }
type SourceStatus = Pick<Source<unknown>, 'loading' | 'error' | 'denied'> & { ready: boolean }

/** 已知无权限时不发请求并标记 denied；其余情况照常请求，由后端裁决。 */
function useSource<T>(url: string, anyOf: string[]): Source<T> {
  const denied = denies(useAdminProfile(), anyOf)
  const api = useApi<T>(denied ? null : url)
  return { ...api, denied }
}

function status(...sources: Source<unknown>[]): SourceStatus {
  return {
    ready: sources.every((source) => source.data !== null),
    loading: sources.some((source) => source.loading),
    error: sources.map((source) => source.error).filter(Boolean).join('；'),
    denied: sources.some((source) => source.denied),
  }
}

function listOf<T>(value: unknown, key: string): T[] | null {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>)[key])) return (value as Record<string, T[]>)[key]
  return null
}

/** 卡片数值：加载中 …；失败/无权限 —；数据就绪时照常显示（含 0）。 */
function show(state: SourceStatus, render: () => ReactNode): ReactNode {
  if (state.denied || state.error) return '—'
  if (state.loading || !state.ready) return '…'
  return render()
}

function SourceNote({ sources, fallback }: { sources: Source<unknown>[]; fallback?: ReactNode }) {
  if (sources.some((source) => source.denied)) return <span className="text-text-faint">无权限查看</span>
  const failed = sources.filter((source) => source.error)
  if (!failed.length) return <>{fallback}</>
  return (
    <span className="text-rose-600" title={failed.map((source) => source.error).join('；')}>
      加载失败 ·{' '}
      <button type="button" onClick={() => failed.forEach((source) => source.reload())} className="font-medium underline underline-offset-2">
        重试
      </button>
    </span>
  )
}

function QueueCard({
  label,
  href,
  source,
  count,
  icon: Icon,
  delay,
}: {
  label: string
  href: string
  source: Source<unknown>
  count: number | null
  icon: ComponentType<{ className?: string }>
  delay: number
}) {
  const state = status(source)
  const value = show(state, () => (count === null ? '—' : count >= QUEUE_LIMIT ? `${QUEUE_LIMIT}+` : count.toLocaleString()))
  const waiting = !state.error && !state.denied && (count ?? 0) > 0
  return (
    <div className="glass-strong card-lift animate-rise rounded-card p-4" style={{ animationDelay: `${delay}ms` }}>
      <Link href={href} className="group flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-text-secondary">{label}</span>
          <span className={cn('mt-1 block text-2xl font-bold tabular-nums', waiting ? 'text-amber-600' : 'text-ink')}>{value}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/[0.04] transition-colors group-hover:bg-mint/12">
          <Icon className="h-4 w-4 text-text-faint transition-colors group-hover:text-mint" />
        </span>
      </Link>
      <p className="mt-1.5 truncate text-[11px] text-text-faint">
        <SourceNote sources={[source]} fallback={state.loading ? '加载中…' : waiting ? '待处理，点击进入' : '当前无待办'} />
      </p>
    </div>
  )
}

function greeting(hour: number) {
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}


type KoalaProduct = { name: string; status: string; nextTradeDate: string | null; last_settled_date: string | null; index_value: string; totals: { principalAtomic: string; users: number; pendingRedemptions: number }; ledger: { poolMatchesLots: boolean; treasuryAtomic: string } }
const KOALA_STATUS: Record<string, string> = { draft: '草稿', pilot: '试运行', active: '正式开放', paused: '已暂停', closed: '已关闭' }

/** 主打产品入口:今天要结算的日期、在投本金和账本核对一眼可见。 */
function KoalaCard() {
  const source = useSource<KoalaProduct[]>('/api/admin/quant/products', ['quant.operations.manage'])
  if (source.denied) return null
  const product = source.data?.[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const due = product?.nextTradeDate && product.nextTradeDate <= yesterday
  return (
    <Link href="/quant/settlement" className="glass-strong card-lift flex flex-wrap items-center justify-between gap-4 rounded-card p-5">
      <div>
        <p className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4" /> 考拉量化 <span className="rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-xs font-normal">{product ? KOALA_STATUS[product.status] ?? product.status : source.loading ? '…' : '—'}</span></p>
        <p className="mt-1 text-xs text-text-faint">{product ? `已结算至 ${product.last_settled_date ?? '尚未开始'} · 在投本金 ${(Number(product.totals.principalAtomic) / 1e6).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} USDT · ${product.totals.users} 位用户 · ${product.totals.pendingRedemptions} 笔赎回待兑付` : source.error || '主打产品:配置与每日结算'}</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {product && !product.ledger.poolMatchesLots && <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-500">账本与持仓不一致</span>}
        {product && BigInt(product.ledger.treasuryAtomic) < BigInt(0) && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-600">平台已垫付收益</span>}
        {due ? <span className="rounded-full bg-ink px-3 py-1 text-xs text-white">{product?.nextTradeDate} 待录入结算</span> : <span className="text-xs text-text-faint">进入每日结算 →</span>}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const facetsSrc = useSource<Facets>('/api/admin/basket/candidate-facets', ['basket.operations.manage'])
  const communitySrc = useSource<CommunityStats>('/api/admin/community/stats', ['community.content.review'])
  const strategiesSrc = useSource<unknown>('/api/admin/basket/strategies', ['basket.operations.manage'])
  const portfoliosSrc = useSource<unknown>('/api/admin/basket/portfolios?includeClosed=true', ['basket.operations.manage'])
  const reconsSrc = useSource<unknown>('/api/admin/basket/reconciliations?limit=50', ['basket.operations.manage'])
  const withdrawalQueue = useSource<unknown[]>(`/api/admin/wallet/withdrawals/reviews?limit=${QUEUE_LIMIT}`, ['wallet.withdrawals.manage'])
  const kycQueue = useSource<unknown[]>(`/api/admin/console/kyc?state=submitted&limit=${QUEUE_LIMIT}`, ['core.console.view'])
  const settlementQueue = useSource<Array<{ reviewState?: string }>>('/api/admin/manual-settlements', ['orders.settlement.review'])
  const approvalQueue = useSource<unknown[]>(`/api/admin/approvals?state=requested&limit=${QUEUE_LIMIT}`, ['approvals.manage'])
  const [now, setNow] = useState('')

  const allSources: Source<unknown>[] = [facetsSrc, communitySrc, strategiesSrc, portfoliosSrc, reconsSrc, withdrawalQueue, kycQueue, settlementQueue, approvalQueue]
  const loading = allSources.some((source) => source.loading)
  const load = () => allSources.forEach((source) => { if (!source.denied) source.reload() })

  const facets = facetsSrc.data
  const community = communitySrc.data
  const strategies = useMemo(() => listOf<StrategyRow>(strategiesSrc.data, 'strategies') ?? [], [strategiesSrc.data])
  const portfolios = useMemo(() => listOf<PortfolioRow>(portfoliosSrc.data, 'portfolios') ?? [], [portfoliosSrc.data])
  const recons = useMemo(() => listOf<ReconRow>(reconsSrc.data, 'runs') ?? [], [reconsSrc.data])

  useEffect(() => {
    setNow(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
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
  const settlementPending = settlementQueue.data ? settlementQueue.data.filter((row) => row.reviewState === 'pending').length : null

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* ── 页头 ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="glass-strong card-lift flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 刷新数据
          </button>
        </div>

        <KoalaCard />

        {/* ── KPI 卡片 ─────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="资产目录规模"
            value={show(status(facetsSrc), () => totals?.total.toLocaleString())}
            sub={<SourceNote sources={[facetsSrc]} fallback={totals ? `有行情报价 ${totals.priced.toLocaleString()} 个` : '真实资产标准化目录'} />}
            icon={Store}
            tone="mint"
            delay={40}
          />
          <StatCard
            label={`可入篮候选（评分 ≥ ${facets?.minScore ?? 60}）`}
            value={show(status(facetsSrc), () => facets?.totalCandidates.toLocaleString())}
            sub={<SourceNote sources={[facetsSrc]} fallback="确定性评分驱动 · 供目标配置使用" />}
            icon={Sparkles}
            tone="violet"
            delay={90}
          />
          <StatCard
            label="策略 / 组合"
            value={show(status(strategiesSrc, portfoliosSrc), () => `${strategies.length} / ${portfolios.length}`)}
            sub={<SourceNote sources={[strategiesSrc, portfoliosSrc]} fallback={`运行中策略 ${activeStrategies} · 在管组合 ${activePortfolios}`} />}
            icon={PieChart}
            tone="sky"
            delay={140}
          />
          <StatCard
            label="社区帖子"
            value={show(status(communitySrc), () => community?.posts.toLocaleString())}
            sub={<SourceNote sources={[communitySrc]} fallback={community ? `近 24 小时 +${community.postsLast24h} · 待审 ${community.queuePending}` : '内容雷达自动巡查'} />}
            icon={MessageCircle}
            tone="emerald"
            delay={190}
          />
        </div>

        {/* ── 待办队列 ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <QueueCard label="待审提现" href="/withdrawals" icon={Wallet} source={withdrawalQueue} count={withdrawalQueue.data?.length ?? null} delay={200} />
          <QueueCard label="待审 KYC" href="/kyc" icon={ShieldCheck} source={kycQueue} count={kycQueue.data?.length ?? null} delay={220} />
          <QueueCard label="待复核结算" href="/orders" icon={Receipt} source={settlementQueue} count={settlementPending} delay={240} />
          <QueueCard label="待审批" href="/approvals" icon={CheckCircle2} source={approvalQueue} count={approvalQueue.data?.length ?? null} delay={260} />
        </div>

        {/* ── 柱状图 + 覆盖健康 ────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="glass-strong card-lift animate-rise rounded-card p-5 xl:col-span-2" style={{ animationDelay: '220ms' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">资产目录构成</h2>
                <p className="mt-0.5 text-xs text-text-faint">
                  按资产类别分布（共 {facets?.classes.length ?? '—'} 类 · {totals ? totals.total.toLocaleString() : '—'} 个资产）
                </p>
              </div>
              <Link href="/basket" className="flex items-center gap-1 text-xs font-medium text-mint transition-colors hover:text-accent-2">
                生成目标配置 <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {facetsSrc.error ? (
              <div className="flex h-[190px] items-center">
                <div className="w-full"><ErrorState error={facetsSrc.error} onRetry={facetsSrc.reload} /></div>
              </div>
            ) : facetsSrc.denied ? (
              <div className="flex h-[190px] items-center justify-center text-sm text-muted-foreground">无权限查看资产目录</div>
            ) : barData.length ? (
              <MiniBars data={barData} height={190} tone="mint" />
            ) : (
              <div className="flex h-[190px] items-center justify-center text-sm text-muted-foreground">{facetsSrc.loading ? '加载中…' : '暂无目录数据（等待市场同步）'}</div>
            )}
            <p className="mt-3 border-t border-ink/[0.06] pt-3 text-[11px] leading-relaxed text-text-faint">
              高亮柱 = 该类别存在达到评分线（≥{facets?.minScore ?? 60} 分）且带行情价格的候选资产；灰柱 = 仅有目录记录，暂不可入篮。
            </p>
          </div>

          <div className="glass-strong card-lift animate-rise flex flex-col rounded-card p-5" style={{ animationDelay: '260ms' }}>
            <h2 className="text-base font-semibold">目录数据覆盖</h2>
            <p className="mt-0.5 text-xs text-text-faint">
              <SourceNote sources={[facetsSrc]} fallback="同步管线对目录资产的行情 / 评分覆盖" />
            </p>
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
              {reconsSrc.error && <ErrorState error={reconsSrc.error} onRetry={reconsSrc.reload} />}
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
              {!recons.length && !reconsSrc.error && (
                <div className="flex items-center gap-3 rounded-xl bg-ink/[0.03] px-4 py-6 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  {reconsSrc.loading ? '加载中…' : reconsSrc.denied ? '无权限查看对账记录' : '暂无对账记录 — 在 Basket 运营页对组合执行「对账」后展示。'}
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
              <SourceNote
                sources={[reconsSrc]}
                fallback={reconStats.total ? `近 ${reconStats.total} 次对账 · 一致 ${reconStats.matched} 次` : reconsSrc.loading ? '加载中…' : '暂无对账数据'}
              />
            </p>
          </div>
        </div>

        {/* ── 社区概览 ─────────────────────────────────── */}
        <div className="glass-strong card-lift animate-rise rounded-card p-5" style={{ animationDelay: '380ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              社区概览
              {(communitySrc.error || communitySrc.denied) && (
                <span className="ml-2 text-xs font-normal"><SourceNote sources={[communitySrc]} /></span>
              )}
            </h2>
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
                  {show(status(communitySrc), () => (entry.value ?? 0).toLocaleString())}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
