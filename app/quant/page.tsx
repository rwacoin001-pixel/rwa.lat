'use client'

/**
 * The Koala Quant page exactly as the design study has it: one enamel dial with an engraved name and a six o'clock date
 * window, the 2 o'clock pusher switching between the day's return and the index, and the earnings calendar in 我的.
 * Numbers come from the live product, not from the study's sample data.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, ChevronLeft, ChevronRight, Home, Layers, PieChart } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { useQuantProducts, type QuantProduct } from '@/lib/api/quant'
import { useQuantProduct } from '@/components/maison/QuantPositionCard'
import { buildTicks, formatPct, localToday, type Tick } from '@/lib/quant-view-model'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { QuantDial } from '@/components/maison/watch/Dial'
import { QuantDailyBars, QuantKpis, QuantNavChart } from '@/components/maison/watch/Charts'
import { QuantPin } from '@/components/maison/watch/Pin'

import '@/components/maison/watch/preview.css'

const usd = (atomic: string | undefined) => (atomic ? (Number(atomic) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—')

function CalendarPanel({ product, selected, onSelect, ticks }: { product: QuantProduct; selected: number | null; onSelect: (index: number | null) => void; ticks: Tick[] }) {
  const history = product.history
  const byDate = useMemo(() => new Map(history.map((row) => [row.tradeDate, row])), [history])
  const lastDate = history[history.length - 1]?.tradeDate ?? product.performance.lastSettledDate ?? ''
  const [month, setMonth] = useState(lastDate.slice(0, 7))
  const firstMonth = history[0]?.tradeDate.slice(0, 7) ?? lastDate.slice(0, 7)
  const [year, mm] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, mm - 1, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, mm, 0)).getUTCDate()
  const activeDate = selected === null ? lastDate : ticks[selected]?.date
  const changeMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, mm - 1 + delta, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  const pick = (date: string) => {
    const index = ticks.findIndex((tick) => tick.date === date)
    if (index >= 0) onSelect(index === ticks.length - 1 ? null : index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return <section className="calendar-panel" aria-labelledby="calendar-title">
    <header className="sheet-head"><div><span className="eyebrow">SETTLEMENT CALENDAR</span><h2 id="calendar-title">收益日历</h2></div><CalendarDays size={20} strokeWidth={1} /></header>
    <div className="month-head">
      <button className="icon-button" aria-label="上个月" disabled={month <= firstMonth} onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
      <span><b>{year}</b><i>/</i>{String(mm).padStart(2, '0')}</span>
      <button className="icon-button" aria-label="下个月" disabled={month >= lastDate.slice(0, 7)} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
    </div>
    <div className="weekdays">{'一二三四五六日'.split('').map((d) => <span key={d}>{d}</span>)}</div>
    <div className="calendar-grid">
      {Array.from({ length: offset }, (_, i) => <span key={`empty${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`
        const row = byDate.get(date)
        const value = row ? Number(row.netReturnPct) : null
        return <button
          key={date}
          type="button"
          className={`calendar-day${date === activeDate ? ' picked' : ''}${value !== null && value < 0 ? ' loss' : ''}`}
          disabled={!row}
          aria-label={`${date} ${value !== null ? formatPct(value) : '暂无结算记录'}`}
          aria-pressed={date === activeDate}
          onClick={() => pick(date)}
        >
          <span>{i + 1}</span>
          <small>{value !== null ? formatPct(value) : '—'}</small>
        </button>
      })}
    </div>
    <div className="calendar-key"><span><i />盈利日</span><span><i className="loss-dot" />亏损日</span><span>未结算日不计收益</span></div>
    <footer className="calendar-footer"><span>每日结算 · 新加坡时间</span><button onClick={() => pick(lastDate)}>回到最新<ArrowRight size={14} /></button></footer>
  </section>
}

export default function QuantWatchPage() {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [tab, setTab] = useState<'overview' | 'account'>('overview')
  const [picked, setPicked] = useState<number | null>(null)
  const list = useQuantProducts()
  const detail = useQuantProduct(list.data?.[0]?.slug)
  const product = detail.data

  useEffect(() => {
    const saved = localStorage.getItem('rwa.theme') ?? localStorage.getItem('rwa-app-theme')
    if (saved === 'dark') setTheme('dark')
  }, [])

  const ticks = useMemo(() => product
    ? buildTicks(product.history.map((row) => ({ date: row.tradeDate, value: Number(row.netReturnPct) })), { today: localToday(product.timezone), count: 30 })
    : [], [product])

  const body = !product
    ? <section className="overview-body"><div className="empty-state"><CalendarDays size={28} strokeWidth={1} /><h3>正在载入</h3><p>考拉量化的结算记录还在路上。</p></div></section>
    : tab === 'overview'
      ? <div className="overview-body" role="tabpanel" aria-label="总览">
        <div className="section-intro"><span>表现记录</span><small>每日结算 · 新加坡时间</small></div>
        {product.history.length
          ? <>
            <QuantNavChart product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
            <QuantDailyBars product={product} ticks={ticks} selected={picked} onSelect={setPicked} c={c} />
          </>
          : <div className="empty-state"><CalendarDays size={28} strokeWidth={1} /><h3>等待首笔结算</h3><p>结算完成后，净值走势与每日收益将在这里显示。</p></div>}
        <p className="risk-note">{c.indexNote}<br />历史表现不代表未来，本金可能亏损。</p>
      </div>
      : <section className="account-body" role="tabpanel" aria-label="我的">
        <span className="eyebrow">YOUR POSITION</span>
        <h2>我的量化</h2>
        <CalendarPanel product={product} selected={picked} onSelect={setPicked} ticks={ticks} />
        {product.position
          ? <div className="account-placeholder" style={{ textAlign: 'start' }}>
            <h3 style={{ marginTop: 0 }}>当前本金 {usd(product.position.principalAtomic)} USDT</h3>
            <p>累计净收益 {usd(product.position.totalNetAtomic)} USDT · 累计费用 {usd(product.position.totalFeesAtomic)} USDT<br />待处理指令 {product.position.pendingOrders.length} 笔{product.position.lastDay ? ` · 最近结算 ${product.position.lastDay.tradeDate}` : ''}</p>
            <button onClick={() => setTab('overview')}>查看产品表现<ArrowRight size={14} /></button>
          </div>
          : <div className="account-placeholder">
            <PieChart size={25} strokeWidth={1} />
            <h3>还没有持仓</h3>
            <p>申购后，这里显示本金、累计净收益与每日结算记录。</p>
            <button onClick={() => setTab('overview')}>查看产品表现<ArrowRight size={14} /></button>
          </div>}
      </section>

  return <div className="rwa-mobile preview-app" data-theme={theme}>
    <main className="study-stage">
      {product
        ? <QuantPin
          dial={<QuantDial ticks={ticks} selected={picked} onSelect={setPicked} copy={c} product={product} />}
          subs={<QuantKpis product={product} c={c} />}
          menu={<div className="section-menu" role="tablist" aria-label="考拉量化">
            <span className="menu-highlight" style={{ transform: `translateX(${tab === 'overview' ? '0' : '100%'})` }} />
            {[{ key: 'overview', label: '总览', icon: Layers }, { key: 'account', label: '我的', icon: PieChart }].map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key as 'overview' | 'account')}><item.icon size={15} strokeWidth={1.5} />{item.label}</button>)}
          </div>}
          body={body}
        />
        : <div className="overview-body" style={{ paddingTop: 120 }}>{body}</div>}
      <div className="bottom-space" />
    </main>
    <div className="dock-wrap">
      <nav className="bottom-dock" aria-label="主导航">
        {[{ name: '首页', icon: Home, href: '/' }, { name: '市场', icon: ChartNoAxesColumnIncreasing, href: '/markets' }, { name: '量化', icon: Layers, href: '/quant' }, { name: '资产', icon: PieChart, href: '/assets' }].map((item) => <button key={item.name} className={item.name === '量化' ? 'active' : ''} aria-current={item.name === '量化' ? 'page' : undefined} onClick={() => { if (item.href !== '/quant') window.location.href = item.href }}><item.icon size={20} strokeWidth={1.4} /><span>{item.name}</span></button>)}
      </nav>
    </div>
  </div>
}
