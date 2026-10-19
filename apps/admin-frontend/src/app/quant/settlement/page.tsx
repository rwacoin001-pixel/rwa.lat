'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Panel, PageHeader, RefreshButton, StatChip, formatDateTime, shortId, useApi } from '@/components/console/framework'
import { adminErrorMessage } from '@/lib/admin-errors'
import { formatAtomic } from '@/lib/money'
import type { QuantProduct } from '../page'

type Settlement = {
  id: string; tradeDate: string; grossReturnPct: string; netReturnPct: string | null; status: 'draft' | 'approved' | 'posted' | 'voided'; note: string | null
  enteredBy: string; approvedBy: string | null; largeMoveConfirmed: boolean; indexAfter: string | null; usersCount: number | null
  principalAtomic: string | null; grossAtomic: string | null; mgmtFeeAtomic: string | null; perfFeeAtomic: string | null; paidAtomic: string | null
  principalLossAtomic: string | null; redemptionPrincipalAtomic: string | null; redemptionFeeAtomic: string | null; postedAt: string | null; createdAt: string
}

const STATUS: Record<string, string> = { draft: '待确认', approved: '已确认(待过账)', posted: '已结算', voided: '已作废' }
const usdt = (atomic?: string | null) => (atomic === null || atomic === undefined ? '—' : formatAtomic(atomic, 6, { group: true }))
const pct = (value?: string | null, digits = 4) => (value === null || value === undefined ? '—' : `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(digits)}%`)

export default function QuantSettlementPage() {
  const products = useApi<QuantProduct[]>('/api/admin/quant/products')
  const product = products.data?.[0]
  const settlements = useApi<Settlement[]>(product ? `/api/admin/quant/products/${product.slug}/settlements?limit=60` : null)
  const [tradeDate, setTradeDate] = useState('')
  const [grossReturnPct, setGross] = useState('')
  const [note, setNote] = useState('')
  const [confirmLarge, setConfirmLarge] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { if (product?.nextTradeDate) setTradeDate(product.nextTradeDate) }, [product?.nextTradeDate])

  const call = async (path: string, body: unknown, done: string) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/admin/quant/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(adminErrorMessage(result, response.status))
      setMessage(done)
      products.reload()
      settlements.reload()
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  const enter = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!product) return
    if (!window.confirm(`确认录入 ${tradeDate} 的策略真实毛收益率 ${grossReturnPct}%?录入后还需要你再确认一次才会结算。`)) return
    if (await call(`products/${product.slug}/settlements`, { tradeDate, grossReturnPct, note: note || undefined }, `已录入 ${tradeDate},请核对后确认结算`)) { setGross(''); setNote('') }
  }

  const drafts = (settlements.data ?? []).filter((row) => row.status === 'draft' || row.status === 'approved')
  const limit = product ? Number(product.max_daily_move_pct) : 5

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="每日结算" subtitle="录入 → 确认 → 自动过账" actions={<RefreshButton loading={products.loading || settlements.loading} onClick={() => { products.reload(); settlements.reload() }} />} />
        {(products.error || settlements.error) && <p role="alert" className="text-sm text-red-500">{products.error || settlements.error}</p>}
        {message && <p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
        {product && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatChip label="下一个待结算交易日" value={product.nextTradeDate ?? '未设置'} sub={product.nextTradeDate ? '只能按顺序结算,不能跳日' : <Link href="/quant" className="underline">先到产品配置设置首个交易日</Link>} />
              <StatChip label="已结算至" value={product.last_settled_date ?? '—'} />
              <StatChip label="产品净值指数" value={Number(product.index_value).toFixed(6)} />
              <StatChip label="在投本金 USDT" value={usdt(product.totals.principalAtomic)} sub={`${product.totals.users} 位用户 · ${product.totals.pendingRedemptions} 笔赎回待兑付`} />
            </div>

            <Panel title="录入当日真实收益" subtitle="填写量化策略当天的真实毛收益率(未扣费用),正数为盈利,负数为亏损。交易日结束后才能录入。">
              <form onSubmit={enter} className="grid gap-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
                <label className="space-y-1.5 text-sm"><span className="block">交易日</span><input value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2" /></label>
                <label className="space-y-1.5 text-sm"><span className="block">毛收益率 %</span><input value={grossReturnPct} onChange={(e) => setGross(e.target.value)} placeholder="如 0.35 或 -1.2" className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2" /></label>
                <label className="space-y-1.5 text-sm"><span className="block">备注(可选)</span><input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-transparent px-3 py-2" /></label>
                <button type="submit" disabled={busy || !tradeDate || !grossReturnPct} className="rounded-xl bg-ink px-5 py-2 text-white disabled:opacity-40">录入</button>
              </form>
            </Panel>

            {drafts.length > 0 && (
              <Panel title="待确认 / 待过账" subtitle="核对数字后再点「确认并结算」,结算后立即给用户派发收益或计入亏损,不可撤销">
                <div className="space-y-3">
                  {drafts.map((row) => {
                    const large = Math.abs(Number(row.grossReturnPct)) > limit
                    return (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 p-3 text-sm">
                        <div>
                          <p className="font-medium">{row.tradeDate} · 毛收益 <span className={Number(row.grossReturnPct) < 0 ? 'text-red-500' : 'text-green-600'}>{pct(row.grossReturnPct)}</span> · {STATUS[row.status]}</p>
                          <p className="text-xs text-text-faint">录入 {shortId(row.enteredBy)} · {formatDateTime(row.createdAt)}{row.note ? ` · ${row.note}` : ''}</p>
                          {large && row.status === 'draft' && <label className="mt-2 flex items-center gap-2 text-xs text-red-500"><input type="checkbox" checked={Boolean(confirmLarge[row.id])} onChange={(e) => setConfirmLarge({ ...confirmLarge, [row.id]: e.target.checked })} />单日波动超过 {limit}%,我已核对无误</label>}
                        </div>
                        <div className="flex gap-2">
                          {row.status === 'draft' && <button disabled={busy || (large && !confirmLarge[row.id])}
                            onClick={() => { if (window.confirm(`确认确认并结算 ${row.tradeDate}?结算后会立即给用户派发收益或计入亏损,不可撤销。`)) void call(`settlements/${row.id}/approve`, { confirmLargeMove: Boolean(confirmLarge[row.id]) }, `${row.tradeDate} 已结算`) }}
                            className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-40">确认并结算</button>}
                          {row.status === 'approved' && <button disabled={busy} onClick={() => void call(`settlements/${row.id}/post`, {}, `${row.tradeDate} 已重新过账`)} className="rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-40">重试过账</button>}
                          <button disabled={busy} onClick={() => { if (window.confirm('作废后可重新录入这一天,确认?')) void call(`settlements/${row.id}/void`, {}, '已作废') }} className="rounded-xl border px-4 py-2 disabled:opacity-40">作废</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )}

            <Panel title="结算历史" subtitle="金额单位 USDT;净收益率 = 毛收益率 − 当日管理费">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="border-b border-ink/10 text-text-faint">{['交易日', '状态', '毛收益率', '净收益率', '净值指数', '用户数', '在投本金', '已派发收益', '亏损计入本金', '管理费', '业绩提成', '赎回本金', '赎回费', '录入/确认'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody>
                    {(settlements.data ?? []).filter((row) => row.status !== 'voided').map((row) => (
                      <tr key={row.id} className="border-b border-ink/5 tabular-nums">
                        <td className="whitespace-nowrap px-3 py-2">{row.tradeDate}</td><td className="px-3">{STATUS[row.status]}</td>
                        <td className="px-3">{pct(row.grossReturnPct)}</td><td className="px-3">{pct(row.netReturnPct)}</td>
                        <td className="px-3">{row.indexAfter ? Number(row.indexAfter).toFixed(6) : '—'}</td><td className="px-3">{row.usersCount ?? '—'}</td>
                        <td className="px-3">{usdt(row.principalAtomic)}</td><td className="px-3">{usdt(row.paidAtomic)}</td><td className="px-3">{usdt(row.principalLossAtomic)}</td>
                        <td className="px-3">{usdt(row.mgmtFeeAtomic)}</td><td className="px-3">{usdt(row.perfFeeAtomic)}</td><td className="px-3">{usdt(row.redemptionPrincipalAtomic)}</td><td className="px-3">{usdt(row.redemptionFeeAtomic)}</td>
                        <td className="whitespace-nowrap px-3">{shortId(row.enteredBy)} / {row.approvedBy ? shortId(row.approvedBy) : '—'}</td>
                      </tr>
                    ))}
                    {!settlements.loading && !(settlements.data ?? []).length && <tr><td colSpan={14} className="px-3 py-8 text-center text-text-faint">还没有结算记录</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
