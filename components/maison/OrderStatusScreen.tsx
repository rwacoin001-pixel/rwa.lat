'use client'

import { AlertTriangle, Check, Clock3, Copy, Download, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { POLL } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { getOrder, TERMINAL_ORDER_STATES, type Order } from '@/lib/api/markets'
import { fromAtomic } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import { MaisonPage, SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer, PollBar } from './motion'
import { fmtAtomic, fmtDateTime } from './format'
import { playMoment } from '@/lib/moment'

function tone(state: string) {
  return state === 'filled' ? 'up' : state === 'failed' || state === 'cancelled' ? 'down' : state === 'partially_filled' ? 'warn' : 'pending'
}

function released(order: Order) {
  return order.events.reduce<bigint>((sum, event) => sum + BigInt(event.metadata?.releasedAtomicAmount ?? '0'), BigInt(0)).toString()
}

function csvFor(order: Order) {
  const cell = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  const rows = [
    ['Field', 'Value'],
    ['Order ID', order.id], ['Product', order.productName], ['Asset class', order.assetClassId], ['Outcome', order.outcomeKey],
    ['Requested (USDT)', fromAtomic(order.requestedAtomicAmount, order.settlementAssetDecimals)], ['Filled (USDT)', fromAtomic(order.filledAtomicAmount, order.settlementAssetDecimals)],
    ['Filled quantity', fromAtomic(order.filledQuantityAtomicAmount, order.productAssetDecimals)], ['Unit price (quote currency)', fromAtomic(order.unitPriceAtomicAmount, order.quoteDecimals)],
    ['Released (USDT)', fromAtomic(released(order), order.settlementAssetDecimals)], ['State', order.state], ['Failure reason', String(order.failureReason ?? '')],
    ['Submitted at', order.submittedAt], ['Completed at', order.completedAt ?? ''], [],
    ['Time', 'From', 'To', 'Actor', 'Reason'],
    ...order.events.map((event) => [event.createdAt, event.previousState ?? '', event.nextState, event.actorType, String(event.reasonCode ?? '')]),
  ]
  return rows.map((row) => row.map(cell).join(',')).join('\n')
}

/** `/orders/status?id=` (live, polls until terminal) and `/orders/:id` (record) share one view. */
export function OrderStatusScreen({ orderId, variant }: { orderId: string | null; variant: 'status' | 'detail' }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const st = copy.status
  const [copied, setCopied] = useState(false)
  const [live, setLive] = useState(false)
  const result = useQuery(orderId ? `orders:detail:${orderId}` : null, () => getOrder(orderId!), { staleTime: 5_000, pollInterval: live ? POLL.pendingOrder : undefined })
  const order = result.data
  const momentNode = useRef<HTMLDivElement>(null)
  const momentPlayed = useRef<string | null>(null)
  const isLive = Boolean(order && !TERMINAL_ORDER_STATES.has(order.state))
  useEffect(() => { setLive(isLive) }, [isLive])
  useEffect(() => {
    if (!order || order.state !== 'filled' || momentPlayed.current === order.id) return
    momentPlayed.current = order.id
    const marker = `rwa:moment:order:${order.id}`
    try {
      if (window.sessionStorage.getItem(marker)) return
      window.sessionStorage.setItem(marker, '1')
    } catch { /* The visual feedback still works when browser storage is unavailable. */ }
    playMoment(momentNode.current, 'success')
  }, [order?.id, order?.state])
  const [beat, setBeat] = useState(0)
  useEffect(() => { if (result.data) setBeat((value) => value + 1) }, [result.data])
  const topbar = <RwaTopbar screen={variant === 'status' ? 'order-processing' : 'order-detail'} title={variant === 'status' ? st.title : st.detailTitle} onBack={() => backOr(variant === 'status' ? '/assets' : '/profile/documents')} />

  if (!orderId) return <MaisonPage page="order-status" topbar={topbar}><div className={s.hero}><StateBlock title={st.none} body={st.noneBody} action={<button type="button" className={s.link} onClick={() => openPath('/profile/documents')}>{st.records}</button>} /></div></MaisonPage>
  if (!order) return <MaisonPage page="order-status" topbar={topbar}><div className={s.hero}>
    {result.error ? <StateBlock tone="error" title={result.error.status === 404 ? st.none : copy.common.errorGeneric} body={result.error.message} retry={result.error.status === 404 ? undefined : result.refetch} retryLabel={copy.common.retry} /> : <Skeleton rows={4} />}
  </div></MaisonPage>

  const state = order.state
  const t = tone(state)
  const Mark = t === 'up' ? Check : t === 'down' ? X : t === 'warn' ? AlertTriangle : Clock3
  const releasedAtomic = released(order)
  const copyId = () => { void navigator.clipboard?.writeText(order.id).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600) }) }
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([csvFor(order)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `order-${order.id}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <MaisonPage page="order-status" topbar={topbar}>
    <div ref={momentNode} className={s.momentSurface}>
    <Lacquer style={{ marginTop: 18 }} aria-live="polite">
      <div className={s.statusMark} data-tone={t}><Mark size={26} strokeWidth={1.6} /></div>
      <span className={s.kicker}>{st.states[state] ?? state}</span>
      <h1 className={s.titleL} style={{ marginTop: 10 }}>{st.headline[state] ?? state}</h1>
      <p className={s.muted} style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55 }}>{st.body[state] ?? ''}</p>
      {isLive && <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8 }}><span className={s.liveDot} aria-hidden="true" />{fill(st.live, { s: POLL.pendingOrder / 1000 })}</p>}
      {isLive && <div style={{ marginTop: 8 }}><PollBar every={POLL.pendingOrder} stamp={beat} /></div>}
      {result.error && order && <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--m-lacquer-accent)' }} role="alert">{copy.common.errorGeneric} · <button type="button" className={s.link} style={{ color: 'inherit' }} onClick={result.refetch}>{copy.common.retry}</button></p>}
      <dl className={s.summary} style={{ marginTop: 18 }}>
        <div><dt>{st.product}</dt><dd>{order.productName}</dd></div>
        <div data-strong="true"><dt>{st.requested}</dt><dd className={s.num}>{fmtAtomic(order.requestedAtomicAmount, order.settlementAssetDecimals, 'USDT')}</dd></div>
        {TERMINAL_ORDER_STATES.has(state) && <div><dt>{st.filled}</dt><dd className={s.num}>{fmtAtomic(order.filledAtomicAmount, order.settlementAssetDecimals, 'USDT')}</dd></div>}
        {TERMINAL_ORDER_STATES.has(state) && <div><dt>{st.quantity}</dt><dd className={s.num}>{fmtAtomic(order.filledQuantityAtomicAmount, order.productAssetDecimals, '', 6).trim()}</dd></div>}
        {releasedAtomic !== '0' && <div><dt>{st.released}</dt><dd className={s.num}>{fmtAtomic(releasedAtomic, order.settlementAssetDecimals, 'USDT')}</dd></div>}
        {order.outcomeKey !== 'long' && <div><dt>{copy.review.outcome}</dt><dd>{order.outcomeKey === 'yes' ? copy.review.yes : copy.review.no}</dd></div>}
        {order.failureReason != null && <div><dt>{st.reason}</dt><dd>{String(order.failureReason)}</dd></div>}
      </dl>
    </Lacquer>
    </div>

    <div className={s.actions}>
      {state === 'filled' || state === 'partially_filled'
        ? <button type="button" className={s.cta} onClick={() => openPath('/assets')}><span>{st.viewAssets}</span><span className={s.ctaIcon}><Check size={17} /></span></button>
        : <button type="button" className={s.cta} onClick={() => openPath(state === 'failed' || state === 'cancelled' ? '/markets' : '/assets')}><span>{state === 'failed' || state === 'cancelled' ? st.backMarkets : st.viewAssets}</span><span className={s.ctaIcon}><Check size={17} /></span></button>}
      <div className={s.actions2}>
        {variant === 'status'
          ? <button type="button" className={s.ghost} onClick={() => openPath(`/orders/${encodeURIComponent(order.id)}`)}>{st.viewDetail}</button>
          : <button type="button" className={s.ghost} onClick={exportCsv}><Download size={15} />{st.export}</button>}
        <button type="button" className={s.ghost} onClick={() => openPath('/profile/documents')}>{st.records}</button>
      </div>
    </div>

    <SectionHead index="01" title={st.timeline} />
    <ol className={s.timeline}>{order.events.map((event, index) => <li key={`${event.createdAt}-${index}`} data-tone={event.nextState === 'filled' ? 'up' : event.nextState === 'failed' || event.nextState === 'cancelled' ? 'down' : undefined}>
      <i aria-hidden="true" />
      <span><b>{st.states[event.nextState] ?? event.nextState}</b><small>{fmtDateTime(event.createdAt, locale)} · {st.actors[event.actorType] ?? event.actorType}{event.metadata?.atomicAmount ? ` · ${fmtAtomic(event.metadata.atomicAmount, order.settlementAssetDecimals, 'USDT')}` : ''}{event.metadata?.releasedAtomicAmount ? ` · ${st.released} ${fmtAtomic(event.metadata.releasedAtomicAmount, order.settlementAssetDecimals, 'USDT')}` : ''}</small></span>
    </li>)}</ol>

    <dl className={s.summary} style={{ marginTop: 6 }}>
      <div><dt>{st.orderId}</dt><dd><button type="button" className={s.link} onClick={copyId}><span className={s.num}>{order.id.slice(0, 8)}…{order.id.slice(-4)}</span>{copied ? <Check size={13} /> : <Copy size={13} />}</button></dd></div>
      <div><dt>{st.unitPrice}</dt><dd className={s.num}>{fmtAtomic(order.unitPriceAtomicAmount, order.quoteDecimals, '', 6).trim()}</dd></div>
      <div><dt>{st.submitted}</dt><dd>{fmtDateTime(order.submittedAt, locale)}</dd></div>
      <div><dt>{st.completed}</dt><dd>{fmtDateTime(order.completedAt, locale)}</dd></div>
    </dl>
  </MaisonPage>
}
