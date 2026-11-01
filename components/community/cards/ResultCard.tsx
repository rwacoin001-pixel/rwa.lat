'use client'

/**
 * A share-a-result card (晒单卡, 2026-11-01). One shell for all eight kinds: a ticket head (a slow pastel band whose colour
 * says the kind — quant mint→mist, prediction lavender→rose, funds porcelain), a perforation, then a grey well with the
 * hero figure alone on its line and a two-column grid, and a footer that always carries the provenance and the risk line.
 * Hidden fields show as a soft bar so the reader sees something was withheld; their values never reach this device.
 * Loss and profit cards are the same size and weight; only the figure's colour changes.
 */
import { EyeOff } from 'lucide-react'
import { CommunityAvatar } from '@/components/community-avatar'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { CARD_FIELDS, asNumber, cardGroup, money, pct, tone, units, type CardKind, type CardSnapshot, type PostCard } from '@/lib/community-cards'
import s from './result-card.module.css'

type Copy = {
  kinds: Record<CardKind, string>; group: Record<'quant' | 'prediction' | 'funds', string>; snapshot: string; provenance: string; risk: string; funds: string
  f: Record<string, string>; status: Record<string, string>; result: Record<string, string>; won: string; lost: string; days: (n: number) => string; open: string
}
const copy: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': {
    kinds: { quant_day: '今日收益', quant_product: '产品盈亏', quant_total: '累计收益', holdings: '持仓状态', prediction_bet: '预测单', prediction_record: '预测战绩', deposit: '充值', withdrawal: '提现' },
    group: { quant: '考拉量化', prediction: '预测', funds: '资金记录' }, snapshot: '账户快照', provenance: 'A-REIT 账户快照', funds: '资金记录，不是收益',
    risk: '历史账户快照，所选结果不代表整体表现。投资可能亏损，过去表现不代表未来。',
    f: { pnl: '盈亏', returnPct: '收益率', product: '产品', date: '日期', settledDays: '已结算', status: '状态', bestMonth: '最好的月份', products: '持仓', totalPrincipal: '剩余本金', pending: '等待生效', question: '事件', side: '方向', stake: '下注', result: '结果', payout: '到账', winRate: '胜率', total: '总次数', closedPnl: '已结算盈亏', last10: '最近 10 次', amount: '金额', asset: '币种', time: '时间' },
    status: { holding: '持有中', redeeming: '赎回中', closed: '已结束', credited: '已到账', confirmed: '已到账', completed: '已完成', pending: '处理中', processing: '处理中', failed: '失败', rejected: '已拒绝' },
    result: { won: '赢', lost: '输', void: '作废', open: '未结算' }, won: '赢', lost: '输', days: (n) => `${n} 天`, open: '发出时未结算',
  },
  en: {
    kinds: { quant_day: 'Day result', quant_product: 'Product P&L', quant_total: 'Total return', holdings: 'Holdings', prediction_bet: 'Prediction', prediction_record: 'Track record', deposit: 'Deposit', withdrawal: 'Withdrawal' },
    group: { quant: 'Koala Quant', prediction: 'Predictions', funds: 'Funds record' }, snapshot: 'Account snapshot', provenance: 'A-REIT account snapshot', funds: 'A funds record, not a return',
    risk: 'Historical account snapshot; selected results may not represent overall performance. Losses are possible. Past performance does not predict future results.',
    f: { pnl: 'P&L', returnPct: 'Return', product: 'Product', date: 'Date', settledDays: 'Settled', status: 'Status', bestMonth: 'Best month', products: 'Holdings', totalPrincipal: 'Principal left', pending: 'Pending', question: 'Event', side: 'Side', stake: 'Stake', result: 'Result', payout: 'Payout', winRate: 'Win rate', total: 'Bets', closedPnl: 'Settled P&L', last10: 'Last 10', amount: 'Amount', asset: 'Asset', time: 'Time' },
    status: { holding: 'Holding', redeeming: 'Redeeming', closed: 'Closed', credited: 'Credited', confirmed: 'Credited', completed: 'Completed', pending: 'Pending', processing: 'Processing', failed: 'Failed', rejected: 'Rejected' },
    result: { won: 'Won', lost: 'Lost', void: 'Void', open: 'Open' }, won: 'Won', lost: 'Lost', days: (n) => `${n} days`, open: 'Open when shared',
  },
}
export const useResultCardCopy = () => { const { locale } = useI18n(); return copy[locale] ?? copy.en! }

export type Author = { displayName: string; handle: string; avatarUrl?: string | null; avatarSeed?: string | null }

export type Tone = 'up' | 'down' | 'flat'
export type HoldingRow = { product: string; share: number; lastDayReturnPct: number | null }
/** What a card says, independent of how it is drawn (the in-app card and the share image both use it). */
export type CardModel = {
  group: 'quant' | 'prediction' | 'funds'; head: string; title: string | null
  hero: { text: string; unit?: string; tone: Tone; kicker?: string; sub?: string; subTone?: Tone } | null
  holdings: HoldingRow[] | null; dots: string[]; open: boolean
  grid: Array<{ key: string; label: string; value: string; tone?: Tone; hidden?: boolean }>
  provenance: string; funds: string | null; risk: string
}
export function describeCard(card: PostCard, k: Copy, locale: string): CardModel {
  const { kind, snapshot: v } = card
  const group = cardGroup(kind)
  const visible = new Set(card.visibleFields)
  const has = (key: string) => visible.has(key) && v[key] !== undefined
  const dec = typeof v.decimals === 'number' ? v.decimals : 6
  const asset = typeof v.asset === 'string' ? v.asset : 'USDT'
  const amount = (key: string, signed = false) => money(units(v[key], dec), locale, signed)
  const when = (iso: unknown) => typeof iso === 'string' ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—'
  const day = (iso: unknown) => typeof iso === 'string' ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)) : '—'
  const num = (key: string) => asNumber(v[key])
  const text = (key: string) => {
    const value = v[key]
    if (key === 'date') return day(value)
    if (key === 'time') return when(value)
    if (key === 'status') return k.status[String(value)] ?? String(value ?? '—')
    if (key === 'result') return k.result[String(value)] ?? String(value ?? '—')
    if (key === 'settledDays') return typeof value === 'number' ? k.days(value) : '—'
    if (key === 'returnPct') return pct(value)
    if (key === 'total') return typeof value === 'number' ? String(value) : '—'
    if (key === 'stake' || key === 'payout' || key === 'amount' || key === 'totalPrincipal' || key === 'pending') return `${amount(key)} ${asset}`
    if (key === 'pnl' || key === 'closedPnl') return `${amount(key, true)} ${asset}`
    if (key === 'bestMonth' && value && typeof value === 'object') { const m = value as { month?: string; pnl?: string }; return `${m.month ?? '—'} · ${money(units(m.pnl, dec), locale, true)}` }
    return String(value ?? '—')
  }
  let hero: CardModel['hero'] = null, holdings: HoldingRow[] | null = null, dots: string[] = [], used: string[] = []
  if (kind === 'holdings') {
    if (has('products') && Array.isArray(v.products)) {
      used = ['products']
      holdings = (v.products as Array<{ product: string; weight: number | string; lastDayReturnPct?: number | string | null }>).map((item) => { const w = asNumber(item.weight) ?? 0; return { product: item.product, share: w <= 1 ? w * 100 : w, lastDayReturnPct: asNumber(item.lastDayReturnPct) } })
    }
  } else if (kind === 'prediction_record') {
    if (has('winRate')) {
      used = ['winRate', 'last10']
      const rate = num('winRate')
      hero = { kicker: k.f.winRate, text: pct(rate === null ? null : rate <= 1 ? rate * 100 : rate, false), tone: 'flat', sub: asNumber(v.won) !== null && asNumber(v.lost) !== null ? `${k.won} ${asNumber(v.won)} / ${k.lost} ${asNumber(v.lost)}` : undefined }
      dots = has('last10') && Array.isArray(v.last10) ? v.last10 as string[] : []
    }
  } else if (group === 'funds') {
    if (has('amount')) { used = ['amount']; hero = { text: amount('amount'), unit: asset, tone: 'flat' } }
    else if (has('status')) { used = ['status', 'asset']; hero = { text: text('status'), unit: asset, tone: 'flat' } }
  } else if (has('pnl')) {
    used = ['pnl', 'returnPct']
    hero = { text: amount('pnl', true), unit: asset, tone: tone(units(v.pnl, dec)), ...(has('returnPct') ? { sub: pct(v.returnPct), subTone: tone(num('returnPct')) } : {}) }
  } else if (has('returnPct')) {
    used = ['returnPct']
    hero = { text: pct(v.returnPct), tone: tone(num('returnPct')) }
  }
  const titleKey = kind === 'prediction_bet' ? 'question' : kind === 'quant_day' || kind === 'quant_product' ? 'product' : null
  const grid: CardModel['grid'] = CARD_FIELDS[kind].filter((key) => !used.includes(key) && key !== titleKey && has(key) && !(kind === 'prediction_record' && key === 'last10'))
    .map((key) => ({ key, label: k.f[key] ?? key, value: text(key), tone: key === 'closedPnl' ? tone(units(v[key], dec)) : undefined }))
  for (const key of CARD_FIELDS[kind]) if (!visible.has(key)) grid.push({ key, label: k.f[key] ?? key, value: '', hidden: true })
  return {
    group, head: `${k.group[group]} · ${k.kinds[kind]}`, title: titleKey && has(titleKey) ? text(titleKey) : null, hero, holdings, dots, grid,
    open: kind === 'prediction_bet' && v.result === 'open', provenance: `${k.provenance} · ${when(card.capturedAt)}`, funds: group === 'funds' ? k.funds : null, risk: k.risk,
  }
}

/** `mini` (2026-11-02, the 晒单精选 strip): compact, and only the head, the main figure, the author and the risk line. */
export function ResultCard({ card, author, compact = false, mini = false }: { card: PostCard; author?: Author; compact?: boolean; mini?: boolean }) {
  const { locale } = useI18n()
  const k = useResultCardCopy()
  const m = describeCard(card, k, locale)
  return <article className={s.card} data-group={m.group} data-compact={compact || mini || undefined} data-mini={mini || undefined} aria-label={m.head}>
    <header className={s.head}><span>{m.head}</span><em>{k.snapshot}</em></header>
    <div className={s.perf} aria-hidden="true" />
    <div className={s.well}>
      {m.title && <b className={s.title} dir="auto">{m.title}</b>}
      {m.hero && <>{m.hero.kicker && <span className={s.kicker}>{m.hero.kicker}</span>}
        <b className={s.figure} data-tone={m.hero.tone}>{m.hero.text}{m.hero.unit && <> <small>{m.hero.unit}</small></>}</b>
        {m.hero.sub && <span className={s.sub} data-tone={m.hero.subTone}>{m.hero.sub}</span>}</>}
      {m.dots.length > 0 && <span className={s.dots} aria-label={k.f.last10}>{m.dots.map((item, index) => <i key={index} data-r={item} />)}</span>}
      {m.holdings && <Holdings rows={m.holdings} />}
      {m.open && <span className={s.note}>{k.open}</span>}
      {m.grid.length > 0 && <dl className={s.grid}>
        {m.grid.map((cell) => cell.hidden
          ? <div key={cell.key} data-hidden=""><dt>{cell.label}</dt><dd><i className={s.veil} /><EyeOff size={14} strokeWidth={1.8} aria-hidden="true" /></dd></div>
          : <div key={cell.key}><dt>{cell.label}</dt><dd dir="auto" data-tone={cell.tone}>{cell.value}</dd></div>)}
      </dl>}
    </div>
    <footer className={s.foot}>
      {author && <span className={s.who}><CommunityAvatar avatarUrl={author.avatarUrl ?? null} seed={author.avatarSeed ?? author.handle} handle={author.handle} size={32} /><span><b dir="auto">{author.displayName}</b><small>@{author.handle}</small></span></span>}
      <span className={s.prov}>{m.provenance}</span>
      {m.funds && <small className={s.risk}>{m.funds}</small>}
      <small className={s.risk}>{m.risk}</small>
    </footer>
  </article>
}

function Holdings({ rows }: { rows: HoldingRow[] }) {
  return <div className={s.holdings}>
    <span className={s.bar}>{rows.map((item, index) => <i key={index} style={{ flexGrow: Math.max(item.share, 1) }} data-i={index % 4}>{item.share >= 14 ? `${Math.round(item.share)}%` : ''}</i>)}</span>
    <ul>{rows.map((item, index) => <li key={index}><i data-i={index % 4} /><span dir="auto">{item.product}</span>{item.lastDayReturnPct !== null && <small data-tone={tone(item.lastDayReturnPct)}>{pct(item.lastDayReturnPct)}</small>}<b>{Math.round(item.share)}%</b></li>)}</ul>
  </div>
}

export type { CardSnapshot }
