'use client'

import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { getSessionToken, request } from '@/lib/api/_http'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { useI18n } from '@/lib/i18n'
import RwaTopbar from './rwa-topbar'
import { EmptyState } from './ui/Empty'

type Pair = Record<string, unknown> & { symbol?: string; priceTick?: string; quantityStep?: string; minQuantity?: string; lastPrice?: string }
type Level = Record<string, unknown> & { price?: string; quantity?: string; size?: string }
type Order = Record<string, unknown> & { id?: string; symbol?: string; state?: string; side?: string; price?: string; quantity?: string; filledQuantity?: string }
type Candle = Record<string, unknown> & { close?: string; open?: string; high?: string; low?: string }
const arrayOf = <T,>(data: unknown): T[] => Array.isArray(data) ? data as T[] : data && typeof data === 'object' ? (['items', 'pairs', 'orders', 'trades', 'candles'].map(key => (data as Record<string, unknown>)[key]).find(Array.isArray) ?? []) as T[] : []
const num = (value: unknown) => value == null || value === '' ? null : Number(value)
const valid = (value: number | null) => value !== null && Number.isFinite(value)

export function TradeScreen({ go, initialSymbol }: { go: (screen: RwaScreen) => void; initialSymbol?: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh-CN'
  const [pairs, setPairs] = useState<Pair[]>([])
  const [symbol, setSymbol] = useState('')
  const [pair, setPair] = useState<Pair | null>(null)
  const [bids, setBids] = useState<Level[]>([])
  const [asks, setAsks] = useState<Level[]>([])
  const [trades, setTrades] = useState<Array<Record<string, unknown>>>([])
  const [candles, setCandles] = useState<Candle[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [type, setType] = useState<'limit' | 'market'>('limit')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [interval, setInterval] = useState('1h')
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'stale'>('loading')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const idempotencyKeys = useRef(new Map<string, string>())
  useEffect(() => {
    setAuthenticated(Boolean(getSessionToken()))
  }, [])

  useEffect(() => {
    let active = true
    void request<unknown>('/v1/market/pairs').then(result => {
      if (!active) return
      if (!result.ok) { setMessage(result.error.message); setState('error'); return }
      const items = arrayOf<Pair>(result.data).filter(item => typeof item.symbol === 'string')
      setPairs(items)
      const requested = initialSymbol ?? new URLSearchParams(location.search).get('symbol')
      const first = items.find(item => item.symbol === requested)?.symbol ?? items[0]?.symbol ?? ''
      setSymbol(first)
      if (first) history.replaceState(history.state, '', `/trade/${encodeURIComponent(first)}`)
      else setState('ready')
    })
    return () => { active = false }
  }, [initialSymbol])

  const refresh = useCallback(async (current: string) => {
    if (!current) return
    const encoded = encodeURIComponent(current)
    const [details, book, recent] = await Promise.all([
      request<Pair>(`/v1/market/pairs/${encoded}`),
      request<{ bids?: Level[]; asks?: Level[] }>(`/v1/market/pairs/${encoded}/orderbook?depth=20`),
      request<unknown>(`/v1/market/pairs/${encoded}/trades?limit=20`),
    ])
    if (details.ok) setPair(details.data)
    if (book.ok) { setBids(book.data.bids ?? []); setAsks(book.data.asks ?? []) }
    if (recent.ok) setTrades(arrayOf<Record<string, unknown>>(recent.data))
    setState(details.ok && book.ok && recent.ok ? 'ready' : details.ok ? 'stale' : 'error')
    if (!details.ok) setMessage(details.error.message)
  }, [])
  const refreshOrders = useCallback(async () => {
    if (!authenticated) return
    const result = await request<unknown>('/v1/market/orders')
    if (result.ok) setOrders(arrayOf<Order>(result.data))
  }, [authenticated])
  useEffect(() => {
    if (!symbol) return
    void refresh(symbol); void refreshOrders()
    const timer = window.setInterval(() => { void refresh(symbol); void refreshOrders() }, 15000)
    return () => window.clearInterval(timer)
  }, [symbol, refresh, refreshOrders])
  useEffect(() => {
    if (!symbol) return
    let active = true
    void request<unknown>(`/v1/market/pairs/${encodeURIComponent(symbol)}/candles?interval=${interval}&limit=80`).then(result => { if (active) setCandles(result.ok ? arrayOf<Candle>(result.data) : []) })
    return () => { active = false }
  }, [symbol, interval])

  const amount = num(quantity)
  const rate = num(price)
  const tick = num(pair?.priceTick ?? pair?.tickSize)
  const step = num(pair?.quantityStep)
  const minimum = num(pair?.minQuantity)
  const aligned = (value: number, quantum: number | null) => !valid(quantum) || !quantum || Math.abs(value / quantum - Math.round(value / quantum)) < 1e-8
  const error = !valid(amount) || amount! <= 0 ? (zh ? '填写有效数量' : 'Enter a valid quantity') : valid(minimum) && amount! < minimum! ? (zh ? '低于最小数量' : 'Below minimum quantity') : !aligned(amount!, step) ? (zh ? '数量不符合步进' : 'Quantity step mismatch') : type === 'limit' && (!valid(rate) || rate! <= 0 || !aligned(rate!, tick)) ? (zh ? '价格需符合最小变动单位' : 'Price must align with tick size') : ''
  const submit = async () => {
    if (pending || error || state !== 'ready') return
    if (!authenticated) { go('login'); return }
    setPending(true); setMessage('')
    const path = '/v1/market/orders'
    const body = { symbol, side, type, ...(type === 'limit' ? { price: Number(price) } : {}), quantity: Number(quantity) }
    const result = await request<Record<string, unknown>>(path, {
      method: 'POST',
      body: JSON.stringify({ ...body, idempotencyKey: idempotencyKeyForIntent(idempotencyKeys.current, 'POST', path, body) }),
    })
    setPending(false)
    setMessage(result.ok ? `${zh ? '订单状态' : 'Order state'}: ${String(result.data.state ?? 'submitted')}` : result.error.message)
    if (result.ok) { idempotencyKeys.current.clear(); void refresh(symbol); void refreshOrders() }
  }
  const cancel = async (id: string) => {
    const result = await request<unknown>(`/v1/market/orders/${encodeURIComponent(id)}`, { method: 'DELETE' })
    setMessage(result.ok ? (zh ? '撤单请求已处理' : 'Cancellation processed') : result.error.message)
    void refreshOrders()
  }
  const currentOrders = orders.filter(order => order.symbol === symbol)
  const range = candles.map(item => num(item.close)).filter((value): value is number => valid(value))
  const chart = range.length > 1 ? range.map((value, index) => `${index === 0 ? 'M' : 'L'} ${index / (range.length - 1) * 320} ${90 - (value - Math.min(...range)) / (Math.max(...range) - Math.min(...range) || 1) * 70}`).join(' ') : ''

  return <section className="screen trade-screen"><RwaTopbar screen="trade" title={zh ? '交易' : 'Trade'} onBack={() => go('invest')} />
    <div className="trade-hero"><img src="/media/generated/design-v2/trade-glass-topology-v1.png" alt="" /><div><small>MARKET / EXECUTION</small><select value={symbol} onChange={event => { setSymbol(event.target.value); history.replaceState(history.state, '', `/trade/${encodeURIComponent(event.target.value)}`) }} aria-label={zh ? '交易对' : 'Trading pair'}>{pairs.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select><strong dir="ltr">{pair?.lastPrice == null ? '—' : String(pair.lastPrice)}</strong></div></div>
    {state === 'error' && <EmptyState variant="card" icon={RefreshCw} title={zh ? '行情暂不可用' : 'Market unavailable'} body={message || (zh ? '暂时无法读取交易数据。' : 'Trading data could not be loaded right now.')} action={<button type="button" className="p0a-secondary-button" onClick={() => void refresh(symbol)}><RefreshCw size={16} />{zh ? '重试' : 'Retry'}</button>} />}
    {state === 'stale' && <div className="trade-notice">{zh ? '行情更新中断，下单暂不可用。' : 'Market updates interrupted. Trading is paused.'}</div>}
    <div className="trade-card glass"><div className="trade-card-title"><h2>{zh ? '价格走势' : 'Price history'}</h2><select value={interval} onChange={event => setInterval(event.target.value)}>{['1m','5m','15m','1h','4h','1d'].map(item => <option key={item}>{item}</option>)}</select></div>{chart ? <svg viewBox="0 0 320 100" role="img" aria-label={zh ? '真实 K 线收盘价趋势' : 'Live candle close prices'}><path d={chart} fill="none" stroke="var(--accent)" strokeWidth="2.5" /></svg> : <div className="trade-empty-state"><ChartNoAxesColumnIncreasing size={20} /><b>{zh ? '暂无价格走势' : 'Price history is not available yet'}</b><small>{zh ? '有新的成交数据后，这里会显示走势。' : 'Price movement will appear after new market data is available.'}</small></div>}</div>
    <div className="trade-book"><div className="trade-card glass"><h2>{zh ? '卖盘' : 'Asks'}</h2>{asks.slice(0, 8).map((item, index) => <button type="button" key={index} onClick={() => { setPrice(String(item.price ?? '')); setType('limit') }}><span dir="ltr">{String(item.price ?? '—')}</span><span dir="ltr">{String(item.quantity ?? item.size ?? '—')}</span></button>)}</div><div className="trade-card glass"><h2>{zh ? '买盘' : 'Bids'}</h2>{bids.slice(0, 8).map((item, index) => <button type="button" key={index} onClick={() => { setPrice(String(item.price ?? '')); setType('limit') }}><span dir="ltr">{String(item.price ?? '—')}</span><span dir="ltr">{String(item.quantity ?? item.size ?? '—')}</span></button>)}</div></div>
    <div className="trade-card glass"><h2>{zh ? '下单' : 'Place order'}</h2><div className="trade-tabs"><button type="button" className={side === 'buy' ? 'active' : ''} onClick={() => setSide('buy')}><ArrowDownRight size={16} />{zh ? '买入' : 'Buy'}</button><button type="button" className={side === 'sell' ? 'active' : ''} onClick={() => setSide('sell')}><ArrowUpRight size={16} />{zh ? '卖出' : 'Sell'}</button></div><div className="trade-tabs"><button type="button" className={type === 'limit' ? 'active' : ''} onClick={() => setType('limit')}>{zh ? '限价' : 'Limit'}</button><button type="button" className={type === 'market' ? 'active' : ''} onClick={() => setType('market')}>{zh ? '市价' : 'Market'}</button></div>{type === 'limit' && <label>{zh ? '价格' : 'Price'}<input value={price} onChange={event => setPrice(event.target.value)} inputMode="decimal" /></label>}<label>{zh ? '数量' : 'Quantity'}<input value={quantity} onChange={event => setQuantity(event.target.value)} inputMode="decimal" /></label>{error && <small className="trade-error">{error}</small>}<button type="button" className="trade-submit" disabled={pending || state !== 'ready' || Boolean(error)} onClick={() => void submit()}>{authenticated ? pending ? (zh ? '提交中…' : 'Submitting…') : (zh ? '确认下单' : 'Place order') : (zh ? '登录后交易' : 'Sign in to trade')}</button>{message && <p role="status">{message}</p>}</div>
    <div className="trade-card glass"><div className="trade-card-title"><h2>{zh ? '我的订单' : 'My orders'}</h2><button type="button" onClick={() => go('records')}>{zh ? '全部' : 'View all'}</button></div>{!authenticated ? <button type="button" onClick={() => go('login')}>{zh ? '登录后查看' : 'Sign in to view'}</button> : currentOrders.length ? currentOrders.map((order, index) => <div className="trade-order" key={String(order.id ?? index)}><span><b dir="ltr">{order.side} {order.quantity}</b><small>{order.state} · {order.filledQuantity ?? '—'} filled</small></span>{['open','partial'].includes(String(order.state)) && order.id && <button type="button" onClick={() => void cancel(order.id!)}>{zh ? '撤单' : 'Cancel'}</button>}</div>) : <p>{zh ? '暂无订单' : 'No orders yet'}</p>}</div>
    <div className="trade-card glass"><h2>{zh ? '最新成交' : 'Recent trades'}</h2>{trades.length ? trades.slice(0, 8).map((item, index) => <div className="trade-order" key={index}><span dir="ltr">{String(item.price ?? '—')}</span><span dir="ltr">{String(item.quantity ?? item.size ?? '—')}</span></div>) : <div className="trade-empty-state"><ChartNoAxesColumnIncreasing size={20} /><b>{zh ? '暂无成交记录' : 'No recent trades yet'}</b><small>{zh ? '有新的市场成交后，这里会显示记录。' : 'Recent executions will appear after the market records a trade.'}</small></div>}</div><p className="trade-disclosure"><ShieldCheck size={16} />{zh ? '价格和状态来自实时市场；离开本页后停止更新。' : 'Prices and order states update while this page is open.'}</p>
  </section>
}
