'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, Sparkles } from 'lucide-react'

type FacetClass = { assetClass: string; total: number; priced: number; scored: number; aboveMinScore: number; maxScore: number | null; inDefaultSet: boolean }
type Facets = { minScore: number; totalCandidates: number; defaultClasses: string[]; classes: FacetClass[] }

const CLASS_LABELS: Record<string, string> = {
  equity: '股权',
  fund: '基金',
  commodity: '商品',
  treasury: '国债',
  money_market: '货币市场',
  bond: '债券',
  stable_value: '稳定价值',
  real_estate: '不动产',
}

export type AllocationParams = {
  assetClasses: string[]
  minScore: number
  maxAssets: number
  cashBufferPct: number
}

export function AllocationDialog({
  open,
  onClose,
  strategyName,
  versionLabel,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  strategyName: string
  versionLabel: string
  onSubmit: (params: AllocationParams) => Promise<boolean>
}) {
  const [facets, setFacets] = useState<Facets | null>(null)
  const [loadingFacets, setLoadingFacets] = useState(false)
  const [facetsError, setFacetsError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [minScore, setMinScore] = useState(60)
  const [maxAssets, setMaxAssets] = useState(12)
  const [cashBuffer, setCashBuffer] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadFacets = useCallback(async (score: number, initial = false) => {
    setLoadingFacets(true)
    setFacetsError('')
    try {
      const res = await fetch(`/api/admin/basket/candidate-facets?minScore=${score}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data?.message as string) || `加载失败 (HTTP ${res.status})`)
      const loaded = data as Facets
      setFacets(loaded)
      if (initial) {
        // 默认勾选：当前评分线下确实有候选的类别（避免“无候选”盲猜）
        const viable = loaded.classes.filter((row) => row.aboveMinScore > 0)
        setSelected(new Set((viable.length ? viable : loaded.classes).map((row) => row.assetClass)))
      }
      return loaded
    } catch (error) {
      setFacetsError(error instanceof Error ? error.message : '加载失败')
      return null
    } finally {
      setLoadingFacets(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setMinScore(60)
    setMaxAssets(12)
    setCashBuffer(5)
    void loadFacets(60, true)
  }, [open, loadFacets])

  const onScoreChange = (value: number) => {
    setMinScore(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void loadFacets(value)
    }, 350)
  }

  const toggleClass = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const preview = useMemo(() => {
    if (!facets) return { candidates: 0, capped: 0 }
    const candidates = facets.classes.filter((row) => selected.has(row.assetClass)).reduce((sum, row) => sum + row.aboveMinScore, 0)
    return { candidates, capped: Math.min(candidates, maxAssets) }
  }, [facets, selected, maxAssets])

  const canSubmit = !submitting && !loadingFacets && preview.candidates > 0 && selected.size > 0

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const ok = await onSubmit({
        assetClasses: Array.from(selected),
        minScore,
        maxAssets,
        cashBufferPct: cashBuffer,
      })
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-[22px] border-white/70 bg-white/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-mint" />
            生成目标配置
          </DialogTitle>
          <DialogDescription>
            {strategyName} · {versionLabel} — 依据确定性评分从资产目录中选入候选并分配权重（不接真实资金）。
          </DialogDescription>
        </DialogHeader>

        {/* 类别选择 */}
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">资产类别（可多选）</p>
              <p className="text-xs text-text-faint">
                {loadingFacets ? '统计中…' : facets ? `全目录候选 ≥${minScore} 分：${facets.totalCandidates} 个` : ''}
              </p>
            </div>
            {facetsError && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {facetsError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(facets?.classes ?? []).map((row) => {
                const active = selected.has(row.assetClass)
                const empty = row.aboveMinScore === 0
                return (
                  <button
                    key={row.assetClass}
                    type="button"
                    onClick={() => toggleClass(row.assetClass)}
                    title={`共 ${row.total} 个 · 有行情 ${row.priced} · ≥${minScore} 分 ${row.aboveMinScore}${row.maxScore ? ` · 最高 ${row.maxScore}` : ''}`}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200',
                      active
                        ? 'bg-mint text-white shadow-sm'
                        : 'bg-ink/[0.05] text-text-secondary hover:bg-ink/[0.09]',
                      empty && !active && 'opacity-60',
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {CLASS_LABELS[row.assetClass] ?? row.assetClass}
                    <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-white/25' : empty ? 'bg-amber-500/15 text-amber-600' : 'bg-ink/[0.07]')}>
                      {row.aboveMinScore}
                    </span>
                  </button>
                )
              })}
              {!facets && !loadingFacets && !facetsError && <span className="text-xs text-text-faint">暂无类别数据</span>}
            </div>
            <p className="mt-2 text-[11px] text-text-faint">徽标数字 = 该类别在当前评分线下可入篮的候选数量（灰色 0 表示需降低评分线或等待行情同步）。</p>
          </div>

          {/* 评分线与参数 */}
          <div className="grid gap-4 rounded-2xl bg-ink/[0.03] p-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">入选最低评分</span>
                <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-sm font-semibold tabular-nums shadow-sm">{minScore}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minScore}
                onChange={(event) => onScoreChange(Number(event.target.value))}
                className="w-full accent-mint"
              />
              <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">最大持仓数</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxAssets}
                  onChange={(event) => setMaxAssets(Math.min(Math.max(Number(event.target.value) || 1, 1), 30))}
                  className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm shadow-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">现金缓冲 %</span>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={cashBuffer}
                  onChange={(event) => setCashBuffer(Math.min(Math.max(Number(event.target.value) || 0, 0), 40))}
                  className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm shadow-sm"
                />
              </label>
            </div>
          </div>

          {/* 预览 */}
          <div
            className={cn(
              'rounded-2xl px-4 py-3 text-sm transition-colors',
              preview.candidates > 0 ? 'bg-emerald-500/8 text-emerald-700' : 'bg-amber-500/10 text-amber-700',
            )}
          >
            {loadingFacets ? (
              '正在统计候选资产…'
            ) : preview.candidates > 0 ? (
              <>
                当前条件下共 <b className="tabular-nums">{preview.candidates}</b> 个候选，将按评分取前 <b className="tabular-nums">{preview.capped}</b> 个入选，
                权重按评分分配（上限截断），预留现金缓冲 <b className="tabular-nums">{cashBuffer}%</b>。
              </>
            ) : (
              <>当前条件没有候选资产 — 请降低评分线、勾选其它类别，或等待下一次行情同步后重试。</>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-ink/[0.05]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all duration-200',
              canSubmit ? 'bg-mint shadow-pill hover:brightness-110' : 'cursor-not-allowed bg-ink/20',
            )}
          >
            <Sparkles className="h-4 w-4" />
            {submitting ? '生成中…' : '生成目标配置'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
