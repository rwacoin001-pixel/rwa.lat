'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronRight, FileText, ReceiptText, RotateCw, Table2 } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { fromAtomic, listOrders, ORDER_STATE_TONE, type OrderView } from '@/lib/orders-data'
import { orderRouteCopy } from '@/lib/route-copy'
import { useI18n } from '@/lib/i18n'
import { formatMoney, formatTime } from '@/lib/display/format'
import { shortId } from '@/lib/display/labels'
import RwaTopbar from './rwa-topbar'

export function RecordsScreen({ go, openOrder }: { go: (screen: RwaScreen) => void; openOrder: (id: string) => void }) {
  const { locale } = useI18n()
  const copy = orderRouteCopy[locale]
  const [orders, setOrders] = useState<OrderView[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const load = useCallback(() => {
    setLoadState('loading')
    listOrders()
      .then((data) => { setOrders(data); setLoadState('ready') })
      .catch(() => setLoadState('error'))
  }, [])
  useEffect(() => { load() }, [load])
  const activeCount = orders.filter((order) => !['filled', 'failed', 'cancelled'].includes(order.state)).length
  const completedCount = orders.filter((order) => order.state === 'filled').length
  const requested = orders.reduce((sum, order) => sum + fromAtomic(order.requestedAtomicAmount), 0)
  const label = (state: string) => copy.status[state] ?? state

  return <section className="screen records-screen">
    <RwaTopbar screen="records" title={copy.title} onBack={() => go('profile')} />
    <header className="address-book-header">
      <p className="catalog-eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <small>{copy.body}</small>
      <button type="button" className="p0a-secondary-button" onClick={() => go('statements')}><Table2 size={15} /> {copy.ledger}</button>
    </header>
    {loadState === 'ready' && <div className="record-summary-grid"><span className="glass"><small>{copy.total}</small><b>{orders.length}</b></span><span className="glass"><small>{copy.active}</small><b>{activeCount}</b></span><span className="glass"><small>{copy.completed}</small><b>{completedCount}</b></span><span className="glass"><small>{copy.requested}</small><b>{formatMoney(requested, locale)} USDT</b></span></div>}
    {loadState === 'loading' && <div className="address-book-list">{[0, 1, 2].map((key) => <div key={key} className="address-skel" style={{ height: 74 }} />)}</div>}
    {loadState === 'error' && <div className="address-book-empty is-error"><AlertTriangle size={20} /><b>{copy.loadError}</b><small>{copy.loadErrorBody}</small><button type="button" onClick={load}><RotateCw size={14} /> {copy.retry}</button></div>}
    {loadState === 'ready' && orders.length === 0 && <div className="address-book-empty"><FileText size={20} /><b>{copy.empty}</b><small>{copy.emptyBody}</small></div>}
    {loadState === 'ready' && orders.length > 0 && <div className="record-stack glass">{orders.map((order) => <button key={order.id} type="button" onClick={() => openOrder(order.id)}><ReceiptText size={20} /><span><b>{order.productName}</b><small>{copy.submitted} · {formatTime(order.submittedAt, locale)} · {shortId(order.id)}</small><small>{copy.requestedAmount}: {formatMoney(fromAtomic(order.requestedAtomicAmount), locale)} USDT</small></span><strong className={`record-state is-${ORDER_STATE_TONE[order.state] ?? 'info'}`}>{label(order.state)}</strong><ChevronRight size={16} /></button>)}</div>}
  </section>
}
