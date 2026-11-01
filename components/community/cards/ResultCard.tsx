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
import { CARD_FIELDS, cardGroup, money, pct, tone, units, type CardKind, type CardSnapshot, type PostCard } from '@/lib/community-cards'
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

type Author = { displayName: string; handle: string; avatarUrl?: string | null; avatarSeed?: string | null }

export function ResultCard({ card, author, compact = false }: { card: PostCard; author?: Author; compact?: boolean }) {
  const { locale } = useI18n()
  const k = useResultCardCopy()
  const { kind, snapshot: v } = card
  const group = cardGroup(kind)
  const visible = new Set(card.visibleFields)
  const hidden = CARD_FIELDS[kind].filter((key) => !visible.has(key))
  const has = (key: string) => visible.has(key) && v[key] !== undefined
  const dec = typeof v.decimals === 'number' ? v.decimals : 6
  const asset = typeof v.asset === 'string' ? v.asset : 'USDT'
  const amount = (key: string, signed = false) => money(units(v[key], dec), locale, signed)
  const when = (iso: unknown) => typeof iso === 'string' ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—'
  const day = (iso: unknown) => typeof iso === 'string' ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)) : '—'
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

  // The hero: the first visible figure of the kind; the rest go to the grid.
  const pnlValue = units(v.pnl, dec)
  let hero: React.ReactNode = null
  let used: string[] = []
  if (kind === 'holdings') {
    const products = has('products') && Array.isArray(v.products) ? v.products as Array<{ product: string; weight: number; lastDayReturnPct?: number | null }> : null
    if (products) { used = ['products']; hero = <Holdings products={products} /> }
  } else if (kind === 'prediction_record') {
    if (has('winRate')) {
      used = ['winRate', 'last10']
      const last = has('last10') && Array.isArray(v.last10) ? v.last10 as string[] : []
      hero = <><span className={s.kicker}>{k.f.winRate}</span><b className={s.figure} data-tone="flat">{pct(typeof v.winRate === 'number' ? v.winRate * (v.winRate <= 1 ? 100 : 1) : null, false)}</b>
        {typeof v.won === 'number' && typeof v.lost === 'number' && <span className={s.sub}>{k.won} {v.won} / {k.lost} {v.lost}</span>}
        {last.length > 0 && <span className={s.dots} aria-label={k.f.last10}>{last.map((item, index) => <i key={index} data-r={item} />)}</span>}</>
    }
  } else if (group === 'funds') {
    if (has('amount')) { used = ['amount']; hero = <b className={s.figure} data-tone="flat">{amount('amount')} <small>{asset}</small></b> }
    else if (has('status')) { used = ['status', 'asset']; hero = <b className={s.figure} data-tone="flat">{text('status')} <small>{asset}</small></b> }
  } else if (has('pnl')) {
    used = ['pnl', 'returnPct']
    hero = <><b className={s.figure} data-tone={tone(pnlValue)}>{amount('pnl', true)} <small>{asset}</small></b>{has('returnPct') && <span className={s.sub} data-tone={tone(typeof v.returnPct === 'number' ? v.returnPct : null)}>{pct(v.returnPct)}</span>}</>
  } else if (has('returnPct')) {
    used = ['returnPct']
    hero = <b className={s.figure} data-tone={tone(typeof v.returnPct === 'number' ? v.returnPct : null)}>{pct(v.returnPct)}</b>
  }
  const title = kind === 'prediction_bet' ? 'question' : kind === 'quant_day' || kind === 'quant_product' ? 'product' : null
  const showTitle = title && has(title)
  const grid = CARD_FIELDS[kind].filter((key) => !used.includes(key) && key !== title && has(key) && !(kind === 'prediction_record' && key === 'last10'))
  const isOpen = kind === 'prediction_bet' && v.result === 'open'

  return <article className={s.card} data-group={group} data-compact={compact || undefined} aria-label={`${k.group[group]} · ${k.kinds[kind]}`}>
    <header className={s.head}><span>{k.group[group]} · {k.kinds[kind]}</span><em>{k.snapshot}</em></header>
    <div className={s.perf} aria-hidden="true" />
    <div className={s.well}>
      {showTitle && <b className={s.title} dir="auto">{text(title)}</b>}
      {hero}
      {isOpen && <span className={s.note}>{k.open}</span>}
      {(grid.length > 0 || hidden.length > 0) && <dl className={s.grid}>
        {grid.map((key) => <div key={key}><dt>{k.f[key] ?? key}</dt><dd dir="auto" data-tone={key === 'closedPnl' ? tone(units(v[key], dec)) : undefined}>{text(key)}</dd></div>)}
        {hidden.map((key) => <div key={key} data-hidden=""><dt>{k.f[key] ?? key}</dt><dd><i className={s.veil} /><EyeOff size={14} strokeWidth={1.8} aria-hidden="true" /></dd></div>)}
      </dl>}
    </div>
    <footer className={s.foot}>
      {author && <span className={s.who}><CommunityAvatar avatarUrl={author.avatarUrl ?? null} seed={author.avatarSeed ?? author.handle} handle={author.handle} size={32} /><span><b dir="auto">{author.displayName}</b><small>@{author.handle}</small></span></span>}
      <span className={s.prov}>{k.provenance} · {when(card.capturedAt)}</span>
      {group === 'funds' && <small className={s.risk}>{k.funds}</small>}
      <small className={s.risk}>{k.risk}</small>
    </footer>
  </article>
}

function Holdings({ products }: { products: Array<{ product: string; weight: number; lastDayReturnPct?: number | null }> }) {
  const shares = products.map((item) => ({ ...item, share: item.weight <= 1 ? item.weight * 100 : item.weight }))
  return <div className={s.holdings}>
    <span className={s.bar}>{shares.map((item, index) => <i key={index} style={{ flexGrow: Math.max(item.share, 1) }} data-i={index % 4}>{item.share >= 14 ? `${Math.round(item.share)}%` : ''}</i>)}</span>
    <ul>{shares.map((item, index) => <li key={index}><i data-i={index % 4} /><span dir="auto">{item.product}</span><b data-tone={tone(item.lastDayReturnPct ?? null)}>{item.lastDayReturnPct === null || item.lastDayReturnPct === undefined ? `${Math.round(item.share)}%` : pct(item.lastDayReturnPct)}</b></li>)}</ul>
  </div>
}

export type { CardSnapshot }
