'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type Col, DataTable, EmptyState, ErrorState, PageHeader, Panel, RefreshButton, StatusPill, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { adminErrorMessage } from '@/lib/admin-errors'
import { cn } from '@/lib/utils'
import { Loader2, PlusCircle } from 'lucide-react'

type Rule = {
  productId: string
  revision: number
  state: string
  termsKnowledgeId: string
  termsRevision: number
  content: { riskBand: string; lockDays: number; buyFeeBps: number; buyFeeFixedAtomic: string; redeemFeeBps: number; redeemFeeFixedAtomic: string }
}
type Run = { id: string; userId: string; state: string; failureCode: string | null; updatedAt: string; needsReview: boolean }
type Knowledge = { id: string; publishedRevision: number | null; published: { title: string; productIds: string[] } | null; archivedAt: string | null }

const empty = { riskBand: '', lockDays: '', buyFeeBps: '', buyFeeFixedAtomic: '', redeemFeeBps: '', redeemFeeFixedAtomic: '', termsKnowledgeId: '', termsRevision: '', state: 'disabled', productId: '' }
type Form = typeof empty

const RISK_BANDS = [
  { value: 'conservative', label: '稳健' },
  { value: 'balanced', label: '均衡' },
  { value: 'growth', label: '成长' },
  { value: 'aggressive', label: '进取' },
]
const NUMBER_FIELDS = [
  { key: 'lockDays', label: '锁定天数', step: '1' },
  { key: 'buyFeeBps', label: '买入费用（%）', step: '0.000001' },
  { key: 'buyFeeFixedAtomic', label: '买入固定费用（USDT）', step: '0.000001' },
  { key: 'redeemFeeBps', label: '赎回费用（%）', step: '0.000001' },
  { key: 'redeemFeeFixedAtomic', label: '赎回固定费用（USDT）', step: '0.000001' },
] as const

const FIELD = 'w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[13px] shadow-sm disabled:opacity-60'
const PRIMARY = 'flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110 disabled:opacity-60'

const toAtomic = (v: string) => {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(v)) throw new Error('费用精度最多 6 位')
  const [a, b = ''] = v.split('.')
  return (BigInt(a) * BigInt(1000000) + BigInt(b.padEnd(6, '0'))).toString()
}
const fromAtomic = (v: string) => `${BigInt(v) / BigInt(1000000)}.${(BigInt(v) % BigInt(1000000)).toString().padStart(6, '0')}`

function formOf(row: Rule): Form {
  return {
    riskBand: row.content.riskBand,
    lockDays: String(row.content.lockDays),
    buyFeeBps: String(row.content.buyFeeBps / 100),
    buyFeeFixedAtomic: fromAtomic(row.content.buyFeeFixedAtomic),
    redeemFeeBps: String(row.content.redeemFeeBps / 100),
    redeemFeeFixedAtomic: fromAtomic(row.content.redeemFeeFixedAtomic),
    termsKnowledgeId: row.termsKnowledgeId,
    termsRevision: String(row.termsRevision),
    state: row.state,
    productId: row.productId,
  }
}

async function post(path: string, body: unknown) {
  const response = await fetch(`/api/admin/ai-investment/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(adminErrorMessage(data, response.status))
  return data
}

export default function AiInvestmentPage() {
  const rules = useApi<Rule[]>('/api/admin/ai-investment/rules')
  const runs = useApi<Run[]>('/api/admin/ai-investment/runs')
  const products = useApi<Array<{ id: string; displayName: string }>>('/api/admin/ai-knowledge/products')
  const knowledge = useApi<Knowledge[]>('/api/admin/ai-knowledge')
  const [selected, setSelected] = useState<Rule | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewing, setReviewing] = useState<Run | null>(null)
  const [note, setNote] = useState('')
  const reselect = useRef<string | null>(null)

  const productName = (id: string) => products.data?.find((p) => p.id === id)?.displayName ?? shortId(id, 12)
  const termOptions = (knowledge.data ?? []).filter((k) => k.publishedRevision && !k.archivedAt && k.published?.productIds.includes(form.productId))

  function edit(row: Rule | null) {
    setSelected(row)
    setForm(row ? formOf(row) : { ...empty })
    setError('')
  }

  // 保存后规则列表刷新，重新选中刚保存的规则以取得最新 revision
  useEffect(() => {
    if (!reselect.current || !rules.data) return
    const row = rules.data.find((r) => r.productId === reselect.current)
    reselect.current = null
    if (row) edit(row)
  }, [rules.data])

  const showNotice = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(''), 7000)
  }

  const reloadAll = () => {
    rules.reload()
    runs.reload()
    products.reload()
    knowledge.reload()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const content = {
        expectedRevision: selected?.revision ?? 0,
        state: form.state,
        termsKnowledgeId: form.termsKnowledgeId,
        termsRevision: Number(form.termsRevision),
        riskBand: form.riskBand,
        lockDays: Number(form.lockDays),
        buyFeeBps: Math.round(Number(form.buyFeeBps) * 100),
        buyFeeFixedAtomic: toAtomic(form.buyFeeFixedAtomic),
        redeemFeeBps: Math.round(Number(form.redeemFeeBps) * 100),
        redeemFeeFixedAtomic: toAtomic(form.redeemFeeFixedAtomic),
      }
      await post(`rules/${encodeURIComponent(form.productId)}`, content)
      reselect.current = form.productId
      rules.reload()
      showNotice('规则已保存')
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  // 失败时抛出，由 ConfirmDialog 保持打开并显示错误
  const review = async () => {
    if (!reviewing) return
    await post(`runs/${encodeURIComponent(reviewing.id)}/review`, { note: note.trim() })
    showNotice('已对账并关闭剩余任务')
    runs.reload()
  }

  const runColumns: Col<Run>[] = [
    { key: 'updatedAt', label: '更新时间', render: (row) => <span className="text-xs text-text-faint">{formatDateTime(row.updatedAt)}</span> },
    { key: 'state', label: '状态', render: (row) => <StatusPill value={row.state} /> },
    { key: 'id', label: '运行 ID', render: (row) => <span className="font-mono text-xs" title={row.id}>{shortId(row.id, 12)}</span> },
    { key: 'userId', label: '用户', render: (row) => <span className="font-mono text-xs" title={row.userId}>{shortId(row.userId, 12)}</span> },
    { key: 'failureCode', label: '失败码', render: (row) => <span className="text-xs text-text-faint">{row.failureCode ?? '—'}</span> },
    {
      key: 'ops',
      label: '',
      className: 'text-right',
      render: (row) =>
        row.needsReview ? (
          <button
            type="button"
            onClick={() => { setNote(''); setReviewing(row) }}
            className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/20"
          >
            人工核实
          </button>
        ) : null,
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="AI 投资管理"
          subtitle="自动投资规则与执行记录"
          actions={
            <>
              <button type="button" onClick={() => edit(null)} className={PRIMARY}>
                <PlusCircle className="h-4 w-4" /> 新增规则
              </button>
              <RefreshButton loading={rules.loading || runs.loading} onClick={reloadAll} />
            </>
          }
        />

        {notice && <div role="status" className="animate-pop rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">{notice}</div>}

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title={`投资规则（${rules.data?.length ?? '…'}）`} subtitle="点击规则进行编辑" delay={40}>
            {rules.error ? (
              <ErrorState error={rules.error} onRetry={rules.reload} />
            ) : rules.loading && !rules.data ? (
              <p className="py-8 text-center text-sm text-text-faint">加载中…</p>
            ) : !rules.data?.length ? (
              <EmptyState hint="暂无规则，点击「新增规则」创建" />
            ) : (
              <div className="space-y-1.5">
                {rules.data.map((row) => (
                  <button
                    key={row.productId}
                    type="button"
                    onClick={() => edit(row)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-colors',
                      selected?.productId === row.productId ? 'bg-white shadow-sm ring-1 ring-ink/10' : 'bg-ink/[0.03] hover:bg-ink/[0.05]',
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{productName(row.productId)}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusPill value={row.state} />
                      <span className="font-mono text-xs text-text-faint">v{row.revision}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={selected ? `编辑规则 · ${productName(selected.productId)}` : '新增规则'}
            subtitle="规则启用不会开启自动交易；执行开关与隔离验收独立控制。"
            className="xl:col-span-2"
            delay={90}
          >
            {(products.error || knowledge.error) && (
              <div className="mb-3">
                <ErrorState error={products.error || knowledge.error} onRetry={() => { products.reload(); knowledge.reload() }} />
              </div>
            )}
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">产品</span>
                <select
                  required
                  disabled={!!selected || busy}
                  className={FIELD}
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value, termsKnowledgeId: '', termsRevision: '' }))}
                >
                  <option value="">请选择</option>
                  {products.data?.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">公开条款版本</span>
                <select
                  required
                  disabled={busy}
                  className={FIELD}
                  value={form.termsKnowledgeId}
                  onChange={(e) => {
                    const k = knowledge.data?.find((item) => item.id === e.target.value)
                    setForm((f) => ({ ...f, termsKnowledgeId: e.target.value, termsRevision: String(k?.publishedRevision ?? '') }))
                  }}
                >
                  <option value="">{form.productId ? (termOptions.length ? '请选择' : '该产品暂无已发布条款') : '请先选择产品'}</option>
                  {termOptions.map((k) => <option key={k.id} value={k.id}>{k.published?.title} · v{k.publishedRevision}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">风险等级</span>
                <select required disabled={busy} className={FIELD} value={form.riskBand} onChange={(e) => setForm((f) => ({ ...f, riskBand: e.target.value }))}>
                  <option value="">请选择</option>
                  {RISK_BANDS.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}
                </select>
              </label>
              {NUMBER_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs text-text-secondary">{field.label}</span>
                  <input
                    required
                    min="0"
                    type="number"
                    step={field.step}
                    disabled={busy}
                    className={cn(FIELD, 'tabular-nums')}
                    value={form[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1 block text-xs text-text-secondary">状态</span>
                <select disabled={busy} className={FIELD} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
                  <option value="disabled">停用</option>
                  <option value="enabled">启用规则</option>
                </select>
              </label>
              <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
                {error && <p role="alert" className="mr-auto text-sm text-negative">{error}</p>}
                {selected && (
                  <button type="button" disabled={busy} onClick={() => edit(selected)} className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-ink/[0.05] disabled:opacity-60">
                    重置
                  </button>
                )}
                <button type="submit" disabled={busy} className={PRIMARY}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  保存规则
                </button>
              </div>
            </form>
          </Panel>
        </div>

        <Panel title={`执行记录（${runs.data?.length ?? '…'}）`} subtitle="需人工核实的运行可在此对账并关闭剩余任务" delay={140} pad={false}>
          <div className="px-5 pb-5">
            <DataTable columns={runColumns} rows={runs.data} loading={runs.loading} error={runs.error} onReload={runs.reload} emptyHint="暂无执行记录" />
          </div>
        </Panel>

        <ConfirmDialog
          open={Boolean(reviewing)}
          onOpenChange={(open) => { if (!open) setReviewing(null) }}
          title="对账并关闭剩余任务"
          description="未完成的真实申请会阻止关闭；已入账资金不自动扣回。"
          details={reviewing ? [
            { label: '运行 ID', value: reviewing.id, mono: true },
            { label: '用户', value: reviewing.userId, mono: true },
            { label: '状态', value: reviewing.state },
          ] : []}
          confirmLabel="确认关闭"
          confirmDisabled={!note.trim()}
          onConfirm={review}
        >
          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">人工核实记录（必填）</span>
            <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} />
          </label>
        </ConfirmDialog>
      </div>
    </AdminLayout>
  )
}
