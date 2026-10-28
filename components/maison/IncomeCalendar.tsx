'use client'

/**
 * Income calendar (2026-10-29): one month, a cell per day tinted by that day's signed result (green up, red down, the
 * depth by size within the month), the month's total on top. Tapping a day filters the list under it; tapping it again
 * clears the filter. Amounts are the rows' own; nothing is estimated.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AMOUNT_MASK } from '@/lib/use-amount-mask'
import { fmtAtomic } from './format'
import k from './income-calendar.module.css'

type Row = { date: string; atomic: bigint | null }
const ZERO = BigInt(0)
const key = (d: Date) => d.toLocaleDateString('en-CA')

export function IncomeCalendar({ rows, locale, masked, day, onDay }: { rows: Row[]; locale: string; masked: boolean; day: string | null; onDay: (day: string | null) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const byDay = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const row of rows) { const d = new Date(row.date); if (!Number.isNaN(d.getTime())) map.set(key(d), (map.get(key(d)) ?? ZERO) + (row.atomic ?? ZERO)) }
    return map
  }, [rows])
  const cells = useMemo(() => {
    const first = new Date(month), lead = (first.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  }, [month])
  const inMonth = cells.filter((d): d is Date => d !== null).map(d => byDay.get(key(d)) ?? ZERO)
  const peak = inMonth.reduce((max, v) => (v < ZERO ? -v : v) > max ? (v < ZERO ? -v : v) : max, ZERO)
  const total = inMonth.reduce((sum, v) => sum + v, ZERO)
  const short = (v: bigint) => { const n = Number(v) / 1e6, a = Math.abs(n); return `${n > 0 ? '+' : n < 0 ? '−' : ''}${a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a >= 100 ? a.toFixed(0) : a.toFixed(2)}` }
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }))
  const today = key(new Date())
  const shift = (n: number) => { onDay(null); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)) }

  return <section className={k.cal} aria-label={month.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}>
    <header className={k.head}>
      <button type="button" aria-label="‹" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
      <span><b>{month.toLocaleDateString(locale, { year: 'numeric', month: 'long' })}</b>
        <small data-tone={masked || total === ZERO ? undefined : total > ZERO ? 'up' : 'down'}>{masked ? AMOUNT_MASK : `${total > ZERO ? '+' : ''}${fmtAtomic(total.toString(), 6, 'USDT', 2)}`}</small></span>
      <button type="button" aria-label="›" disabled={month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth()} onClick={() => shift(1)}><ChevronRight size={18} /></button>
    </header>
    <div className={k.grid} role="grid">
      {weekdays.map((w, i) => <span key={`w${i}`} className={k.weekday}>{w}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={`e${i}`} />
        const id = key(d), v = byDay.get(id) ?? ZERO, has = byDay.has(id)
        const depth = peak > ZERO ? .18 + .62 * Number((v < ZERO ? -v : v) * BigInt(1000) / peak) / 1000 : 0
        return <button key={id} type="button" className={k.day} data-tone={!has ? undefined : v > ZERO ? 'up' : v < ZERO ? 'down' : 'flat'} data-today={id === today || undefined}
          data-strong={depth > .48 || undefined} aria-pressed={day === id} disabled={!has} style={{ ['--depth' as string]: depth.toFixed(3) }} onClick={() => onDay(day === id ? null : id)}>
          <b>{d.getDate()}</b>{has && <small>{masked ? '•' : short(v)}</small>}
        </button>
      })}
    </div>
  </section>
}
