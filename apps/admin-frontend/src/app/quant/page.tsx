'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, Panel, RefreshButton, StatChip, useApi } from '@/components/console/framework'
import { adminErrorMessage } from '@/lib/admin-errors'
import { formatAtomic } from '@/lib/money'

type Tier = { maxDays: number; bps: number }
export type QuantProduct = {
  id: string; slug: string; name: string; summary: string | null; status: 'draft' | 'pilot' | 'active' | 'paused' | 'closed'
  timezone: string; cutoff_time: string; mgmt_fee_bps: number; perf_fee_bps: number; redemption_fee_tiers: Tier[]
  min_subscription_atomic: string; min_redemption_atomic: string; max_daily_move_pct: string
  target_annual_min_pct: string | null; target_annual_max_pct: string | null
  index_value: string; hwm_index: string; first_trade_date: string | null; last_settled_date: string | null; nextTradeDate: string | null
  totals: { principalAtomic: string; users: number; pendingRedemptions: number }
  ledger: { poolAtomic: string; poolMatchesLots: boolean; feeAtomic: string; treasuryAtomic: string }
}

const STATUS_TEXT: Record<string, string> = { draft: '草稿(用户不可见)', pilot: '试运行', active: '正式开放', paused: '已暂停', closed: '已关闭' }
const usdt = (atomic?: string | null) => (atomic === undefined || atomic === null ? '—' : formatAtomic(atomic, 6, { group: true }))

export default function QuantOverviewPage() {
  const products = useApi<QuantProduct[]>('/api/admin/quant/products')
  const product = products.data?.[0]
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!product) return
    setForm({
      mgmtFeeBps: String(product.mgmt_fee_bps), perfFeeBps: String(product.perf_fee_bps),
      minSubscriptionUsd: formatAtomic(product.min_subscription_atomic, 6), minRedemptionUsd: formatAtomic(product.min_redemption_atomic, 6),
      maxDailyMovePct: product.max_daily_move_pct, targetAnnualMinPct: product.target_annual_min_pct ?? '', targetAnnualMaxPct: product.target_annual_max_pct ?? '',
      cutoffTime: product.cutoff_time, firstTradeDate: product.first_trade_date ?? '', summary: product.summary ?? '',
    })
  }, [product])

  const patch = async (body: Record<string, unknown>, done: string) => {
    if (!product) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/quant/products/${product.slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(adminErrorMessage(result, response.status))
      setMessage(done)
      products.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const body: Record<string, unknown> = {
      mgmtFeeBps: Number(form.mgmtFeeBps), perfFeeBps: Number(form.perfFeeBps), minSubscriptionUsd: form.minSubscriptionUsd, minRedemptionUsd: form.minRedemptionUsd,
      maxDailyMovePct: form.maxDailyMovePct, cutoffTime: form.cutoffTime, summary: form.summary,
    }
    if (form.targetAnnualMinPct !== '') body.targetAnnualMinPct = form.targetAnnualMinPct
    if (form.targetAnnualMaxPct !== '') body.targetAnnualMaxPct = form.targetAnnualMaxPct
    if (form.firstTradeDate && !product?.last_settled_date) body.firstTradeDate = form.firstTradeDate
    void patch(body, '配置已保存')
  }

  const field = (key: string, label: string, hint?: string, disabled?: boolean) => (
    <label className="space-y-1.5 text-sm">
      <span className="block">{label}</span>
      <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} disabled={disabled} className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2 disabled:opacity-50" />
      {hint && <span className="block text-[11px] text-text-faint">{hint}</span>}
    </label>
  )

  const treasury = product ? BigInt(product.ledger.treasuryAtomic) : BigInt(0)
  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="考拉量化" subtitle="主打产品 · 配置与总览" actions={<RefreshButton loading={products.loading} onClick={products.reload} />} />
        {products.error && <p role="alert" className="text-sm text-red-500">{products.error}</p>}
        {message && <p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
        {product && (
          <>
            <div className="glass-strong flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-sm">
              <div>
                <p className="text-base font-semibold">{product.name} <span className="ml-2 rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-xs font-normal">{STATUS_TEXT[product.status]}</span></p>
                <p className="mt-1 text-xs text-text-faint">下一个待结算交易日:{product.nextTradeDate ?? '未设置首个交易日'} · 已结算至:{product.last_settled_date ?? '尚未开始'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/quant/settlement" className="rounded-xl bg-ink px-4 py-2 text-white">每日结算</Link>
                {product.status === 'draft' && <button disabled={busy} onClick={() => void patch({ status: 'pilot' }, '已进入试运行')} className="rounded-xl border px-4 py-2 disabled:opacity-40">开始试运行</button>}
                {product.status === 'pilot' && <button disabled={busy} onClick={() => void patch({ status: 'active' }, '已正式开放')} className="rounded-xl border px-4 py-2 disabled:opacity-40">正式开放</button>}
                {['pilot', 'active'].includes(product.status) && <button disabled={busy} onClick={() => void patch({ status: 'paused' }, '已暂停(不影响已有持仓和结算)')} className="rounded-xl border px-4 py-2 disabled:opacity-40">暂停</button>}
                {product.status === 'paused' && <button disabled={busy} onClick={() => void patch({ status: 'active' }, '已恢复开放')} className="rounded-xl border px-4 py-2 disabled:opacity-40">恢复开放</button>}
              </div>
            </div>
            <p className="text-xs text-text-faint">申购/赎回另有两个运营开关(quant.subscriptions / quant.redemptions),默认关闭,需在「运营控制」里打开后用户才能操作。</p>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatChip label="产品净值指数" value={Number(product.index_value).toFixed(6)} sub={`高水位 ${Number(product.hwm_index).toFixed(6)}`} />
              <StatChip label="在投本金 USDT" value={usdt(product.totals.principalAtomic)} sub={`${product.totals.users} 位用户`} />
              <StatChip label="待结算赎回" value={product.totals.pendingRedemptions} sub="将在下一个结算日兑付" />
              <StatChip label="累计费用收入 USDT" value={usdt(product.ledger.feeAtomic)} />
            </div>

            <Panel title="账本核对" subtitle="本金池余额必须等于所有持仓本金之和;兑付准备金为负数,表示平台已为用户收益垫付的金额">
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>本金池 USDT<p className="mt-1 text-lg font-semibold tabular-nums">{usdt(product.ledger.poolAtomic)}</p>
                  <p className={product.ledger.poolMatchesLots ? 'text-xs text-green-600' : 'text-xs text-red-500'}>{product.ledger.poolMatchesLots ? '与持仓本金一致' : '与持仓本金不一致,请先排查'}</p></div>
                <div>兑付准备金 USDT<p className={`mt-1 text-lg font-semibold tabular-nums ${treasury < BigInt(0) ? 'text-red-500' : ''}`}>{usdt(product.ledger.treasuryAtomic)}</p>
                  <p className="text-xs text-text-faint">{treasury < BigInt(0) ? '平台已垫付,请及时补足准备金' : '无垫付'}</p></div>
                <div>费用收入 USDT<p className="mt-1 text-lg font-semibold tabular-nums">{usdt(product.ledger.feeAtomic)}</p></div>
              </div>
            </Panel>

            <Panel title="产品配置" subtitle="费率只影响之后的结算日;修改会写入审计日志">
              <form onSubmit={save} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {field('mgmtFeeBps', '管理费(年化,基点)', '150 = 1.5%/年,按日计提')}
                  {field('perfFeeBps', '业绩提成(基点)', '2000 = 20%,仅对高水位以上的新增收益收取')}
                  {field('minSubscriptionUsd', '最小申购 USDT')}
                  {field('minRedemptionUsd', '最小赎回 USDT')}
                  {field('maxDailyMovePct', '单日涨跌幅上限 %', '超过需要复核人二次确认')}
                  {field('cutoffTime', '当日截止时间 (HH:MM)', `按 ${product.timezone} 时区;之后的申赎算下一个交易日`)}
                  {field('targetAnnualMinPct', '目标年化下限 %', '仅作展示,不是承诺;留空则前端不显示')}
                  {field('targetAnnualMaxPct', '目标年化上限 %')}
                  {field('firstTradeDate', '首个交易日 (YYYY-MM-DD)', product.last_settled_date ? '已开始结算,不可修改' : '开放产品前必须设置', Boolean(product.last_settled_date))}
                </div>
                {field('summary', '产品简介')}
                <p className="text-xs text-text-faint">赎回费:{product.redemption_fee_tiers.map((tier) => `持有不足 ${tier.maxDays} 天 ${(tier.bps / 100).toFixed(2)}%`).join(',')},其后免费。</p>
                <button type="submit" disabled={busy} className="rounded-xl bg-ink px-5 py-2 text-white disabled:opacity-40">保存配置</button>
              </form>
            </Panel>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
