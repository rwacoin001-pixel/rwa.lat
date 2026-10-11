'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/visuals'
import { AllocationDialog } from './allocation-dialog'
import { ConfirmDialog, type ConfirmDetail } from '@/components/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  RefreshCw,
  PlusCircle,
  Rocket,
  Gauge,
  Route,
  Play,
  ClipboardCheck,
  Scale,
  Info,
} from 'lucide-react'

type StrategyRow = {
  id: string
  slug: string
  name: string
  status: string
  riskLevel: string
  minimumSubscriptionUsd: string | null
  versionCount: number
  createdAt: string
}

type PortfolioRow = {
  id: string
  name: string
  status: string
  strategySlug: string
  strategyName: string
  riskLevel: string
  totalUnits: string | null
  navPerUnit: string | null
  aumUsd: string | null
  minimumSubscriptionUsd: string | null
  createdAt: string
}

type BasketAction =
  | { kind: 'createStrategy' }
  | { kind: 'createVersion'; strategy: StrategyRow }
  | { kind: 'activateVersion'; strategy: StrategyRow; version: Record<string, any> }
  | { kind: 'createDisclosure'; strategy: StrategyRow }
  | { kind: 'createPortfolio' }
  | { kind: 'planRebalance'; portfolio: PortfolioRow }
  | { kind: 'executeRun'; run: Record<string, any> }
  | { kind: 'recordFill'; order: Record<string, any> }

type ActionForm = { name: string; strategySlug: string; title: string; content: string; qty: string; price: string; external: string }
const EMPTY_FORM: ActionForm = { name: '', strategySlug: '', title: '', content: '', qty: '', price: '', external: '' }

const FIELD = 'w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm'

const TABS = [
  { key: 'strategies', label: '策略与目标配置' },
  { key: 'portfolios', label: '组合与 NAV' },
  { key: 'reconciliations', label: '对账记录' },
] as const

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-400/20 text-slate-500',
  pilot: 'bg-sky-500/15 text-sky-600',
  active: 'bg-emerald-500/15 text-emerald-600',
  closed: 'bg-rose-500/15 text-rose-600',
  retired: 'bg-slate-400/20 text-slate-500',
  planned: 'bg-amber-500/15 text-amber-600',
  running: 'bg-sky-500/15 text-sky-600',
  completed: 'bg-emerald-500/15 text-emerald-600',
  cancelled: 'bg-slate-400/20 text-slate-500',
  matched: 'bg-emerald-500/15 text-emerald-600',
  differences_found: 'bg-rose-500/15 text-rose-600',
}

export default function BasketOpsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('strategies')
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null)
  const [strategyDetail, setStrategyDetail] = useState<Record<string, any> | null>(null)
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([])
  const [includeClosed, setIncludeClosed] = useState(false)
  const [expandedPortfolio, setExpandedPortfolio] = useState<string | null>(null)
  const [portfolioDetail, setPortfolioDetail] = useState<Record<string, any> | null>(null)
  const [portfolioRuns, setPortfolioRuns] = useState<Array<Record<string, any>>>([])
  const [runDetail, setRunDetail] = useState<Record<string, any> | null>(null)
  const [riskView, setRiskView] = useState<Record<string, any> | null>(null)
  const [driftView, setDriftView] = useState<Record<string, any> | null>(null)
  const [reconciliations, setReconciliations] = useState<Array<Record<string, any>>>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [allocTarget, setAllocTarget] = useState<{ strategy: StrategyRow; version: Record<string, any> } | null>(null)
  const [action, setAction] = useState<BasketAction | null>(null)
  const [form, setForm] = useState<ActionForm>(EMPTY_FORM)

  // request 抛错（供确认弹窗内显示）；call 吞掉错误并显示在页面顶部
  const request = useCallback(async (path: string, init?: RequestInit) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/basket${path}`, { credentials: 'include', ...init })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body?.message as string) || `操作失败 (HTTP ${res.status})`)
      return body
    } finally {
      setBusy(false)
    }
  }, [])

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      try {
        return await request(path, init)
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败')
        return null
      }
    },
    [request],
  )

  const loadStrategies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/basket/strategies', { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data)) setStrategies(data)
      else if (res.ok && Array.isArray(data?.strategies)) setStrategies(data.strategies)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPortfolios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/basket/portfolios${includeClosed ? '?includeClosed=true' : ''}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data)) setPortfolios(data)
      else if (res.ok && Array.isArray(data?.portfolios)) setPortfolios(data.portfolios)
    } finally {
      setLoading(false)
    }
  }, [includeClosed])

  const loadReconciliations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/basket/reconciliations?limit=50', { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (res.ok && Array.isArray(data)) setReconciliations(data)
      else if (res.ok && Array.isArray(data?.runs)) setReconciliations(data.runs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStrategies()
  }, [loadStrategies])

  useEffect(() => {
    if (tab === 'portfolios') void loadPortfolios()
    if (tab === 'reconciliations') void loadReconciliations()
  }, [tab, loadPortfolios, loadReconciliations])

  // 顶部 KPI 卡片需要组合与对账摘要：首次进入即静默加载
  useEffect(() => {
    void loadPortfolios()
    void loadReconciliations()
  }, [loadPortfolios, loadReconciliations])

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 6000)
  }

  // ---- 策略动作 ----

  const toggleStrategy = async (slug: string) => {
    if (expandedStrategy === slug) {
      setExpandedStrategy(null)
      setStrategyDetail(null)
      return
    }
    setExpandedStrategy(slug)
    setStrategyDetail(null)
    const detail = await call(`/strategies/${encodeURIComponent(slug)}`)
    if (detail) setStrategyDetail(detail as Record<string, any>)
  }

  const openAction = (next: BasketAction, initial: Partial<ActionForm> = {}) => {
    setForm({ ...EMPTY_FORM, ...initial })
    setAction(next)
  }

  const createStrategy = async () => {
    const result = await request('/strategies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name }),
    })
    if (result) {
      showNotice('策略已创建')
      await loadStrategies()
    }
  }

  const createVersion = async (strategy: StrategyRow) => {
    const result = await request(`/strategies/${strategy.id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (result) {
      showNotice('新版本已创建（草稿）')
      await toggleStrategy(strategy.slug)
      await toggleStrategy(strategy.slug)
      await loadStrategies()
    }
  }

  const submitAllocation = async (params: { assetClasses: string[]; minScore: number; maxAssets: number; cashBufferPct: number }) => {
    if (!allocTarget) return false
    const { strategy, version } = allocTarget
    const result = await call(`/strategies/${strategy.id}/versions/${version.id}/allocation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!result) return false
    const count = Array.isArray((result as any).assets)
      ? (result as any).assets.length
      : Array.isArray((result as any).allocation)
        ? (result as any).allocation.length
        : (result as any).items?.length ?? 0
    showNotice(`目标配置已生成（${count} 个资产）`)
    if (expandedStrategy === strategy.slug) {
      const detail = await call(`/strategies/${encodeURIComponent(strategy.slug)}`)
      if (detail) setStrategyDetail(detail as Record<string, any>)
    }
    return true
  }

  const activateVersion = async (strategy: StrategyRow, version: Record<string, any>) => {
    const result = await request(`/strategies/${strategy.id}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionId: version.id }),
    })
    if (result) {
      showNotice(`版本 v${version.version} 已激活`)
      await toggleStrategy(strategy.slug)
      await toggleStrategy(strategy.slug)
      await loadStrategies()
    }
  }

  const createDisclosure = async (strategy: StrategyRow) => {
    const result = await request('/disclosures', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: form.title, content: form.content, strategyId: strategy.id }),
    })
    if (result) showNotice('披露已创建（申购前需用户确认）')
  }

  // ---- 组合动作 ----

  const createPortfolio = async () => {
    const result = await request('/portfolios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name, strategySlug: form.strategySlug, status: 'pilot' }),
    })
    if (result) {
      showNotice('组合已创建（pilot）')
      await loadPortfolios()
    }
  }

  const setStatus = async (portfolio: PortfolioRow, status: string) => {
    const result = await call(`/portfolios/${portfolio.id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (result) {
      showNotice(`${portfolio.name} → ${status}`)
      await loadPortfolios()
    }
  }

  const togglePortfolio = async (portfolio: PortfolioRow) => {
    if (expandedPortfolio === portfolio.id) {
      setExpandedPortfolio(null)
      setPortfolioDetail(null)
      setPortfolioRuns([])
      setRunDetail(null)
      setRiskView(null)
      setDriftView(null)
      return
    }
    setExpandedPortfolio(portfolio.id)
    setPortfolioDetail(null)
    setRunDetail(null)
    setRiskView(null)
    setDriftView(null)
    const [detail, runs] = await Promise.all([call(`/portfolios/${portfolio.id}`), call(`/portfolios/${portfolio.id}/runs?limit=20`)])
    if (detail) setPortfolioDetail(detail as Record<string, any>)
    if (Array.isArray(runs)) setPortfolioRuns(runs)
    else if (Array.isArray((runs as any)?.runs)) setPortfolioRuns((runs as any).runs)
  }

  const computeNav = async (portfolio: PortfolioRow) => {
    const result = await call(`/portfolios/${portfolio.id}/nav`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (result) {
      showNotice(`NAV 已刷新：${(result as any).navPerUnit ?? '-'}（净 ${(result as any).netAssetValueUsd ?? '-'} USDT）`)
      await loadPortfolios()
      if (expandedPortfolio === portfolio.id) setPortfolioDetail((await call(`/portfolios/${portfolio.id}`)) as Record<string, any>)
    }
  }

  const loadDrift = async (portfolio: PortfolioRow) => {
    const result = await call(`/portfolios/${portfolio.id}/drift`)
    if (result) setDriftView(result as Record<string, any>)
  }

  const loadRisk = async (portfolio: PortfolioRow) => {
    const result = await call(`/portfolios/${portfolio.id}/risk`)
    if (result) setRiskView(result as Record<string, any>)
  }

  const planRebalance = async (portfolio: PortfolioRow) => {
    const result = await request(`/portfolios/${portfolio.id}/rebalance-plans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trigger: 'manual' }),
    })
    if (result) {
      const plan = result as any
      if (plan.skipped) showNotice(`无需调仓：${plan.reason ?? '漂移在阈值内'}`)
      else showNotice(`调仓计划已生成：${plan.orders?.length ?? 0} 笔订单，预计换手 ${plan.estimatedTurnoverPct ?? '-'}%`)
      await togglePortfolio(portfolio)
      await togglePortfolio(portfolio)
    }
  }

  const executeRun = async (runId: string) => {
    const result = await request(`/runs/${runId}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (result) {
      showNotice(`执行完成：成交 ${(result as any).executed ?? 0} 笔 / 待人工 ${(result as any).pending ?? 0} 笔（适配器 ${(result as any).adapter}）`)
      const detail = await call(`/runs/${runId}`)
      if (detail) setRunDetail(detail as Record<string, any>)
    }
  }

  const recordFill = async (order: Record<string, any>) => {
    const { qty, price, external } = form
    const result = await request(`/orders/${order.id}/fills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ executedQuantity: qty, averageFillPrice: price, ...(external ? { externalOrderId: external } : {}) }),
    })
    if (result) {
      showNotice((result as any).duplicate ? '该订单已回填过（幂等）' : '成交已回填，持仓与 NAV 已更新')
      if (runDetail) {
        const detail = await call(`/runs/${runDetail.id}`)
        if (detail) setRunDetail(detail as Record<string, any>)
      }
    }
  }

  const reconcile = async (portfolio: PortfolioRow) => {
    const result = await call(`/portfolios/${portfolio.id}/reconcile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (result) {
      const recon = result as any
      showNotice(`对账完成：${recon.state === 'matched' ? '✅ 三方一致（现金/份数/NAV）' : '⚠️ 存在差异，请查看记录'}`)
      await loadReconciliations()
    }
  }

  const openRun = async (runId: string) => {
    const result = await call(`/runs/${runId}`)
    if (result) setRunDetail(result as Record<string, any>)
  }

  const field = (key: keyof ActionForm, label: string, opts: { placeholder?: string; mono?: boolean; rows?: number; inputMode?: 'decimal' } = {}) => (
    <label className="block">
      <span className="mb-1 block text-xs text-text-secondary">{label}</span>
      {opts.rows ? (
        <textarea rows={opts.rows} value={form[key]} placeholder={opts.placeholder} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} className={FIELD} />
      ) : (
        <input value={form[key]} placeholder={opts.placeholder} inputMode={opts.inputMode} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} className={cn(FIELD, opts.mono && 'font-mono')} />
      )}
    </label>
  )

  const positive = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0

  const dialog = ((): {
    title: string
    description?: string
    details?: ConfirmDetail[]
    typeToConfirm?: string
    confirmLabel: string
    destructive?: boolean
    confirmDisabled?: boolean
    run: () => Promise<void>
    body?: ReactNode
  } | null => {
    if (!action) return null
    switch (action.kind) {
      case 'createStrategy':
        return {
          title: '新建策略',
          confirmLabel: '创建',
          confirmDisabled: !form.name.trim(),
          run: createStrategy,
          body: field('name', '策略名称', { placeholder: '例如：AI RWA Core 核心篮子' }),
        }
      case 'createVersion':
        return {
          title: '创建草稿版本',
          description: `为「${action.strategy.name}」创建新的草稿版本。`,
          details: [
            { label: '策略', value: action.strategy.name },
            { label: 'slug', value: action.strategy.slug, mono: true },
            { label: '现有版本数', value: action.strategy.versionCount },
          ],
          confirmLabel: '创建版本',
          run: () => createVersion(action.strategy),
        }
      case 'activateVersion':
        return {
          title: '激活策略版本',
          description: '激活后当前激活版本将退役，新的目标配置将用于后续调仓。',
          details: [
            { label: '策略', value: action.strategy.name },
            { label: '版本', value: `v${action.version.version}`, emphasis: true },
            { label: '版本 ID', value: action.version.id, mono: true },
          ],
          typeToConfirm: `v${action.version.version}`,
          confirmLabel: '确认激活',
          destructive: true,
          run: () => activateVersion(action.strategy, action.version),
        }
      case 'createDisclosure':
        return {
          title: '新建风险披露',
          description: '披露内容将展示给申购用户，需其确认后放行。',
          details: [{ label: '策略', value: action.strategy.name }],
          confirmLabel: '创建披露',
          confirmDisabled: !form.title.trim() || !form.content.trim(),
          run: () => createDisclosure(action.strategy),
          body: (
            <div className="space-y-3">
              {field('title', '风险披露标题')}
              {field('content', '风险披露内容', { rows: 6 })}
            </div>
          ),
        }
      case 'createPortfolio':
        return {
          title: '新建组合',
          description: '组合将以 pilot 状态创建。',
          confirmLabel: '创建组合',
          confirmDisabled: !form.name.trim() || !form.strategySlug.trim(),
          run: createPortfolio,
          body: (
            <div className="space-y-3">
              {field('name', '组合名称', { placeholder: '例如：AI RWA Core 一号组合' })}
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">绑定策略 slug</span>
                <input list="basket-strategy-slugs" value={form.strategySlug} onChange={(e) => setForm((prev) => ({ ...prev, strategySlug: e.target.value }))} className={cn(FIELD, 'font-mono')} />
                <datalist id="basket-strategy-slugs">
                  {strategies.map((row) => <option key={row.id} value={row.slug}>{row.name}</option>)}
                </datalist>
              </label>
            </div>
          ),
        }
      case 'planRebalance':
        return {
          title: '生成调仓计划',
          description: '仅生成计划与风险验证，不执行。',
          details: [
            { label: '组合', value: action.portfolio.name },
            { label: '组合 ID', value: action.portfolio.id, mono: true },
            { label: '策略', value: action.portfolio.strategyName || action.portfolio.strategySlug },
            { label: 'AUM', value: action.portfolio.aumUsd ? `${action.portfolio.aumUsd} USDT` : '—' },
          ],
          confirmLabel: '生成计划',
          run: () => planRebalance(action.portfolio),
        }
      case 'executeRun': {
        const runId = String(action.run.id)
        return {
          title: '执行调仓运行',
          description: '通过已配置的执行适配器执行该调仓运行（manual=仅登记人工执行；生产默认关闭执行开关）。',
          details: [
            { label: '运行 ID', value: runId, mono: true },
            { label: '状态', value: action.run.status },
            { label: '触发', value: action.run.trigger_type ?? action.run.triggerType ?? '—' },
            { label: '预计换手', value: `${action.run.estimated_turnover_pct ?? action.run.estimatedTurnoverPct ?? '-'}%`, emphasis: true },
          ],
          typeToConfirm: runId.slice(0, 8),
          confirmLabel: '确认执行',
          destructive: true,
          run: () => executeRun(runId),
        }
      }
      case 'recordFill': {
        const order = action.order
        const asset = order.asset_slug ?? order.assetSlug ?? String(order.asset_id).slice(0, 8)
        const notional = positive(form.qty) && positive(form.price) ? (Number(form.qty) * Number(form.price)).toFixed(2) : '—'
        return {
          title: '回填成交',
          description: '回填后将更新持仓与 NAV。请再次输入成交数量以确认。',
          details: [
            { label: '订单 ID', value: order.id, mono: true },
            { label: '方向 / 资产', value: `${order.side === 'buy' ? '买入' : '卖出'} · ${asset}` },
            { label: '目标数量', value: order.target_quantity ?? order.targetQuantity ?? '-' },
            { label: '预估价', value: order.estimated_price ?? order.estimatedPrice ?? '-' },
            { label: '成交金额', value: `${notional} USDT`, emphasis: true },
          ],
          typeToConfirm: form.qty.trim() || undefined,
          confirmLabel: '确认回填',
          confirmDisabled: !positive(form.qty) || !positive(form.price),
          run: () => recordFill(order),
          body: (
            <div className="space-y-3">
              {field('qty', '实际成交数量（份额）', { mono: true, inputMode: 'decimal' })}
              {field('price', '实际成交单价（USDT）', { mono: true, inputMode: 'decimal' })}
              {field('external', '外部成交单号（可选）', { mono: true })}
            </div>
          ),
        }
      }
    }
  })()

  const activeAllocRows = ((strategyDetail?.targetAllocation ?? []) as Array<Record<string, any>>)
  const allocMaxWeight = Math.max(...activeAllocRows.map((row) => Number(row.targetWeightPct ?? row.target_weight_pct ?? 0)), 1)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">

          <button
            type="button"
            onClick={() => {
              void loadStrategies()
              if (tab === 'portfolios') void loadPortfolios()
              if (tab === 'reconciliations') void loadReconciliations()
            }}
            disabled={loading || busy}
            className="glass-strong flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> 刷新
          </button>
        </div>

        {error && <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600">{error}</div>}
        {notice && <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="策略"
            value={strategies.length}
            sub={`运行中 ${strategies.filter((row) => row.status === 'active').length} · 草稿 ${strategies.filter((row) => row.status === 'draft').length}`}
            tone="mint"
            delay={40}
          />
          <StatCard
            label="组合"
            value={portfolios.length}
            sub={`在管 ${portfolios.filter((row) => row.status === 'active' || row.status === 'pilot').length} · 含已关闭`}
            tone="sky"
            delay={90}
          />
          <StatCard
            label="对账一致率"
            value={reconciliations.length ? `${Math.round((reconciliations.filter((run) => run.state === 'matched').length / reconciliations.length) * 100)}%` : '—'}
            sub={reconciliations.length ? `最近 ${reconciliations.length} 次记录` : '暂无对账记录'}
            tone="emerald"
            delay={140}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                tab === item.key ? 'bg-white shadow-sm ring-1 ring-ink/10' : 'text-muted-foreground hover:bg-white/60',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'strategies' && (
          <Card className="glass-strong">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">策略（{strategies.length}）</CardTitle>
              <button
                type="button"
                onClick={() => openAction({ kind: 'createStrategy' })}
                className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white"
              >
                <PlusCircle className="h-4 w-4" /> 新建策略
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategies.map((strategy) => (
                <div key={strategy.id} className="rounded-2xl bg-white/60 ring-1 ring-ink/[0.04]">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <button type="button" onClick={() => void toggleStrategy(strategy.slug)} className="text-left">
                      <div className="font-semibold">{strategy.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {strategy.slug} · 版本 {strategy.versionCount} · 最低申购 {strategy.minimumSubscriptionUsd ?? '-'} USDT
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[strategy.status] ?? 'bg-slate-400/20')}>
                        {strategy.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => openAction({ kind: 'createVersion', strategy })}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium ring-1 ring-ink/10 hover:bg-ink/5"
                      >
                        新版本
                      </button>
                      <button
                        type="button"
                        onClick={() => openAction({ kind: 'createDisclosure', strategy }, { title: `${strategy.name} 风险披露` })}
                        className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium ring-1 ring-ink/10 hover:bg-ink/5"
                      >
                        新建披露
                      </button>
                    </div>
                  </div>

                  {expandedStrategy === strategy.slug && (
                    <div className="border-t border-ink/5 px-4 py-3">
                      {!strategyDetail && <div className="text-sm text-muted-foreground">加载中…</div>}
                      {strategyDetail && (
                        <div className="space-y-3">
                          {(strategyDetail.versions as Array<Record<string, any>>)?.map((version) => (
                            <div key={version.id} className="rounded-xl bg-white/70 p-3 ring-1 ring-ink/[0.04]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm">
                                  <span className="font-medium">v{version.version}</span>{' '}
                                  <span className={cn('ml-1 rounded-full px-2 py-0.5 text-xs', STATUS_STYLE[version.status] ?? 'bg-slate-400/20')}>
                                    {version.status}
                                  </span>
                                  {version.effectiveFrom && <span className="ml-2 text-xs text-muted-foreground">生效 {String(version.effectiveFrom).slice(0, 10)}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAllocTarget({ strategy, version })}
                                    className="rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-500/20"
                                  >
                                    生成目标配置
                                  </button>
                                  {version.status !== 'active' && (
                                    <button
                                      type="button"
                                      onClick={() => openAction({ kind: 'activateVersion', strategy, version })}
                                      className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20"
                                    >
                                      <Rocket className="h-3.5 w-3.5" /> 激活
                                    </button>
                                  )}
                                </div>
                              </div>
                              {version.status === 'active' && (strategyDetail.targetAllocation as Array<Record<string, any>>)?.length > 0 && (
                                <div className="mt-2 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-left text-muted-foreground">
                                        <th className="py-1 pr-3">资产</th>
                                        <th className="py-1 pr-3">类别</th>
                                        <th className="py-1 pr-3">目标权重</th>
                                        <th className="py-1">入选理由</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(strategyDetail.targetAllocation as Array<Record<string, any>>).map((row) => (
                                        <tr key={row.assetId ?? row.asset_id} className="border-t border-ink/5">
                                          <td className="py-1.5 pr-3">{row.name ?? row.slug}</td>
                                          <td className="py-1.5 pr-3">{row.assetClass ?? row.asset_class ?? '-'}</td>
                                          <td className="py-1.5 pr-3">
                                            <div className="flex items-center gap-2">
                                              <span className="w-12 font-medium tabular-nums">{row.targetWeightPct ?? row.target_weight_pct}%</span>
                                              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink/[0.07]">
                                                <span
                                                  className="bar-fill block h-full rounded-full bg-gradient-to-r from-mint to-accent-2"
                                                  style={{ width: `${Math.min((Number(row.targetWeightPct ?? row.target_weight_pct ?? 0) / allocMaxWeight) * 100, 100)}%` }}
                                                />
                                              </span>
                                            </div>
                                          </td>
                                          <td className="py-1.5 text-muted-foreground">{row.inclusionReason ?? row.inclusion_reason ?? '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                          {!(strategyDetail.versions as unknown[])?.length && (
                            <div className="text-sm text-muted-foreground">尚无版本 — 点击「新版本」创建。</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {!strategies.length && <div className="py-8 text-center text-sm text-muted-foreground">{loading ? '加载中…' : '暂无策略'}</div>}
            </CardContent>
          </Card>
        )}

        {tab === 'portfolios' && (
          <Card className="glass-strong">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">组合（{portfolios.length}）</CardTitle>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={includeClosed} onChange={(event) => setIncludeClosed(event.target.checked)} />
                  包含已关闭
                </label>
                <button
                  type="button"
                  onClick={() => openAction({ kind: 'createPortfolio' })}
                  className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white"
                >
                  <PlusCircle className="h-4 w-4" /> 新建组合
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">组合</th>
                      <th className="px-3 py-2">策略</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">NAV/份</th>
                      <th className="px-3 py-2">AUM</th>
                      <th className="px-3 py-2">总份数</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolios.map((portfolio) => (
                      <tr key={portfolio.id} className="border-b border-ink/5 align-top">
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => void togglePortfolio(portfolio)} className="text-left font-medium">
                            {portfolio.name}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{portfolio.strategyName}（{portfolio.strategySlug}）</td>
                        <td className="px-3 py-2.5">
                          <select
                            value={portfolio.status}
                            onChange={(event) => void setStatus(portfolio, event.target.value)}
                            className="rounded-lg border border-ink/10 bg-white/80 px-2 py-1 text-xs"
                          >
                            {['draft', 'pilot', 'active', 'closed'].map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">{portfolio.navPerUnit ?? '-'}</td>
                        <td className="px-3 py-2.5">{portfolio.aumUsd ?? '0'}</td>
                        <td className="px-3 py-2.5">{portfolio.totalUnits ?? '0'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button type="button" onClick={() => void computeNav(portfolio)} className="flex items-center gap-1 rounded-lg bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-500/20">
                              <Gauge className="h-3.5 w-3.5" /> NAV
                            </button>
                            <button type="button" onClick={() => void loadDrift(portfolio)} className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20">
                              <Route className="h-3.5 w-3.5" /> 漂移
                            </button>
                            <button type="button" onClick={() => void loadRisk(portfolio)} className="flex items-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-500/20">
                              <ClipboardCheck className="h-3.5 w-3.5" /> 风控
                            </button>
                            <button type="button" onClick={() => openAction({ kind: 'planRebalance', portfolio })} className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-500/20">
                              <Play className="h-3.5 w-3.5" /> 调仓计划
                            </button>
                            <button type="button" onClick={() => void reconcile(portfolio)} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20">
                              <Scale className="h-3.5 w-3.5" /> 对账
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!portfolios.length && (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                          {loading ? '加载中…' : '暂无组合 — 先在策略页激活版本后创建组合'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {expandedPortfolio && portfolioDetail && (
                <div className="space-y-3 rounded-2xl bg-white/60 p-4 ring-1 ring-ink/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{portfolioDetail.name} — 持仓与运行</div>
                    <div className="text-xs text-muted-foreground">
                      现金 {portfolioDetail.cashBalanceUsd ?? '0'} · 份数 {portfolioDetail.totalUnits ?? '0'} · NAV {portfolioDetail.navPerUnit ?? '-'}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-3">资产</th>
                          <th className="py-1 pr-3">数量</th>
                          <th className="py-1 pr-3">最新价</th>
                          <th className="py-1 pr-3">市值</th>
                          <th className="py-1 pr-3">目标权重</th>
                          <th className="py-1 pr-3">实际权重</th>
                          <th className="py-1">浮动盈亏</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(portfolioDetail.holdings as Array<Record<string, any>>)?.map((holding) => (
                          <tr key={holding.assetId ?? holding.asset_id} className="border-t border-ink/5">
                            <td className="py-1.5 pr-3">{holding.name ?? holding.slug}</td>
                            <td className="py-1.5 pr-3">{holding.quantity ?? '0'}</td>
                            <td className="py-1.5 pr-3">{holding.priceUsd ?? '-'}</td>
                            <td className="py-1.5 pr-3">{holding.marketValueUsd ?? '0'}</td>
                            <td className="py-1.5 pr-3">{holding.targetWeightPct ?? '-'}%</td>
                            <td className="py-1.5 pr-3">{holding.actualWeightPct ?? '-'}%</td>
                            <td className="py-1.5">{holding.unrealizedPnlUsd ?? '-'}</td>
                          </tr>
                        ))}
                        {!(portfolioDetail.holdings as unknown[])?.length && (
                          <tr>
                            <td colSpan={7} className="py-4 text-center text-muted-foreground">暂无持仓（等待申购/建仓）</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {driftView && (
                    <div className="rounded-xl bg-amber-500/5 p-3 text-xs">
                      <span className="font-medium">漂移：最大 {driftView.maxAbsDriftPct}%（阈值 {driftView.thresholdPct}%）→ {driftView.needsRebalance ? '需要调仓' : '无需调仓'}</span>
                    </div>
                  )}
                  {riskView && (
                    <div className="rounded-xl bg-slate-500/5 p-3 text-xs">
                      <span className="font-medium">风控：{riskView.status === 'ok' ? '✅ 通过' : riskView.status === 'warn' ? '⚠️ 告警' : '⛔ 阻断'}</span>
                      <ul className="mt-1 space-y-0.5 text-muted-foreground">
                        {(riskView.checks as Array<Record<string, any>>)?.map((check, index) => (
                          <li key={`${check.code}-${index}`}>
                            [{check.severity}] {check.code}: {check.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">调仓运行</div>
                    <div className="space-y-1.5">
                      {portfolioRuns.map((run) => (
                        <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs ring-1 ring-ink/[0.04]">
                          <button type="button" className="flex items-center gap-2" onClick={() => void openRun(run.id)}>
                            <span className={cn('rounded-full px-2 py-0.5', STATUS_STYLE[run.status] ?? 'bg-slate-400/20')}>{run.status}</span>
                            <span className="text-muted-foreground">{String(run.created_at ?? run.createdAt ?? '').slice(0, 19)}</span>
                            <span>{run.trigger_type ?? run.triggerType ?? ''}</span>
                            <span>换手 {run.estimated_turnover_pct ?? run.estimatedTurnoverPct ?? '-'}%</span>
                          </button>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => void openRun(run.id)} className="rounded-lg bg-white px-2 py-1 font-medium ring-1 ring-ink/10 hover:bg-ink/5">
                              详情
                            </button>
                            {(run.status === 'planned' || run.status === 'running') && (
                              <button type="button" onClick={() => openAction({ kind: 'executeRun', run })} className="rounded-lg bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 hover:bg-emerald-500/20">
                                执行
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {!portfolioRuns.length && <div className="text-xs text-muted-foreground">尚无运行记录 — 点击「调仓计划」生成。</div>}
                    </div>
                  </div>

                  {runDetail && (
                    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-ink/[0.04]">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium">运行 {String(runDetail.id).slice(0, 8)} · {runDetail.status}</span>
                        <button type="button" onClick={() => setRunDetail(null)} className="text-muted-foreground hover:text-ink">
                          收起
                        </button>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-1 pr-3">方向</th>
                            <th className="py-1 pr-3">资产</th>
                            <th className="py-1 pr-3">目标数量</th>
                            <th className="py-1 pr-3">预估价</th>
                            <th className="py-1 pr-3">已成交</th>
                            <th className="py-1 pr-3">状态</th>
                            <th className="py-1 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(runDetail.orders as Array<Record<string, any>>)?.map((order) => (
                            <tr key={order.id} className="border-t border-ink/5">
                              <td className="py-1.5 pr-3">{order.side === 'buy' ? '买入' : '卖出'}</td>
                              <td className="py-1.5 pr-3">{order.asset_slug ?? order.assetSlug ?? String(order.asset_id).slice(0, 8)}</td>
                              <td className="py-1.5 pr-3">{order.target_quantity ?? order.targetQuantity}</td>
                              <td className="py-1.5 pr-3">{order.estimated_price ?? order.estimatedPrice ?? '-'}</td>
                              <td className="py-1.5 pr-3">
                                {order.executed_quantity ?? order.executedQuantity ?? '-'}
                                {order.average_fill_price ?? order.averageFillPrice ? ` @ ${order.average_fill_price ?? order.averageFillPrice}` : ''}
                              </td>
                              <td className="py-1.5 pr-3">
                                <span className={cn('rounded-full px-2 py-0.5', STATUS_STYLE[order.status] ?? 'bg-slate-400/20')}>{order.status}</span>
                              </td>
                              <td className="py-1.5 text-right">
                                {order.status !== 'filled' && order.status !== 'cancelled' && (
                                  <button type="button" onClick={() =>
                                      openAction(
                                        { kind: 'recordFill', order },
                                        { qty: String(order.target_quantity ?? order.targetQuantity ?? ''), price: String(order.estimated_price ?? order.estimatedPrice ?? '') },
                                      )
                                    } className="rounded-lg bg-sky-500/10 px-2 py-1 font-medium text-sky-600 hover:bg-sky-500/20">
                                    回填成交
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {runDetail.risk_evaluation && (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          <Info className="mr-1 inline h-3 w-3" />
                          风险验证：{(runDetail.risk_evaluation as Record<string, any>).status ?? '-'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'reconciliations' && (
          <Card className="glass-strong">
            <CardHeader>
              <CardTitle className="text-lg">对账记录（最近 50 条）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2">时间</th>
                      <th className="px-3 py-2">组合</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2">账本现金（原子）</th>
                      <th className="px-3 py-2">组合现金（原子）</th>
                      <th className="px-3 py-2">差异</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.map((run) => (
                      <tr key={run.id} className="border-b border-ink/5">
                        <td className="px-3 py-2.5 text-xs">{run.completed_at ? new Date(run.completed_at).toLocaleString('zh-CN') : '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">{String(run.source_reference ?? '').replace('basket-portfolio:', '').slice(0, 8)}…</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[run.state] ?? 'bg-slate-400/20')}>
                            {run.state === 'matched' ? '一致' : run.state}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{run.expected_atomic_balance ?? '-'}</td>
                        <td className="px-3 py-2.5">{run.observed_atomic_balance ?? '-'}</td>
                        <td className="px-3 py-2.5">{run.difference_atomic_amount ?? '-'}</td>
                      </tr>
                    ))}
                    {!reconciliations.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                          {loading ? '加载中…' : '暂无对账记录'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => { if (!open) setAction(null) }}
        title={dialog?.title ?? ''}
        description={dialog?.description}
        details={dialog?.details}
        typeToConfirm={dialog?.typeToConfirm}
        confirmLabel={dialog?.confirmLabel}
        destructive={dialog?.destructive}
        confirmDisabled={dialog?.confirmDisabled}
        onConfirm={async () => { await dialog?.run() }}
      >
        {dialog?.body}
      </ConfirmDialog>

      <AllocationDialog
        open={allocTarget !== null}
        onClose={() => setAllocTarget(null)}
        strategyName={allocTarget?.strategy.name ?? ''}
        versionLabel={allocTarget ? `v${allocTarget.version.version}` : ''}
        onSubmit={submitAllocation}
      />
    </AdminLayout>
  )
}
