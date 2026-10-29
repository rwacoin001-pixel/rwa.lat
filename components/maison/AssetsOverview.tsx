'use client'

/**
 * Assets overview (2026-10-29, user: the assets page felt messy; RWA products are being retired, never say "RWA").
 * One question per layer, as top money apps do it:
 *   1. How much do I have — one large figure (cash + Koala Quant principal, waiting lots included + predictions in play + anything else held),
 *      today's and the running result under it, the value line, and three capsules (deposit, withdraw, transfer).
 *   2. Where is it — one composition bar with a legend; each part opens its product.
 *   3. Each product as one card — Koala Quant and predictions, a real photo, three figures; a tap opens the product.
 *   4. Anything else held (baskets, older holdings) quietly below, then the tools.
 * Every figure is the server's own; sums are BigInt.
 */
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuantProducts } from '@/lib/api/quant'
import { betAmounts, betStatus } from '@/lib/api/my-predictions'
import { fmtAtomic } from './format'
import { openPath } from '@/lib/maison-nav'
import { AMOUNT_MASK } from '@/lib/use-amount-mask'
import { useQuantProduct } from './QuantPositionCard'
import { useMyBets } from './MyPredictionsCard'
import { useOtherIncome } from './money-records'
import { Figure } from './motion'
import o from './assets-overview.module.css'

const ZERO = BigInt(0)
const big = (value: string | null | undefined) => value != null && /^-?\d+$/.test(value) ? BigInt(value) : ZERO
const num = (atomic: bigint) => Number(atomic) / 1e6

type Copy = { total: string; today: string; earned: string; deposit: string; withdraw: string; transfer: string; where: string; cash: string; quant: string; quantSub: string; predictions: string; predictionsSub: string; baskets: string; other: string; principal: string; earnedShort: string; lastDay: string; inPlay: string; paid: string; open: string; startQuant: string; startPredictions: string; none: string; more: string }
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { total: '总资产 · USDT', today: '今日', earned: '累计收益', deposit: '充值', withdraw: '提现', transfer: '转账', where: '资产构成', cash: '可用余额', quant: '考拉量化', quantSub: '每日结算 · 新加坡', predictions: '预测', predictionsSub: '等待结果的下注', baskets: '组合', other: '其他持仓', principal: '本金', earnedShort: '累计收益', lastDay: '最近一天', inPlay: '进行中', paid: '已派彩', open: '笔数', startQuant: '了解考拉量化', startPredictions: '去看看预测市场', none: '还没有持仓', more: '更多' },
  en: { total: 'Total assets · USDT', today: 'Today', earned: 'All-time result', deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', where: 'Where it is', cash: 'Available', quant: 'Koala Quant', quantSub: 'Settled daily · Singapore', predictions: 'Predictions', predictionsSub: 'Bets awaiting a result', baskets: 'Baskets', other: 'Other holdings', principal: 'Principal', earnedShort: 'Result', lastDay: 'Last day', inPlay: 'In play', paid: 'Paid out', open: 'Bets', startQuant: 'About Koala Quant', startPredictions: 'Browse predictions', none: 'Nothing held yet', more: 'More' },
}

export function AssetsOverview({ cash, extraValue, basketValue, masked, onMask, history, others, tools }: {
  /** Wallet available + locked. */ cash: bigint | null
  /** Older product holdings (shown only as "other"). */ extraValue: bigint
  basketValue: bigint
  masked: boolean; onMask: () => void
  history: ReactNode; others: ReactNode; tools: ReactNode
}) {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en!
  const list = useQuantProducts()
  const quant = useQuantProduct(list.data?.[0]?.slug)
  const position = quant.data?.position ?? null
  const bets = useMyBets({ loading: 'silent' })
  const income = useOtherIncome(locale)

  // principalAtomic already holds every lot, including the ones still waiting to start (waitingAtomic is a part of it, not extra).
  const quantValue = position ? big(position.principalAtomic) : ZERO
  const betRows = useMemo(() => Array.isArray(bets.data?.items) ? bets.data.items : [], [bets.data])
  const inPlay = useMemo(() => betRows.filter(bet => betStatus(bet.status) === 'placed'), [betRows])
  const betsValue = useMemo(() => inPlay.reduce((sum, bet) => sum + (betAmounts(bet).stake ?? ZERO), ZERO), [inPlay])
  const betsPaid = useMemo(() => betRows.filter(bet => betStatus(bet.status) === 'won').reduce((sum, bet) => sum + (betAmounts(bet).netPayout ?? ZERO), ZERO), [betRows])
  const total = cash === null ? null : cash + quantValue + betsValue + basketValue + extraValue

  // Today and all time: quant's own running net plus settled bets; today from the dated income rows.
  const todayKey = new Date().toLocaleDateString('en-CA')
  const today = useMemo(() => income.rows.filter(row => row.date.slice(0, 10) === todayKey).reduce((sum, row) => sum + row.atomic, ZERO), [income.rows, todayKey])
  const allTime = (position ? big(position.totalNetAtomic) : ZERO) + income.rows.filter(row => row.source === 'prediction').reduce((sum, row) => sum + row.atomic, ZERO)

  const money = (atomic: bigint, sign = false) => masked ? AMOUNT_MASK : `${sign && atomic > ZERO ? '+' : ''}${fmtAtomic(atomic.toString(), 6, '', 2).trim()}`
  const tone = (atomic: bigint) => atomic > ZERO ? 'up' : atomic < ZERO ? 'down' : undefined

  const parts = [
    { key: 'cash', label: c.cash, value: cash ?? ZERO, path: '/assets/cash' },
    { key: 'quant', label: c.quant, value: quantValue, path: '/quant?tab=account' },
    { key: 'predictions', label: c.predictions, value: betsValue, path: '/assets/predictions' },
    { key: 'baskets', label: c.baskets, value: basketValue, path: '/assets?tab=overview#baskets' },
    { key: 'other', label: c.other, value: extraValue, path: '/assets?tab=overview#other' },
  ].filter(part => part.value > ZERO)
  const whole = parts.reduce((sum, part) => sum + part.value, ZERO)

  return <div className={o.root}>
    {/* 1 · How much */}
    <section className={o.hero} aria-label={c.total}>
      <div className={o.heroHead}>
        <span>{c.total}</span>
        <button type="button" className={o.eye} aria-pressed={masked} onClick={onMask}>{masked ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </div>
      <p className={o.figure} dir="ltr">{masked ? AMOUNT_MASK : total === null ? '—' : <Figure value={num(total)} locale={locale} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />}</p>
      <p className={o.line}>
        <span>{c.today} <b data-tone={masked ? undefined : tone(today)}>{money(today, true)}</b></span>
        <i aria-hidden="true" />
        <span>{c.earned} <b data-tone={masked ? undefined : tone(allTime)}>{money(allTime, true)}</b></span>
      </p>
      <div className={o.chart}>{history}</div>
      <div className={o.capsules}>
        {([[c.deposit, '/assets/cash/deposit', ArrowDownToLine], [c.withdraw, '/assets/cash/withdraw', ArrowUpFromLine], [c.transfer, '/assets/cash/transfer', ArrowRightLeft]] as const).map(([label, path, Icon], i) =>
          <button key={path} type="button" data-primary={i === 0 || undefined} onClick={() => openPath(path)}><Icon size={17} strokeWidth={1.8} aria-hidden="true" />{label}</button>)}
      </div>
    </section>

    {/* 2 · Where it is */}
    {whole > ZERO && <section className={o.where} aria-label={c.where}>
      <h2>{c.where}</h2>
      <div className={o.bar} role="img" aria-label={parts.map(part => `${part.label} ${Math.round(num(part.value) / num(whole) * 100)}%`).join(', ')}>
        {parts.map(part => <i key={part.key} data-part={part.key} style={{ flexGrow: Math.max(num(part.value), num(whole) * .015) }} />)}
      </div>
      <ul className={o.legend}>{parts.map(part => <li key={part.key}><button type="button" onClick={() => openPath(part.path)}>
        <i data-part={part.key} aria-hidden="true" /><span>{part.label}</span>
        <b dir="ltr">{money(part.value)}</b><small>{Math.round(num(part.value) / num(whole) * 100)}%</small>
      </button></li>)}</ul>
    </section>}

    {/* 3 · Each product */}
    <section className={o.products}>
      <ProductCard photo="/media/home/cards/quant-720.webp" title={c.quant} sub={c.quantSub} path={position && quantValue > ZERO ? '/quant?tab=account' : '/quant'}
        figures={position && quantValue > ZERO ? [
          [c.principal, money(quantValue), undefined],
          [c.earnedShort, money(big(position.totalNetAtomic), true), masked ? undefined : tone(big(position.totalNetAtomic))],
          [c.lastDay, position.lastDay ? money(big(position.lastDay.netAtomic), true) : '—', masked || !position.lastDay ? undefined : tone(big(position.lastDay.netAtomic))],
        ] : null} empty={c.startQuant} />
      <ProductCard photo="/media/home/cards/predict-720.webp" title={c.predictions} sub={c.predictionsSub} path={betRows.length ? '/assets/predictions' : '/markets?tab=predictions'}
        figures={betRows.length ? [
          [c.inPlay, money(betsValue), undefined],
          [c.paid, money(betsPaid), masked || betsPaid === ZERO ? undefined : 'up'],
          [c.open, String(inPlay.length), undefined],
        ] : null} empty={c.startPredictions} />
    </section>

    {/* 4 · Anything else, then the tools */}
    {others}
    {tools}
  </div>
}

function ProductCard({ photo, title, sub, path, figures, empty }: { photo: string; title: string; sub: string; path: string; figures: Array<[string, string, 'up' | 'down' | undefined]> | null; empty: string }) {
  return <button type="button" className={o.card} onClick={() => openPath(path)}>
    <span className={o.cardHead}>
      <img src={photo} alt="" width={56} height={56} loading="lazy" decoding="async" />
      <span><b>{title}</b><small>{sub}</small></span>
      <ChevronRight size={18} aria-hidden="true" />
    </span>
    {figures
      ? <dl className={o.figures}>{figures.map(([label, value, t]) => <div key={label}><dt>{label}</dt><dd dir="ltr" data-tone={t}>{value}</dd></div>)}</dl>
      : <span className={o.empty}>{empty}<ChevronRight size={14} aria-hidden="true" /></span>}
  </button>
}
