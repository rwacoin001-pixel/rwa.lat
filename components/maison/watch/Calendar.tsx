'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { QuantProduct } from '@/lib/api/quant'
import { formatPct, localToday, type Tick } from '@/lib/quant-view-model'

/** Product performance calendar. Account payouts remain in the separate account ledger. */
export function QuantCalendar({ product, ticks, selected, onSelect, english = false }: {
  product: QuantProduct; ticks: Tick[]; selected: number | null; onSelect: (index: number | null) => void; english?: boolean
}) {
  const today = localToday(product.timezone)
  const active = ticks[selected ?? ticks.length - 1]?.date ?? today
  const [month, setMonth] = useState(() => active.slice(0, 7))
  const rows = useMemo(() => new Map(product.history.map(row => [row.tradeDate, row])), [product.history])
  const firstMonth = product.history[0]?.tradeDate.slice(0, 7) ?? today.slice(0, 7)
  const [year, number] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const move = (delta: number) => setMonth(new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7))
  const pick = (date: string) => {
    const index = ticks.findIndex(tick => tick.date === date)
    if (index < 0) return
    onSelect(date === today ? null : index)
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return <section className="calendar-panel" aria-labelledby="quant-calendar-title">
    <header className="sheet-head"><div><span className="eyebrow">{english ? 'PRODUCT · DAILY PERFORMANCE' : '产品每日表现 · 非个人收益'}</span><h2 id="quant-calendar-title">{english ? 'Return calendar' : '收益日历'}</h2></div><CalendarDays size={20} strokeWidth={1} aria-hidden="true" /></header>
    <div className="month-head"><button type="button" className="icon-button" aria-label={english ? 'Previous month' : '上个月'} disabled={month <= firstMonth} onClick={() => move(-1)}><ChevronLeft size={18} /></button><span><b>{year}</b><i>/</i>{String(number).padStart(2,'0')}</span><button type="button" className="icon-button" aria-label={english ? 'Next month' : '下个月'} disabled={month >= today.slice(0,7)} onClick={() => move(1)}><ChevronRight size={18} /></button></div>
    <div className="weekdays">{(english ? ['M','T','W','T','F','S','S'] : [...'一二三四五六日']).map((day, i) => <span key={i}>{day}</span>)}</div>
    <div className="calendar-grid">
      {Array.from({length:offset},(_,i)=><span key={'space'+i} />)}
      {Array.from({length:count},(_,i)=>{
        const date = `${month}-${String(i+1).padStart(2,'0')}`
        const row = rows.get(date)
        const value = row ? Number(row.netReturnPct) : null
        const current = date === today
        const inDial = ticks.some(tick => tick.date === date)
        const hint = value !== null ? formatPct(value) : current ? (english ? 'Pending' : '待结算') : '—'
        return <button type="button" key={date} className={`calendar-day${date===active?' picked':''}${value!==null&&value<0?' loss':''}${current?' today':''}`} disabled={(!row&&!current)||!inDial} aria-label={`${date} ${hint}`} aria-pressed={date===active} onClick={()=>pick(date)}><span>{i+1}</span><small>{hint}</small></button>
      })}
    </div>
    <footer className="calendar-footer"><span>{english ? 'Product index · net of management fee' : '产品指数 · 已扣管理费'}</span><button type="button" onClick={()=>pick(today)}>{english ? 'Today' : '回到今天'}<ChevronRight size={14}/></button></footer>
  </section>
}
