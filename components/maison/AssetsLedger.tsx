'use client'

/**
 * Records = the money ledger (2026-10-29, agreed with Codex after the user called the old tabs messy). One list of
 * every balance movement from GET /v1/ledger/transactions, grouped by day: a short title (the market question for a
 * bet, the product otherwise), "type · time" with the chosen side, a signed amount, and a status only when it is not
 * final. Filter chips (type / product / date) open sheets; a context line counts results and what is still waiting.
 */
import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { ledgerHeadline, listLedger, type LedgerTransaction } from '@/lib/api/wallet'
import { betStatus } from '@/lib/api/my-predictions'
import { listQuantOrders } from '@/lib/api/quant'
import { walletCopy } from '@/lib/maison-wallet-copy'
import { openPath } from '@/lib/maison-nav'
import { AMOUNT_MASK, useAmountMask } from '@/lib/use-amount-mask'
import { useMyBets } from './MyPredictionsCard'
import { Sheet } from './Sheet'
import { Skeleton, StateBlock } from './primitives'
import { fmtAtomic } from './format'
import l from './assets-ledger.module.css'

type Kind = 'all' | 'funding' | 'investing' | 'earning'
type Product = 'all' | 'quant' | 'prediction' | 'wallet' | 'other'
type Range = 'all' | '7' | '30' | '90' | 'custom'
const ZERO = BigInt(0)

type Copy = { type: string; product: string; date: string; kinds: Record<Kind, string>; products: Record<Product, string>; ranges: Record<Range, string>; from: string; to: string; apply: string; reset: string; count: string; waiting: string; today: string; yesterday: string; more: string; empty: string; emptyBody: string; labels: Record<string, string>; backed: string; awaiting: string; won: string; lost: string; refunded: string; processing: string }
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { type: '类型', product: '产品', date: '日期', kinds: { all: '全部类型', funding: '充值与提现', investing: '申购与下注', earning: '收益与奖励' }, products: { all: '全部产品', quant: '考拉量化', prediction: '预测', wallet: '钱包', other: '其他' }, ranges: { all: '全部时间', '7': '近 7 天', '30': '近 30 天', '90': '近 90 天', custom: '自定义' }, from: '开始日期', to: '结束日期', apply: '确认', reset: '重置', count: '{n} 条', waiting: '等待结果 {n}', today: '今天', yesterday: '昨天', more: '加载更多', empty: '这段时间没有记录', emptyBody: '换个筛选条件看看。',
    labels: { quant_subscription: '申购', quant_redemption: '赎回', quant_daily_settlement: '每日结算', prediction_place: '下注', prediction_payout: '派彩', prediction_void_refund: '退款', referral_reward_claim: '邀请奖励', referral_team_monthly: '团队月结' }, backed: '押 {o}', awaiting: '等待结果', won: '已中', lost: '未中', refunded: '已退款', processing: '处理中' },
  en: { type: 'Type', product: 'Product', date: 'Date', kinds: { all: 'All types', funding: 'Deposits & withdrawals', investing: 'Subscriptions & bets', earning: 'Income & rewards' }, products: { all: 'All products', quant: 'Koala Quant', prediction: 'Predictions', wallet: 'Wallet', other: 'Other' }, ranges: { all: 'All time', '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days', custom: 'Custom' }, from: 'From', to: 'To', apply: 'Apply', reset: 'Reset', count: '{n} records', waiting: 'Awaiting {n}', today: 'Today', yesterday: 'Yesterday', more: 'Load more', empty: 'Nothing in this period', emptyBody: 'Try other filters.',
    labels: { quant_subscription: 'Subscription', quant_redemption: 'Redemption', quant_daily_settlement: 'Daily settlement', prediction_place: 'Bet', prediction_payout: 'Payout', prediction_void_refund: 'Refund', referral_reward_claim: 'Referral reward', referral_team_monthly: 'Team reward' }, backed: 'Backed {o}', awaiting: 'Awaiting result', won: 'Won', lost: 'Lost', refunded: 'Refunded', processing: 'Processing' },
}

type Row = { id: string; at: string; title: string; sub: string; amount: bigint | null; status: string | null; kind: Exclude<Kind, 'all'>; product: Exclude<Product, 'all'>; path: string | null; waiting: boolean }

const productOf = (type: string): Row['product'] => type.startsWith('quant_') ? 'quant' : type.startsWith('prediction_') ? 'prediction'
  : type === 'deposit' || type.startsWith('withdrawal') || type === 'internal_transfer' || type.startsWith('referral_') ? 'wallet' : 'other'
const kindOf = (type: string): Row['kind'] => type === 'deposit' || type.startsWith('withdrawal') || type === 'internal_transfer' ? 'funding'
  : type === 'quant_daily_settlement' || type === 'prediction_payout' || type === 'prediction_void_refund' || type.startsWith('referral_') || type === 'yield_distribution' ? 'earning' : 'investing'

export function AssetsLedger() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en!
  const w = walletCopy[locale].activity
  const { masked } = useAmountMask()
  const [pages, setPages] = useState(1)
  const ledger = useQuery(`assets:ledger:${pages}`, () => listLedger(Math.min(100, 40 * pages)), { staleTime: 15_000 })
  const bets = useMyBets({ loading: 'silent' })
  const quantOrders = useQuery('quant:orders', () => listQuantOrders(30), { staleTime: 30_000, loading: 'silent' })
  const [kind, setKind] = useState<Kind>('all'), [product, setProduct] = useState<Product>('all'), [range, setRange] = useState<Range>('all')
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [sheet, setSheet] = useState<'type' | 'product' | 'date' | null>(null)
  const [onlyWaiting, setOnlyWaiting] = useState(false)

  const rows = useMemo<Row[]>(() => {
    const betById = new Map((Array.isArray(bets.data?.items) ? bets.data.items : []).map(bet => [bet.id, bet]))
    const quantById = new Map((Array.isArray(quantOrders.data) ? quantOrders.data : []).map(order => [order.id, order]))
    return (ledger.data?.transactions ?? []).map((tx: LedgerTransaction) => {
      const type = tx.transactionType, head = ledgerHeadline(tx)
      const label = c.labels[type] ?? w.types[type] ?? w.otherType
      const time = new Date(tx.effectiveAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      const prod = productOf(type)
      let title = prod === 'quant' ? c.products.quant : prod === 'prediction' ? c.products.prediction : label
      let sub = `${label} · ${time}`, status: string | null = null, path: string | null = null, waiting = false
      const bet = betById.get(tx.referenceId)
      if (bet) {
        const question = String(bet.marketQuestion ?? '').trim(), outcome = String(bet.tokenOutcome ?? '').trim()
        if (question) title = question
        if (outcome) sub = `${c.backed.replace('{o}', outcome)} · ${label} · ${time}`
        const st = betStatus(bet.status)
        if (type === 'prediction_place') { status = st === 'placed' ? c.awaiting : st === 'won' ? c.won : st === 'lost' ? c.lost : st === 'void' ? c.refunded : null; waiting = st === 'placed' }
        path = bet.marketEventId ? `/prediction/event-${encodeURIComponent(String(bet.marketEventId))}` : '/assets/predictions'
      }
      const order = quantById.get(tx.referenceId)
      if (prod === 'quant') { path = '/quant?tab=account'; if (order && (order.status === 'pending' || order.status === 'approved')) { status = c.processing; waiting = true } }
      if (tx.referenceType === 'order' && prod === 'other') path = `/orders/${encodeURIComponent(tx.referenceId)}`
      return { id: tx.id, at: tx.effectiveAt, title, sub, amount: head?.amount ?? null, status, kind: kindOf(type), product: prod, path, waiting }
    }).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [ledger.data, bets.data, quantOrders.data, c, w, locale])

  const since = range === 'all' || range === 'custom' ? null : Date.now() - Number(range) * 86_400_000
  const shown = rows.filter(row => (kind === 'all' || row.kind === kind) && (product === 'all' || row.product === product)
    && (since === null || Date.parse(row.at) >= since)
    && (range !== 'custom' || ((!custom.from || row.at.slice(0, 10) >= custom.from) && (!custom.to || row.at.slice(0, 10) <= custom.to)))
    && (!onlyWaiting || row.waiting))
  const waitingCount = rows.filter(row => row.waiting).length

  const dayLabel = (iso: string) => {
    const d = new Date(iso), today = new Date(), y = new Date(Date.now() - 86_400_000)
    if (d.toDateString() === today.toDateString()) return c.today
    if (d.toDateString() === y.toDateString()) return c.yesterday
    return d.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })
  }
  const money = (v: bigint | null) => v === null ? '—' : masked ? AMOUNT_MASK : `${v > ZERO ? '+' : ''}${fmtAtomic(v.toString(), 6, '', 2).trim()}`

  let lastDay = ''
  return <div className={l.root}>
    <div className={l.filters} role="group">
      <button type="button" data-on={kind !== 'all' || undefined} onClick={() => setSheet('type')}>{kind === 'all' ? c.type : c.kinds[kind]}<ChevronDown size={14} /></button>
      <button type="button" data-on={product !== 'all' || undefined} onClick={() => setSheet('product')}>{product === 'all' ? c.product : c.products[product]}<ChevronDown size={14} /></button>
      <button type="button" data-on={range !== 'all' || undefined} onClick={() => setSheet('date')}>{range === 'all' ? c.date : c.ranges[range]}<ChevronDown size={14} /></button>
    </div>
    {ledger.data && <p className={l.context}>
      <span>{c.count.replace('{n}', String(shown.length))}</span>
      {waitingCount > 0 && <button type="button" aria-pressed={onlyWaiting} onClick={() => setOnlyWaiting(v => !v)}>{c.waiting.replace('{n}', String(waitingCount))}</button>}
    </p>}
    {ledger.error && !ledger.data ? <StateBlock tone="error" title={w.empty} body={ledger.error.message} retry={ledger.refetch} />
      : !ledger.data ? <Skeleton rows={5} />
      : !shown.length ? <StateBlock title={c.empty} body={c.emptyBody} />
      : <ul className={l.list}>{shown.flatMap(row => {
        const day = dayLabel(row.at), head = day !== lastDay
        lastDay = day
        const body = <>
          <span className={l.main}><b dir="auto">{row.title}</b><small>{row.sub}</small></span>
          <span className={l.fig}><b dir="ltr" data-tone={masked || row.amount === null || row.amount === ZERO ? undefined : row.amount > ZERO ? 'up' : undefined}>{money(row.amount)}</b>{row.status && <small data-waiting={row.waiting || undefined}>{row.status}</small>}</span>
        </>
        return [...(head ? [<li key={`d-${row.id}`} className={l.day}>{day}</li>] : []),
          <li key={row.id}>{row.path ? <button type="button" className={l.row} onClick={() => openPath(row.path!)}>{body}</button> : <div className={l.row}>{body}</div>}</li>]
      })}</ul>}
    {ledger.data?.nextCursor && pages < 3 && <button type="button" className={l.more} onClick={() => setPages(p => p + 1)}>{c.more}</button>}

    <Sheet open={sheet === 'type'} onClose={() => setSheet(null)} title={c.type}>
      <div className={l.options}>{(Object.keys(c.kinds) as Kind[]).map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setSheet(null) }}>{c.kinds[k]}</button>)}</div>
    </Sheet>
    <Sheet open={sheet === 'product'} onClose={() => setSheet(null)} title={c.product}>
      <div className={l.options}>{(Object.keys(c.products) as Product[]).map(k => <button key={k} type="button" aria-pressed={product === k} onClick={() => { setProduct(k); setSheet(null) }}>{c.products[k]}</button>)}</div>
    </Sheet>
    <Sheet open={sheet === 'date'} onClose={() => setSheet(null)} title={c.date}>
      <div className={l.ranges}>{(['7', '30', '90'] as Range[]).map(k => <button key={k} type="button" aria-pressed={range === k} onClick={() => { setRange(k); setSheet(null) }}>{c.ranges[k]}</button>)}</div>
      <div className={l.custom}>
        <label><span>{c.from}</span><input type="date" value={custom.from} max={custom.to || undefined} onChange={e => setCustom(v => ({ ...v, from: e.target.value }))} /></label>
        <i aria-hidden="true">–</i>
        <label><span>{c.to}</span><input type="date" value={custom.to} min={custom.from || undefined} onChange={e => setCustom(v => ({ ...v, to: e.target.value }))} /></label>
      </div>
      <div className={l.sheetKeys}>
        <button type="button" onClick={() => { setRange('all'); setCustom({ from: '', to: '' }); setSheet(null) }}>{c.reset}</button>
        <button type="button" data-primary="" disabled={!custom.from && !custom.to} onClick={() => { setRange('custom'); setSheet(null) }}>{c.apply}</button>
      </div>
    </Sheet>
  </div>
}
