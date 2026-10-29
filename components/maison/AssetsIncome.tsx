'use client'

/**
 * Income = settled net performance (2026-10-29, agreed with Codex). One scope, the month: a month selector, the month's
 * net in large, the all-time net under it, a compact calendar without heat fills (the day's figure in its sign colour,
 * a dot for days with a result), then the month's settlements grouped by day. A bet counts as its net (payout minus
 * stake, or minus the stake when lost); a quant day as its net after fees. Tapping a day narrows the list to it.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { listYield } from '@/lib/api/portfolio'
import { useQuantProducts } from '@/lib/api/quant'
import { openPath } from '@/lib/maison-nav'
import { AMOUNT_MASK, useAmountMask } from '@/lib/use-amount-mask'
import { useOtherIncome } from './money-records'
import { useQuantProduct } from './QuantPositionCard'
import { Skeleton, StateBlock } from './primitives'
import { fmtAtomic } from './format'
import l from './assets-ledger.module.css'

const ZERO = BigInt(0)
type Copy = { month: string; allTime: string; other: string; showMonth: string; empty: string; emptyBody: string; today: string; yesterday: string }
const COPY: Partial<Record<AppLocale, Copy>> = {
  'zh-CN': { month: '本月净收益 · USDT', allTime: '累计净收益', other: '其他', showMonth: '查看整月', empty: '这个月还没有结算', emptyBody: '考拉量化每天结算，预测在市场结束后结算。', today: '今天', yesterday: '昨天' },
  en: { month: 'Net income this month · USDT', allTime: 'All-time net', other: 'Other', showMonth: 'Show the whole month', empty: 'Nothing settled this month', emptyBody: 'Koala Quant settles daily; predictions settle when the market ends.', today: 'Today', yesterday: 'Yesterday' },
}
const dayKey = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA') }

export function AssetsIncome() {
  const { locale } = useI18n()
  const c = COPY[locale] ?? COPY.en!
  const { masked } = useAmountMask()
  const other = useOtherIncome(locale)
  const credits = useQuery('portfolio:yield', listYield, { staleTime: 60_000 })
  const list = useQuantProducts()
  const quant = useQuantProduct(list.data?.[0]?.slug)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [day, setDay] = useState<string | null>(null)

  const rows = useMemo(() => [
    ...other.rows.map(row => ({ id: row.id, at: row.date, title: row.title, sub: row.sub, amount: row.atomic, path: row.path })),
    ...(credits.data ?? []).map(item => ({ id: item.id, at: item.creditedAt, title: c.other, sub: '', amount: /^\d+$/.test(item.atomicAmount) ? BigInt(item.atomicAmount) : ZERO, path: '' })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), [other.rows, credits.data, c.other])

  const monthKey = month.toLocaleDateString('en-CA').slice(0, 7)
  const inMonth = rows.filter(row => dayKey(row.at).startsWith(monthKey))
  const byDay = useMemo(() => { const m = new Map<string, bigint>(); for (const row of inMonth) m.set(dayKey(row.at), (m.get(dayKey(row.at)) ?? ZERO) + row.amount); return m }, [inMonth])
  const monthTotal = inMonth.reduce((sum, row) => sum + row.amount, ZERO)
  const position = quant.data?.position
  const allTime = (position && /^-?\d+$/.test(position.totalNetAtomic) ? BigInt(position.totalNetAtomic) : ZERO)
    + rows.filter(row => !row.id.startsWith('quant-')).reduce((sum, row) => sum + row.amount, ZERO)
  const shown = day ? inMonth.filter(row => dayKey(row.at) === day) : inMonth

  const signed = (v: bigint) => masked ? AMOUNT_MASK : `${v > ZERO ? '+' : ''}${fmtAtomic(v.toString(), 6, '', 2).trim()}`
  const tone = (v: bigint) => masked || v === ZERO ? undefined : v > ZERO ? 'up' : 'down'
  const thisMonth = new Date(); const isCurrent = month.getFullYear() === thisMonth.getFullYear() && month.getMonth() === thisMonth.getMonth()
  const shift = (n: number) => { setDay(null); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)) }
  const lead = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }))
  const todayKey = new Date().toLocaleDateString('en-CA')
  const compact = (v: bigint) => { const n = Number(v) / 1e6, a = Math.abs(n); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a >= 100 ? a.toFixed(0) : a.toFixed(2)}` }
  const label = (key: string) => key === todayKey ? c.today : key === new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA') ? c.yesterday : new Date(`${key}T12:00:00`).toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'short' })

  const loading = !other.ready || credits.data === undefined
  let lastDay = ''
  return <div className={l.root}>
    <header className={l.monthHead}>
      <button type="button" aria-label="‹" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
      <b>{month.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}</b>
      <button type="button" aria-label="›" disabled={isCurrent} onClick={() => shift(1)}><ChevronRight size={18} /></button>
    </header>
    <section className={l.summary}>
      <small>{c.month}</small>
      <p dir="ltr" data-tone={tone(monthTotal)}>{loading ? '—' : signed(monthTotal)}</p>
      <span>{c.allTime} <b dir="ltr" data-tone={tone(allTime)}>{loading ? '—' : signed(allTime)}</b></span>
    </section>
    <div className={l.cal} role="grid">
      {weekdays.map((w, i) => <span key={`w${i}`} className={l.weekday}>{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const key = new Date(month.getFullYear(), month.getMonth(), i + 1).toLocaleDateString('en-CA'), v = byDay.get(key), has = v !== undefined
        return <button key={key} type="button" className={l.cell} disabled={!has} aria-pressed={day === key} data-today={key === todayKey || undefined} data-tone={has ? tone(v!) ?? 'flat' : undefined}
          onClick={() => setDay(day === key ? null : key)}>
          <b>{i + 1}</b><small>{has ? (masked ? '•' : compact(v!)) : ''}</small>
        </button>
      })}
    </div>
    {day && <button type="button" className={l.showAll} onClick={() => setDay(null)}>{c.showMonth}</button>}
    {loading ? <Skeleton rows={4} />
      : !shown.length ? <StateBlock title={c.empty} body={c.emptyBody} />
      : <ul className={l.list}>{shown.flatMap(row => {
        const key = dayKey(row.at), head = key !== lastDay
        lastDay = key
        const body = <>
          <span className={l.main}><b dir="auto">{row.title}</b>{row.sub && <small>{row.sub}</small>}</span>
          <span className={l.fig}><b dir="ltr" data-tone={tone(row.amount)}>{signed(row.amount)}</b></span>
        </>
        return [...(head ? [<li key={`d-${row.id}`} className={l.day}><span>{label(key)}</span><b dir="ltr" data-tone={tone(byDay.get(key) ?? ZERO)}>{signed(byDay.get(key) ?? ZERO)}</b></li>] : []),
          <li key={row.id}>{row.path ? <button type="button" className={l.row} onClick={() => openPath(row.path)}>{body}</button> : <div className={l.row}>{body}</div>}</li>]
      })}</ul>}
  </div>
}
