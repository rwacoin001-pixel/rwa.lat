'use client'

import { brandText } from '@/lib/brand/build-brand'

/**
 * A share-a-result card (晒单卡, 2026-11-01). One shell for all eight kinds: a ticket head (a slow pastel band whose colour
 * says the kind — quant mint→mist, prediction lavender→rose, funds porcelain), a perforation, then a grey well with the
 * hero figure alone on its line and a two-column grid, and a footer that always carries the provenance and the risk line.
 * Hidden fields show as a soft bar so the reader sees something was withheld; their values never reach this device.
 * Loss and profit cards are the same size and weight; only the figure's colour changes.
 */
import { EyeOff } from 'lucide-react'
import { useRef, useState } from 'react'
import { CommunityAvatar } from '@/components/community-avatar'
import { PrismaticBand } from '@/components/backgrounds/PrismaticBand'
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
    group: { quant: '考拉量化', prediction: '预测', funds: '资金记录' }, snapshot: '账户快照', provenance: brandText('A-REIT 账户快照'), funds: '资金记录，不是收益',
    risk: '历史账户快照，所选结果不代表整体表现。投资可能亏损，过去表现不代表未来。',
    f: { pnl: '盈亏', returnPct: '收益率', product: '产品', date: '日期', settledDays: '已结算', status: '状态', bestMonth: '最好的月份', products: '持仓', totalPrincipal: '剩余本金', pending: '等待生效', question: '事件', side: '方向', stake: '下注', result: '结果', payout: '到账', winRate: '胜率', total: '总次数', closedPnl: '已结算盈亏', last10: '最近 10 次', amount: '金额', asset: '币种', time: '时间' },
    status: { holding: '持有中', redeeming: '赎回中', closed: '已结束', credited: '已到账', confirmed: '已到账', completed: '已完成', pending: '处理中', processing: '处理中', failed: '失败', rejected: '已拒绝' },
    result: { won: '赢', lost: '输', void: '作废', open: '未结算' }, won: '赢', lost: '输', days: (n) => `${n} 天`, open: '发出时未结算',
  },
  en: {
    kinds: { quant_day: 'Day result', quant_product: 'Product P&L', quant_total: 'Total return', holdings: 'Holdings', prediction_bet: 'Prediction', prediction_record: 'Track record', deposit: 'Deposit', withdrawal: 'Withdrawal' },
    group: { quant: 'Koala Quant', prediction: 'Predictions', funds: 'Funds record' }, snapshot: 'Account snapshot', provenance: brandText('A-REIT account snapshot'), funds: 'A funds record, not a return',
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
/** Products arrive as `{ slug, name }` (2026-11-04: they printed as "[object Object]" and crashed the holdings card). */
export const nameOf = (value: unknown): string => typeof value === 'string' ? value : value && typeof value === 'object' && 'name' in value ? String((value as { name: unknown }).name ?? '—') : value === null || value === undefined ? '—' : String(value)

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
    return nameOf(value)
  }
  let hero: CardModel['hero'] = null, holdings: HoldingRow[] | null = null, dots: string[] = [], used: string[] = []
  if (kind === 'holdings') {
    if (has('totalPrincipal')) { used.push('totalPrincipal'); hero = { kicker: k.f.totalPrincipal, text: amount('totalPrincipal'), unit: asset, tone: 'flat' } }
    if (has('products') && Array.isArray(v.products)) {
      used.push('products')
      holdings = (v.products as Array<{ product: unknown; weight: number | string; lastDayReturnPct?: number | string | null }>).map((item) => { const w = asNumber(item.weight) ?? 0; return { product: nameOf(item.product), share: w <= 1 ? w * 100 : w, lastDayReturnPct: asNumber(item.lastDayReturnPct) } })
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

const flipCopy: Partial<Record<AppLocale, { more: string; back: string; paper: string }>> = { 'zh-CN': { more: '点按打开', back: '点按收起', paper: '明细' }, en: { more: 'Tap to open', back: 'Tap to close', paper: 'Details' } }

/**
 * The card (2026-11-04, after the user's reference): a dark folder card. A soft, blurred photo fills the top with the
 * product line in its corner; a dark sheet with a tab rises over it — the kind on the tab, the main figure at the foot.
 * It is a folder you can hold (2026-11-04, user: tapping it should open like a folder, not flip): it tilts under the
 * finger, and a tap drops the front flap and slides the paper with the details up out of it. The provenance and the
 * risk line sit under it and never hide. `mini` (晒单精选) and `still` (inside another button) are not interactive.
 */
export function ResultCard({ card, author, compact = false, mini = false, still = false }: { card: PostCard; author?: Author; compact?: boolean; mini?: boolean; still?: boolean }) {
  const { locale } = useI18n()
  const k = useResultCardCopy()
  const f = flipCopy[locale] ?? flipCopy.en!
  const m = describeCard(card, k, locale)
  const live = !mini && !still
  const [flipped, setFlipped] = useState(false)
  const frame = useRef<HTMLDivElement>(null)
  const paper = useRef<HTMLDivElement>(null)
  // The flap drops as far as the paper needs to show all of it above the flap.
  const toggle = () => setFlipped((open) => {
    const el = frame.current, sheet = el?.querySelector<HTMLElement>('[data-sheet]')
    if (!open && el && paper.current && sheet) el.style.setProperty('--drop', `${Math.max(0, paper.current.scrollHeight + 18 - sheet.offsetTop)}px`)
    return !open
  })
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = frame.current
    if (!el || !press.current) return
    const box = el.getBoundingClientRect()
    const px = (event.clientX - box.left) / box.width - .5, py = (event.clientY - box.top) / box.height - .5
    if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) press.current.moved = true
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`); el.style.setProperty('--rx', `${(-py * 8).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((px + .5) * 100).toFixed(1)}%`); el.style.setProperty('--gy', `${((py + .5) * 100).toFixed(1)}%`)
    el.style.setProperty('--px', px.toFixed(3)); el.style.setProperty('--py', py.toFixed(3))
  }
  const rest = () => { const el = frame.current; if (press.current) dragged.current = press.current.moved; press.current = null; if (!el) return; delete el.dataset.held; for (const name of ['--rx', '--ry', '--px', '--py']) el.style.removeProperty(name) }
  const side = m.hero?.sub ? { value: m.hero.sub, label: card.kind === 'prediction_record' ? k.f.total : k.f.returnPct, tone: m.hero.subTone } : (() => { const cell = m.grid.find((item) => !item.hidden); return cell ? { value: cell.value, label: cell.label, tone: cell.tone } : null })()
  const kindName = m.head.split(' · ').pop() ?? m.head
  const question = card.kind === 'prediction_bet' ? m.title : null
  const subline = question ? k.group[m.group] : m.title ?? k.group[m.group]

  const front = <div className={s.face} data-face="front">
    <div className={s.photo} aria-hidden="true"><PrismaticBand /></div>
    <span className={s.label}><b>{k.group[m.group]}</b><small>{k.snapshot}</small></span>
    {live && <div ref={paper} className={s.paper} aria-hidden={!flipped}>
      <span className={s.paperHead}><b>{f.paper}</b><small dir="auto">{kindName} · {subline}</small></span>
      {m.holdings && <Holdings rows={m.holdings} />}
      {m.grid.length > 0 && <dl className={s.grid}>
        {m.grid.map((cell) => cell.hidden
          ? <div key={cell.key} data-hidden=""><dt>{cell.label}</dt><dd><i className={s.veil} /><EyeOff size={13} strokeWidth={1.8} aria-hidden="true" /></dd></div>
          : <div key={cell.key}><dt>{cell.label}</dt><dd dir="auto" data-tone={cell.tone}>{cell.value}</dd></div>)}
      </dl>}
    </div>}
    <div className={s.sheet} data-sheet="">
      <span className={s.tab}><b>{kindName}</b></span>
      <small className={s.subline} dir="auto">{subline}</small>
      <div className={s.mid}>
        {question && <b className={s.question} dir="auto">{question}</b>}
        {m.dots.length > 0 && <span className={s.dots} aria-label={k.f.last10}>{m.dots.map((item, index) => <i key={index} data-r={item} />)}</span>}
        {m.holdings && <HoldingBar rows={m.holdings} />}
        {m.open && <span className={s.note}>{k.open}</span>}
      </div>
      <div className={s.foot}>
        {m.hero ? <span className={s.hero}>{m.hero.kicker && <small>{m.hero.kicker}</small>}<b className={s.figure} data-tone={m.hero.tone} dir="ltr">{m.hero.text}{m.hero.unit && <em>{m.hero.unit}</em>}</b></span> : <span />}
        {side && <span className={s.side}><b data-tone={side.tone} dir="auto">{side.value}</b><small>{side.label}</small></span>}
      </div>
      {live && <span className={s.hint} aria-hidden="true">{flipped ? f.back : f.more}</span>}
    </div>
    {live && <span className={s.room} aria-hidden="true" />}
  </div>

  return <article className={s.card} data-card="" data-group={m.group} data-compact={compact || mini || undefined} data-mini={mini || undefined} aria-label={m.head}>
    <div ref={frame} className={s.frame} data-live={live || undefined} data-open={flipped || undefined}
      {...(live ? {
        role: 'button', tabIndex: 0, 'aria-expanded': flipped,
        onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => { press.current = { x: event.clientX, y: event.clientY, moved: false }; frame.current!.dataset.held = ''; tilt(event) },
        onPointerMove: tilt, onPointerUp: rest, onPointerLeave: rest, onPointerCancel: rest,
        onClick: (event: React.MouseEvent) => { event.stopPropagation(); if (dragged.current) { dragged.current = false; return } navigator.vibrate?.(4); toggle() },
        onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } },
      } : {})}>
      <div className={s.turn}>{front}</div>
      {live && <i className={s.glare} aria-hidden="true" />}
    </div>
    <footer className={s.below}>
      {author && <span className={s.who}><CommunityAvatar avatarUrl={author.avatarUrl ?? null} seed={author.avatarSeed ?? author.handle} handle={author.handle} size={mini ? 24 : 32} /><span><b dir="auto">{author.displayName}</b><small>@{author.handle}</small></span></span>}
      <span className={s.prov}>{m.provenance}</span>
      {m.funds && <small className={s.risk}>{m.funds}</small>}
      <small className={s.risk}>{m.risk}</small>
    </footer>
  </article>
}

function HoldingBar({ rows }: { rows: HoldingRow[] }) {
  return <span className={s.bar}>{rows.map((item, index) => <i key={index} style={{ flexGrow: Math.max(item.share, 1) }} data-i={index % 4} />)}</span>
}

function Holdings({ rows }: { rows: HoldingRow[] }) {
  return <div className={s.holdings}>
    <ul>{rows.map((item, index) => <li key={index}><i data-i={index % 4} /><span dir="auto">{item.product}</span>{item.lastDayReturnPct !== null && <small data-tone={tone(item.lastDayReturnPct)}>{pct(item.lastDayReturnPct)}</small>}<b>{Math.round(item.share)}%</b></li>)}</ul>
  </div>
}

export type { CardSnapshot }
