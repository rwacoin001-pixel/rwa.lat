'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { QuantPayout, QuantPosition, QuantProduct } from '@/lib/api/quant'
import { quantCopyFor, type QuantCopy } from '@/lib/maison-quant-copy'
import { pendingCount, shortDate } from '@/lib/quant-view-model'
import { QuantReceipt, signedUsdt, usdtNumber } from './QuantParts'
import styles from './quant-page.module.css'

type Query<T> = { data?: T; error?: unknown; loading: boolean; refetch: () => Promise<unknown> }

/** Loading / error-with-retry / empty states shared by every fetched block; cached content stays on screen if a refresh fails. */
export function BlockState<T>({ query, c, empty, children }: { query: Query<T>; c: QuantCopy; empty?: string; children: (data: T) => React.ReactNode }) {
  if (query.data !== undefined && query.data !== null) return <>{query.error ? <p className={styles.stale} role="status">{c.view.updateFailed} <button type="button" className={styles.link} onClick={() => void query.refetch()}>{c.retry}</button></p> : null}{children(query.data)}</>
  if (query.error) return <p className={styles.state} role="alert">{c.loadError} <button type="button" onClick={() => void query.refetch()}>{c.retry}</button></p>
  if (query.loading) return <p className={`${styles.state} ${styles.mini}`} role="status">{c.view.loading}</p>
  return <p className={styles.state}>{empty ?? c.view.unavailable}</p>
}

/** Principal, latest-day net and pending count, directly under the header for anyone who has money here. */
export function QuantStrip({ position, c }: { position: QuantPosition; c: QuantCopy }) {
  const { locale } = useI18n()
  const last = position.lastDay
  const count = position.pendingOrders.length
  const net = last?.netAtomic
  const toOrders = () => document.getElementById('quant-orders')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  return <div className={styles.strip}>
    <div className={styles.cell}><small>{c.position.principal}</small><b className={styles.num}>{usdtNumber(position.principalAtomic, locale)}</b></div>
    <div className={styles.cell}>
      <small>{c.view.stripLatest}</small>
      <b className={`${styles.num} ${net && net.startsWith('-') ? styles.down : net && net !== '0' ? styles.up : ''}`}>{net === undefined ? '—' : signedUsdt(net, locale)}</b>
      <i>{last ? shortDate(last.tradeDate) : c.neverSettled}</i>
    </div>
    {count > 0
      ? <button type="button" className={styles.cell} onClick={toOrders}><small>{c.view.stripPending}</small><b className={styles.num}>{pendingCount(count)}</b></button>
      : <div className={styles.cell}><small>{c.view.stripPending}</small><b className={styles.num}>0</b></div>}
  </div>
}

function orderStatus(c: QuantCopy, status: string) {
  return status === 'pending' ? c.view.orderStatus.pending : status === 'accepted' ? c.view.orderStatus.accepted : c.view.orderStatus.unknown
}

/** My account: principal, what is waiting, cumulative figures, the orders in flight, and the two actions. */
export function QuantAccount({ product, onAdd, onRedeem, actions = true }: { product: QuantProduct; onAdd: () => void; onRedeem: () => void; actions?: boolean }) {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const position = product.position
  if (!position) return null
  const principal = BigInt(position.principalAtomic)
  const redeeming = position.pendingOrders.some((order) => order.kind === 'redemption')
  const canRedeem = principal > BigInt(0) && !redeeming
  const waiting = BigInt(position.waitingAtomic) > BigInt(0)
  return <section className={styles.block} aria-label={c.view.accountTitle}>
    <h2 className={styles.h2}>{c.view.accountTitle}</h2>
    {principal > BigInt(0)
      ? <><p className={styles.sub}>{c.position.principal}</p><p className={`${styles.big} ${styles.num}`}>{usdtNumber(position.principalAtomic, locale)}</p></>
      : <p className={styles.sub}>{c.view.exited}</p>}
    <ul className={styles.rows}>
      {waiting && <li><span>{c.position.waiting}</span><span className={styles.num}>{usdtNumber(position.waitingAtomic, locale)}</span></li>}
      <li><span>{c.view.accountNet}</span><span className={`${styles.num} ${position.totalNetAtomic.startsWith('-') ? styles.down : ''}`}>{signedUsdt(position.totalNetAtomic, locale)}</span></li>
      <li><span>{c.view.accountFees}</span><span className={styles.num}>{usdtNumber(position.totalFeesAtomic, locale)}</span></li>
      <li data-quiet=""><span>{c.view.accountPaid}</span><span className={styles.num}>{usdtNumber(position.totalPaidAtomic, locale)}</span></li>
    </ul>
    {position.pendingOrders.length > 0 && <div id="quant-orders">
      <p className={styles.sub} style={{ marginTop: 18 }}>{c.view.ordersTitle}</p>
      <ul className={styles.orders}>
        {position.pendingOrders.map((order) => <li key={order.id}>
          <b>{order.kind === 'subscription' ? c.position.orderSubscription : c.position.orderRedemption}</b>
          <span className={styles.num}>{order.amountAtomic === null ? c.view.orderAll : `${usdtNumber(order.amountAtomic, locale)} USDT`}</span>
          <small>{c.position.orderEffective(order.effectiveDate)}</small>
          <small>{orderStatus(c, order.status)}</small>
        </li>)}
      </ul>
    </div>}
    {actions && <>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} data-primary="" disabled={!product.open} onClick={onAdd}>{c.addMore}</button>
        <button type="button" className={styles.btn} disabled={!canRedeem} onClick={onRedeem}>{c.redeem}</button>
      </div>
      {!product.open && <p className={styles.note}>{c.closedNote}</p>}
      {!canRedeem && <p className={styles.note}>{redeeming ? c.view.redemptionPending : c.view.noPrincipal}</p>}
    </>}
    {!actions && <p className={styles.note}>{c.view.exitedNote}</p>}
  </section>
}

/** One row per settled day, newest first; a row opens that day's receipt. Shown to everyone who has ever held, even at zero principal. */
export function QuantHistory({ payouts, c }: { payouts: Query<QuantPayout[]>; c: QuantCopy }) {
  const { locale } = useI18n()
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  return <section className={styles.block} aria-label={c.view.historyTitle}>
    <h2 className={styles.h2}>{c.view.historyTitle}</h2>
    <p className={styles.sub}>{c.view.historyLimit}</p>
    <BlockState query={payouts} c={c} empty={c.position.emptyPayouts}>{(rows) => {
      const sorted = [...rows].sort((x, y) => y.tradeDate.localeCompare(x.tradeDate))
      if (sorted.length === 0) return <p className={styles.state}>{c.position.emptyPayouts}</p>
      const shown = all ? sorted : sorted.slice(0, 8)
      return <>
        <ul className={styles.hist}>
          {shown.map((row) => {
            const negative = row.netAtomic.startsWith('-')
            const expanded = open === row.tradeDate
            return <li key={row.tradeDate}>
              <button type="button" className={styles.histRow} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.tradeDate)}>
                <span>{row.tradeDate}<small>{negative ? c.position.reduced : c.position.credited}</small></span>
                <b className={`${styles.num} ${negative ? styles.down : styles.up}`}>{signedUsdt(row.netAtomic, locale)}</b>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              {expanded && <QuantReceipt payout={row} copy={c} locale={locale} />}
            </li>
          })}
        </ul>
        {sorted.length > 8 && <button type="button" className={styles.more} onClick={() => setAll((value) => !value)}>{all ? c.view.historyLess : c.view.historyMore}</button>}
      </>
    }}</BlockState>
  </section>
}
