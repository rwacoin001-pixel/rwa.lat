'use client'

import { useState, type ReactNode } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import type { QuantPayout, QuantPosition, QuantProduct } from '@/lib/api/quant'
import { quantCopyFor, type QuantCopy } from '@/lib/maison-quant-copy'
import { pendingCount, shortDate } from '@/lib/quant-view-model'
import { QuantReceipt, signedUsdt, usdtNumber } from './QuantParts'
import { maison as s } from './primitives'
import styles from './quant-page.module.css'
import a from './quant-account.module.css'

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

/**
 * The account as a statement card: principal large, then net, fees and paid; the orders in flight; the two actions.
 * Shared with the visitor placeholder, which passes no position and shows dashes.
 */
export function AccountCard({ title, principal, sub, waiting, figures, orders, actions, note, empty }: {
  title: string; principal: string | null; sub?: string; waiting?: string | null
  figures: Array<{ label: string; value: string; tone?: 'up' | 'down' }>
  orders?: ReactNode; actions?: ReactNode; note?: string | null; empty?: string | null
}) {
  return <section className={`${s.lacquer} ${a.card}`} aria-label={title}>
    <header className={a.head}>
      <h2>{title}</h2>
      {sub && <span className={a.badge} data-tone={principal === null ? 'idle' : undefined}><i />{sub}</span>}
    </header>
    <div className={a.hero}>
      <small>{sub ?? ' '}</small>
      <b>{principal ?? '—'}{principal !== null && <em>USDT</em>}</b>
      {waiting && <p>{waiting}</p>}
      {empty && <p>{empty}</p>}
    </div>
    <dl className={a.strip}>
      {figures.map((figure) => <div key={figure.label}>
        <dt>{figure.label}</dt>
        <dd data-tone={figure.tone}>{figure.value}</dd>
      </div>)}
    </dl>
    {orders}
    {actions}
    {note && <p className={a.note}>{note}</p>}
  </section>
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
  const net = position.totalNetAtomic
  return <AccountCard
    title={c.view.accountTitle}
    principal={principal > BigInt(0) ? usdtNumber(position.principalAtomic, locale) : null}
    sub={c.position.principal}
    waiting={waiting ? `${c.position.waiting} ${usdtNumber(position.waitingAtomic, locale)} USDT` : null}
    empty={principal > BigInt(0) ? null : c.view.exited}
    figures={[
      { label: c.view.accountNet, value: signedUsdt(net, locale), tone: net.startsWith('-') ? 'down' : 'up' },
      { label: c.view.accountFees, value: usdtNumber(position.totalFeesAtomic, locale) },
      { label: c.view.accountPaid, value: usdtNumber(position.totalPaidAtomic, locale) },
    ]}
    orders={position.pendingOrders.length > 0 && <div id="quant-orders">
      <ul className={a.orders}>
        {position.pendingOrders.map((order) => <li key={order.id}>
          <b>{order.kind === 'subscription' ? c.position.orderSubscription : c.position.orderRedemption}</b>
          <span>{order.amountAtomic === null ? c.view.orderAll : `${usdtNumber(order.amountAtomic, locale)} USDT`}</span>
          <small>{c.position.orderEffective(order.effectiveDate)}</small>
          <small>{orderStatus(c, order.status)}</small>
        </li>)}
      </ul>
    </div>}
    actions={actions && <div className={a.actions}>
      <button type="button" className={s.cta} disabled={!product.open} onClick={onAdd}><span className={a.actionLabel}>{c.addMore}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span></button>
      <button type="button" className={s.ghost} disabled={!canRedeem} onClick={onRedeem}>{c.redeem}</button>
    </div>}
    note={actions ? (!product.open ? c.closedNote : !canRedeem ? (redeeming ? c.view.redemptionPending : c.view.noPrincipal) : null) : c.view.exitedNote}
  />
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
