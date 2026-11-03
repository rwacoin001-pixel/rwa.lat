'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppShell } from '@/components/ops/AppShell'
import { Confirm } from '@/components/ops/Confirm'
import { sendJson, usePolled, useToday } from '@/components/ops/data'
import { money, sgDateLabel, sgTime } from '@/components/ops/format'
import { BigStatCard, Board, Chip, DangerButton, LimeButton, Money, Notice, OutlineButton, PageTitle, SideCard, Tile, Updated, WhiteButton } from '@/components/ops/ui'

type Product = {
  slug: string; name: string; status: string; cutoff_time: string; max_daily_move_pct: string; index_value: string; last_settled_date: string | null; nextTradeDate: string | null
  totals: { principalAtomic: string; users: number; pendingRedemptions: number }
  ledger: { poolMatchesLots: boolean }
}
type Settlement = {
  id: string; tradeDate: string; grossReturnPct: string; netReturnPct: string | null; status: 'draft' | 'approved' | 'posted' | 'voided'; note: string | null
  usersCount: number | null; paidAtomic: string | null; principalLossAtomic: string | null; indexAfter: string | null; postedAt: string | null; createdAt: string
}
type Preview = {
  tradeDate: string; grossReturnPct: string; netReturnPct: string; indexBefore: string; indexAfter: string; holders: number; principalAtomic: string
  payoutAtomic: string; lossAtomic: string; feesAtomic: string; redemptions: { count: number; principalAtomic: string; feeAtomic: string }
  history: { days: Array<{ tradeDate: string; netReturnPct: string }>; mean: string | null; min: string | null; max: string | null; outsideRange: boolean; largeMove: boolean }
  checks: Array<{ code: string; ok: boolean; message: string }>
}

const pct = (v: string | number | null | undefined, digits = 2) => v === null || v === undefined || v === '' ? '—' : `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(digits)}%`
const STEPS = ['录入收益率', '自动检查', '预览影响', '确认并过账'] as const

/** A trade day is settled on the following day, by the cutoff (Singapore time). */
function cutoffLeft(tradeDate: string | null | undefined, cutoff = '15:00', now = Date.now()) {
  if (!tradeDate) return null
  const next = new Date(Date.parse(`${tradeDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
  return Math.round((Date.parse(`${next}T${cutoff.slice(0, 5)}:00+08:00`) - now) / 60000)
}
const sgToday = (now = Date.now()) => new Date(now + 8 * 3600000).toISOString().slice(0, 10)

/** The console's own words for the core's preview checks; `blocks` = posting must wait until it is fixed. */
const CHECKS: Record<string, { ok: string; bad: string; blocks: boolean }> = {
  already_settled: { ok: '这一天还没有结算过', bad: '这一天已经结算过了', blocks: true },
  trade_date_order: { ok: '是下一个该结算的交易日', bad: '前面还有没结算的交易日，要按顺序结算', blocks: true },
  cutoff: { ok: '在截止时间前', bad: '已过截止时间（仍可结算，用户会晚收到结果）', blocks: false },
  large_move: { ok: '涨跌在日常范围内', bad: '涨跌超出日常范围，需要勾选确认', blocks: false },
  ledger_funded: { ok: '资金池和准备金够用', bad: '资金池与持仓对不上，或不够支付亏损和赎回', blocks: true },
}
const checkText = (c: { code: string; ok: boolean; message: string }) => (CHECKS[c.code] ? (c.ok ? CHECKS[c.code].ok : CHECKS[c.code].bad) : c.message)

/** Last days' net returns as small bars around a zero line (up lime, down red). */
function ReturnRuler({ values, highlight }: { values: number[]; highlight?: number }) {
  const max = Math.max(0.5, ...values.map(Math.abs), Math.abs(highlight ?? 0))
  const all = highlight === undefined ? values : [...values, highlight]
  return (
    <div className="flex h-[84px] items-center gap-1.5" aria-label="近期每日净收益">
      {all.map((v, i) => {
        const h = Math.max(3, (Math.abs(v) / max) * 38)
        const mine = highlight !== undefined && i === all.length - 1
        return (
          <div key={i} className="flex h-full flex-1 flex-col justify-center" title={pct(v)}>
            <div className="flex h-[40px] items-end">{v >= 0 && <div className={cn('mx-auto w-full max-w-[10px] rounded-full', mine ? 'bg-ops-paper' : 'bg-ops-lime')} style={{ height: h }} />}</div>
            <div className="h-px bg-ops-line" />
            <div className="flex h-[40px] items-start">{v < 0 && <div className={cn('mx-auto w-full max-w-[10px] rounded-full', mine ? 'bg-ops-paper' : 'bg-ops-down')} style={{ height: h }} />}</div>
          </div>
        )
      })}
    </div>
  )
}

function Daily() {
  const params = useSearchParams()
  const router = useRouter()
  const view = params.get('view') === 'history' ? 'history' : 'today'
  const products = usePolled<Product[]>('/api/admin/quant/products', 60_000)
  const product = products.data?.[0]
  const settlements = usePolled<Settlement[]>(product ? `/api/admin/quant/products/${product.slug}/settlements?limit=60` : null, 60_000)
  const { reload: reloadToday } = useToday()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t) }, [])

  // A trade date can be settled once it has ended in Singapore, like /console/today counts it.
  const tradeDate = product?.nextTradeDate && product.nextTradeDate < sgToday(now) ? product.nextTradeDate : null
  const todayRow = settlements.data?.find((s) => s.tradeDate === tradeDate && s.status !== 'voided') ?? null
  const preview = usePolled<Preview>(todayRow && todayRow.status !== 'posted' ? `/api/admin/quant/settlements/${todayRow.id}/preview` : null, 0)
  const posted = (settlements.data ?? []).filter((s) => s.status === 'posted')
  const recent = posted.slice(0, 14).map((s) => Number(s.netReturnPct)).reverse()
  const range = posted.slice(0, 30).map((s) => Number(s.netReturnPct))
  const left = cutoffLeft(tradeDate, product?.cutoff_time, now)

  const [gross, setGross] = useState('')
  const [note, setNote] = useState('')
  const [largeOk, setLargeOk] = useState(false)
  const [dialog, setDialog] = useState<'enter' | 'post' | 'void' | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  useEffect(() => { setLargeOk(false) }, [todayRow?.id])

  const nothingDue = Boolean(product) && !tradeDate
  const lastPosted = posted[0] ?? null
  const step = nothingDue ? 4 : !todayRow ? 0 : todayRow.status === 'draft' ? (preview.data ? 2 : 1) : todayRow.status === 'approved' ? 3 : 4
  const grossNumber = Number(gross)
  const grossValid = /^-?\d+(\.\d{1,4})?$/.test(gross.trim())
  const maxMove = Number(product?.max_daily_move_pct ?? 3)
  const outside = grossValid && range.length > 0 && (grossNumber > Math.max(...range) + 0.2 || grossNumber < Math.min(...range) - 0.2)

  const refresh = async () => { await Promise.all([products.reload(), settlements.reload()]); void reloadToday() }
  const enter = async () => {
    if (!product || !tradeDate) return
    if (!grossValid) throw new Error('收益率格式不对，例如 0.35 或 -0.12（最多 4 位小数）。')
    await sendJson(`/api/admin/quant/products/${product.slug}/settlements`, 'POST', { tradeDate, grossReturnPct: gross.trim(), note: note.trim() || undefined })
    setGross(''); setNote('')
    setNotice({ kind: 'ok', text: `已录入 ${tradeDate} 毛收益 ${pct(gross.trim(), 4)}，请看预览后确认。` })
    await refresh()
  }
  const post = async () => {
    if (!todayRow) return
    if (todayRow.status === 'draft') await sendJson(`/api/admin/quant/settlements/${todayRow.id}/approve`, 'POST', { confirmLargeMove: largeOk })
    else await sendJson(`/api/admin/quant/settlements/${todayRow.id}/post`, 'POST', {})
    setNotice({ kind: 'ok', text: `${todayRow.tradeDate} 已结算，${preview.data?.holders ?? ''} 位用户的结果已入账。` })
    await refresh()
  }
  const voidIt = async () => {
    if (!todayRow) return
    await sendJson(`/api/admin/quant/settlements/${todayRow.id}/void`, 'POST', {})
    setNotice({ kind: 'ok', text: `已作废 ${todayRow.tradeDate} 的录入，可以重新录入。` })
    await refresh()
  }

  const p = preview.data
  const blocking = p?.checks.filter((c) => !c.ok && CHECKS[c.code]?.blocks !== false) ?? []
  const needLarge = Boolean(p?.history.largeMove)
  const canPost = Boolean(p) && !blocking.length && (!needLarge || largeOk)

  return (
    <>
      <PageTitle
        title="每日结算"
        meta={<span className="flex flex-wrap gap-x-3"><span>{product?.name ?? '考拉量化'} · 截止 {product?.cutoff_time ?? '15:00'}（新加坡）</span><Updated at={settlements.updatedAt} loading={settlements.loading} /></span>}
        actions={<OutlineButton onClick={() => router.replace(`/quant/daily?view=${view === 'history' ? 'today' : 'history'}`)}>{view === 'history' ? '回到今日' : '历史记录'}</OutlineButton>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <BigStatCard stats={[
          { label: '在投本金', value: <Money atomic={product?.totals.principalAtomic} unit="USDT" places={0} />, hint: product ? `${product.totals.users} 位持有人 · ${product.totals.pendingRedemptions} 笔赎回待处理` : undefined },
          { label: '当前净值', value: product ? Number(product.index_value).toFixed(4) : '—', hint: product?.last_settled_date ? `最近结算 ${product.last_settled_date}` : undefined },
          { label: '近 30 天日均', value: range.length ? pct(range.reduce((a, b) => a + b, 0) / range.length) : '—', hint: range.length ? `最高 ${pct(Math.max(...range))} · 最低 ${pct(Math.min(...range))}` : undefined },
        ]}>
          <div className="mb-1 flex justify-between text-[12px] text-ops-muted"><span>近 14 天每日净收益</span>{grossValid && step === 0 && <span className="text-ops-text">白色是你正在输入的 {pct(grossNumber)}</span>}</div>
          <ReturnRuler values={recent} highlight={grossValid && step === 0 ? grossNumber : undefined} />
        </BigStatCard>

        <SideCard
          label={tradeDate ? `${tradeDate} 的结算` : '待结算的交易日'}
          value={<span className={cn('text-[26px]', step < 4 && left !== null && left < 120 && 'text-ops-warn', step < 4 && left !== null && left <= 0 && 'text-ops-down')}>{nothingDue ? '没有' : step === 4 ? '已结算' : left === null ? '—' : left <= 0 ? '已过截止' : left >= 60 ? `还有 ${Math.floor(left / 60)} 小时 ${left % 60} 分` : `还有 ${left} 分钟`}</span>}
          chips={STEPS.map((s, i) => ({ key: s, label: String(i + 1), sub: s, active: i === Math.min(step, 3) && step < 4 }))}
        >
          <p className="mt-3 text-[13px] text-ops-muted">{nothingDue ? `下一个交易日 ${product?.nextTradeDate ?? '—'} 结束后，第二天 ${product?.cutoff_time?.slice(0, 5) ?? '15:00'} 前结算。` : step === 4 ? `${todayRow?.usersCount ?? ''} 位用户的结果已入账（${sgTime(todayRow?.postedAt)}）。` : `${sgDateLabel(now)} · 现在是第 ${Math.min(step, 3) + 1} 步：${STEPS[Math.min(step, 3)]}`}</p>
        </SideCard>
      </div>

      <div className="h-10" />
      {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}
      {(products.error || settlements.error) && <Notice kind="error">{products.error || settlements.error}</Notice>}

      <Board title={view === 'history' ? '结算记录' : nothingDue ? '没有待结算的交易日' : `${tradeDate ?? ''} · ${step === 4 ? '已完成' : STEPS[Math.min(step, 3)]}`}
        tabs={[{ key: 'today', label: '今日' }, { key: 'history', label: '历史', count: posted.length }]} active={view}
        onTab={(k) => router.replace(`/quant/daily?view=${k}`)}>
        {view === 'history' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead><tr className="text-left text-[12px] text-ops-sub"><th className="px-4 py-3 font-normal">日期</th><th className="px-4 py-3 text-right font-normal">净收益</th><th className="px-4 py-3 text-right font-normal">用户</th><th className="px-4 py-3 text-right font-normal">发放 / 亏损 USDT</th><th className="px-4 py-3 text-right font-normal">结算后净值</th><th className="px-4 py-3 font-normal">状态</th></tr></thead>
              <tbody>
                {(settlements.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-ops-rule">
                    <td className="px-4 py-3">{s.tradeDate}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', Number(s.netReturnPct) < 0 ? 'text-[#C23B33]' : 'text-[#0F7A4A]')}>{pct(s.netReturnPct)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.usersCount ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.principalLossAtomic && s.principalLossAtomic !== '0' ? `-${money(s.principalLossAtomic)}` : money(s.paidAtomic)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.indexAfter ?? '—'}</td>
                    <td className="px-4 py-3"><Chip tone={s.status === 'posted' ? 'up' : s.status === 'voided' ? 'plain' : 'warn'}>{s.status === 'posted' ? '已结算' : s.status === 'voided' ? '已作废' : s.status === 'draft' ? '待确认' : '待过账'}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]">
            <ol className="flex flex-col gap-1">
              {STEPS.map((s, i) => {
                const done = i < step, on = i === Math.min(step, 3) && step < 4
                return (
                  <li key={s} className={cn('flex items-center gap-3 rounded-full px-3 py-3', on && 'bg-ops-bg text-ops-text')}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-medium', done ? 'bg-ops-ink text-ops-lime' : on ? 'bg-ops-lime text-ops-ink' : 'bg-[#F0F1F4] text-[#8A909C]')}>{done ? <Check className="h-4 w-4" /> : i + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{s}</span>
                      <span className={cn('block text-[12px]', on ? 'text-ops-muted' : 'text-ops-sub')}>{['输入策略当天的真实毛收益率', '日期、截止时间、涨跌范围、资金池', '影响多少人、发放或亏损多少', '过账后立即入账，不能撤销'][i]}</span>
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="flex min-h-[360px] flex-col rounded-[24px] bg-ops-bg p-5 text-ops-text sm:p-6">
              {step === 0 && (
                <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (grossValid) setDialog('enter') }}>
                  <div className="text-[13px] text-ops-muted">{tradeDate} · 策略毛收益率</div>
                  <div className="mt-3 flex items-center gap-3">
                    <input autoFocus value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" placeholder="0.00" aria-label="毛收益率（%）"
                      className="w-[220px] rounded-[18px] border border-ops-line bg-ops-card px-5 py-3 text-[34px] tabular-nums outline-none focus:border-ops-lime" />
                    <span className="text-[28px] text-ops-muted">%</span>
                  </div>
                  <p className={cn('mt-3 text-[13px]', !gross ? 'text-ops-muted' : !grossValid ? 'text-ops-down' : Math.abs(grossNumber) > maxMove ? 'text-ops-down' : outside ? 'text-ops-warn' : 'text-ops-muted')}>
                    {!gross ? `近 30 天净收益在 ${range.length ? `${pct(Math.min(...range))} 到 ${pct(Math.max(...range))}` : '—'} 之间。` : !grossValid ? '格式不对，例如 0.35 或 -0.12。' : Math.abs(grossNumber) > maxMove ? `超出单日 ±${maxMove}% 的范围，确认前需要单独勾选。` : outside ? '比近 30 天的范围更大，请再核对一次。' : '在近 30 天的正常范围内。'}
                  </p>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="备注（可选，例如数据来源）" className="mt-4 rounded-[18px] border border-ops-line bg-ops-card px-4 py-3 text-[14px] outline-none focus:border-ops-lime" />
                  <div className="mt-auto flex justify-end pt-6"><LimeButton type="submit" disabled={!grossValid || !tradeDate}>下一步：检查与预览</LimeButton></div>
                </form>
              )}

              {(step === 1 || step === 2 || step === 3) && todayRow && (
                <div className="flex flex-1 flex-col">
                  <div className="text-[13px] text-ops-muted">{todayRow.tradeDate} · 毛收益 {pct(todayRow.grossReturnPct, 4)}{p && ` · 扣费后净收益 ${pct(p.netReturnPct, 4)}`}</div>
                  {!p && !preview.error && <p className="mt-6 text-[14px] text-ops-muted">正在计算影响…</p>}
                  {preview.error && <p className="mt-6 text-[14px] text-ops-down">预览读取失败：{preview.error}</p>}
                  {p && <>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Tile label="影响用户" value={`${p.holders} 位`}><div className="mt-1 text-[12px] text-ops-muted">本金 {money(p.principalAtomic, 6, 0)}</div></Tile>
                      <Tile label={p.lossAtomic !== '0' ? '本金亏损' : '发放收益'} tone={p.lossAtomic !== '0' ? 'down' : 'ok'} value={`${p.lossAtomic !== '0' ? '-' : ''}${money(p.lossAtomic !== '0' ? p.lossAtomic : p.payoutAtomic)}`}><div className="mt-1 text-[12px] text-ops-muted">费用 {money(p.feesAtomic)}</div></Tile>
                      <Tile label="同时完成的赎回" value={`${p.redemptions.count} 笔`}><div className="mt-1 text-[12px] text-ops-muted">本金 {money(p.redemptions.principalAtomic)} · 费 {money(p.redemptions.feeAtomic)}</div></Tile>
                    </div>
                    <div className="mt-4 rounded-[18px] border border-ops-line p-4">
                      <div className="flex flex-wrap justify-between gap-2 text-[12px] text-ops-muted"><span>和近 30 天比（白色是今天）</span><span>{p.history.mean === null ? '还没有历史' : `均值 ${pct(p.history.mean)} · 范围 ${pct(p.history.min)} 到 ${pct(p.history.max)}`}</span></div>
                      <ReturnRuler values={p.history.days.slice(0, 14).map((d) => Number(d.netReturnPct)).reverse()} highlight={Number(p.netReturnPct)} />
                      <div className="text-[12px] text-ops-muted">净值 {p.indexBefore} → <span className="text-ops-text">{p.indexAfter}</span></div>
                    </div>
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {p.checks.map((c) => (
                        <li key={c.code} className={cn('flex items-center gap-2 text-[13px]', c.ok ? 'text-ops-text' : CHECKS[c.code]?.blocks === false ? 'text-ops-warn' : 'text-ops-down')}>
                          {c.ok ? <Check className="h-4 w-4 text-ops-lime" /> : <X className="h-4 w-4" />}{checkText(c)}
                        </li>
                      ))}
                    </ul>
                    {needLarge && (
                      <label className="mt-4 flex items-start gap-3 rounded-[18px] border border-ops-down/40 bg-ops-down/[0.07] p-4 text-[13px]">
                        <input type="checkbox" checked={largeOk} onChange={(e) => setLargeOk(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C5F23B]" />
                        <span>我已核对，今天的涨跌超出 ±{product?.max_daily_move_pct}% 的日常范围，数字无误。</span>
                      </label>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-6">
                      <DangerButton onClick={() => setDialog('void')}>作废，重新录入</DangerButton>
                      <LimeButton disabled={!canPost} onClick={() => setDialog('post')}>{todayRow.status === 'approved' ? '重试过账' : `确认并结算 ${p.holders} 位用户`}</LimeButton>
                    </div>
                  </>}
                </div>
              )}

              {nothingDue && (
                <div className="flex flex-1 flex-col items-start justify-center gap-3">
                  <Chip tone="lime">都结算完了</Chip>
                  <div className="text-[30px] tabular-nums">{lastPosted ? pct(lastPosted.netReturnPct, 4) : '—'}</div>
                  <p className="text-[14px] text-ops-muted">{lastPosted ? `最近一次：${lastPosted.tradeDate} · ${lastPosted.usersCount ?? '—'} 位用户 · ${lastPosted.principalLossAtomic && lastPosted.principalLossAtomic !== '0' ? `亏损 ${money(lastPosted.principalLossAtomic)}` : `发放 ${money(lastPosted.paidAtomic)}`} USDT · 净值 ${lastPosted.indexAfter ?? '—'}` : '还没有结算记录。'}</p>
                  <WhiteButton href="/today">回到今日</WhiteButton>
                </div>
              )}

              {!nothingDue && step === 4 && todayRow && (
                <div className="flex flex-1 flex-col items-start justify-center gap-3">
                  <Chip tone="lime">已结算</Chip>
                  <div className="text-[30px] tabular-nums">{pct(todayRow.netReturnPct, 4)}</div>
                  <p className="text-[14px] text-ops-muted">{todayRow.usersCount} 位用户 · {todayRow.principalLossAtomic && todayRow.principalLossAtomic !== '0' ? `亏损 ${money(todayRow.principalLossAtomic)}` : `发放 ${money(todayRow.paidAtomic)}`} USDT · 净值 {todayRow.indexAfter}</p>
                  <WhiteButton href="/today">回到今日</WhiteButton>
                </div>
              )}
            </div>
          </div>
        )}
      </Board>

      <Confirm open={dialog === 'enter'} onClose={() => setDialog(null)} title={`录入 ${tradeDate} 的收益率？`} confirmLabel="录入，去看预览"
        rows={[{ label: '日期', value: tradeDate ?? '—' }, { label: '毛收益率', value: pct(gross.trim(), 4), strong: true }, ...(note.trim() ? [{ label: '备注', value: note.trim() }] : [])]}
        note="录入后不会马上结算。下一步会显示影响多少用户、发放或亏损多少，你确认后才入账。" onConfirm={enter} />
      {todayRow && p && (
        <Confirm open={dialog === 'post'} onClose={() => setDialog(null)} title="确认并结算？" confirmLabel={`结算 ${p.holders} 位用户`}
          rows={[{ label: '日期', value: todayRow.tradeDate }, { label: '净收益', value: pct(p.netReturnPct, 4), strong: true }, { label: p.lossAtomic !== '0' ? '本金亏损' : '发放收益', value: `${money(p.lossAtomic !== '0' ? p.lossAtomic : p.payoutAtomic)} USDT` }, { label: '赎回', value: `${p.redemptions.count} 笔 · ${money(p.redemptions.principalAtomic)} USDT` }, { label: '净值', value: `${p.indexBefore} → ${p.indexAfter}` }]}
          note="结算会立即给用户入账，不能撤销。"
          typeToConfirm={Number(todayRow.grossReturnPct).toString()} typeLabel={`请输入今天的毛收益率 ${Number(todayRow.grossReturnPct)} 确认`}
          onConfirm={post} />
      )}
      {todayRow && (
        <Confirm open={dialog === 'void'} onClose={() => setDialog(null)} title="作废这次录入？" danger confirmLabel="作废" note="作废后这一天可以重新录入。已结算的不能作废。" onConfirm={voidIt} />
      )}
    </>
  )
}

export default function QuantDailyPage() {
  return (
    <AppShell>
      <Suspense fallback={null}><Daily /></Suspense>
    </AppShell>
  )
}
