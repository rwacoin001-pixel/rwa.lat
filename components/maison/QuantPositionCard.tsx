'use client'

import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getSessionToken } from '@/lib/api/_http'
import { getQuantProduct, listQuantPayouts, useQuantProducts, type QuantProduct } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { buildTicks, localToday, shortDate } from '@/lib/quant-view-model'
import { openPath } from '@/lib/maison-nav'
import { Lacquer } from './motion'
import { maison as s } from './primitives'
import { QuantLedger, QuantReceipt, signedUsdt, usdtNumber } from './QuantParts'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import styles from './quant.module.css'
import v2 from './quant-v2.module.css'

/** Loads the product for one slug. The query key carries the sign-in state so a session change refetches. */
export function useQuantProduct(slug: string | undefined) {
  const signedIn = Boolean(getSessionToken())
  return useQuery(slug ? `quant:product:${slug}:${signedIn ? 'in' : 'out'}` : null, () => getQuantProduct(slug as string), { staleTime: 30_000 })
}

/**
 * "My Koala Quant": principal, what has been paid out, a ledger of my own daily payouts and the slip of the day I pick.
 * Rendered on the Koala page and, for holders only, on the Assets page.
 */
export function QuantPositionPlate({ product, showReceipt = true }: { product: QuantProduct; showReceipt?: boolean }) {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const position = product.position
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const payouts = useQuery(position && BigInt(position.principalAtomic) > BigInt(0) ? `quant:payouts:${product.slug}` : null, () => listQuantPayouts(product.slug, 60), { staleTime: 30_000 })
  const today = localToday(product.timezone)
  const ticks = useMemo(() => buildTicks(
    (payouts.data ?? []).map((row) => ({ date: row.tradeDate, value: BigInt(row.principalBeforeAtomic) > BigInt(0) ? (Number(row.netAtomic) / Number(row.principalBeforeAtomic)) * 100 : 0 })),
    { today, count: 14 },
  ), [payouts.data, today])
  const lastSettled = useMemo(() => ticks.map((tick, index) => (tick.value !== null ? index : -1)).filter((index) => index >= 0).pop() ?? null, [ticks])
  const selected = picked ?? lastSettled
  const payout = selected !== null ? payouts.data?.find((row) => row.tradeDate === ticks[selected]?.date) : undefined
  if (!position) return null

  const principal = BigInt(position.principalAtomic)
  return <>
    <Lacquer className={styles.card} aria-label={c.position.title}>
      <div className={styles.head}><span className={styles.kick}>{c.position.title}</span><span className={styles.meta}>{product.performance.lastSettledDate ? `${c.settledTo} ${shortDate(product.performance.lastSettledDate)}` : c.neverSettled}</span></div>
      <div className={styles.posNums}>
        <div>{c.position.principal}<b>{usdtNumber(position.principalAtomic, locale)}</b></div>
        <div>{c.position.paid}<b className={styles.up}>{signedUsdt(position.totalPaidAtomic, locale)}</b></div>
      </div>
      {principal > BigInt(0) && <div style={{ marginTop: 12 }}>
        <QuantLedger ticks={ticks} selected={selected} onSelect={setPicked} height={52} copy={c} label={c.ledgerTitle} />
        {ticks.length > 0 && <div className={styles.axis}><span>{shortDate(ticks[0].date)}</span><span>{shortDate(ticks[ticks.length - 1].date)}</span></div>}
      </div>}
      {BigInt(position.waitingAtomic) > BigInt(0) && <p className={styles.note2}>{c.position.waiting}: {usdtNumber(position.waitingAtomic, locale)} USDT</p>}
      {position.pendingOrders.length > 0 && <ul className={styles.pending} aria-label={c.position.pending}>
        {position.pendingOrders.map((order) => <li key={order.id}><span>{order.kind === 'subscription' ? c.position.orderSubscription : c.position.orderRedemption} · {c.position.orderEffective(order.effectiveDate)}</span><span>{c.position.pending}</span></li>)}
      </ul>}
      <div className={styles.actions}>
        <button type="button" data-primary="" onClick={() => openPath('/assets/cash/withdraw')}>{c.position.toWithdraw}</button>
        {product.open && <button type="button" onClick={() => setSubscribeOpen(true)}>{c.addMore}</button>}
        <button type="button" disabled={principal <= BigInt(0)} onClick={() => setRedeemOpen(true)}>{c.redeem}</button>
      </div>
      <p className={styles.note2}>{c.position.paidNote}</p>
    </Lacquer>
    {showReceipt && (payout ? <QuantReceipt payout={payout} copy={c} locale={locale} /> : principal > BigInt(0) && payouts.data && payouts.data.length === 0 ? <p className={s.muted} style={{ margin: '12px 2px 0', fontSize: 12 }}>{c.position.emptyPayouts}</p> : null)}
    <QuantSubscribeSheet open={subscribeOpen} onClose={() => setSubscribeOpen(false)} product={product} />
    <QuantRedeemSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} product={product} />
  </>
}

/** Assets page module: only for people who hold Koala Quant (or have an order waiting); everyone else sees the page unchanged. */
export function QuantAssetsCard() {
  const list = useQuantProducts()
  const slug = list.data?.[0]?.slug
  const product = useQuantProduct(slug)
  const position = product.data?.position
  if (!product.data || !position) return null
  const holds = BigInt(position.principalAtomic) > BigInt(0) || position.pendingOrders.length > 0
  if (!holds) return null
  return <QuantAssetsRow product={product.data} />
}

/** One paper card on Assets (2026-10-28, docs/design-system.md §7.6): name, principal, paid so far; it opens "My Koala Quant". */
function QuantAssetsRow({ product }: { product: QuantProduct }) {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const position = product.position!
  return <button type="button" className={v2.assetCard} onClick={() => openPath('/quant?tab=account')}>
    <span className={v2.assetHead}><b>{product.name}</b><ChevronRight size={18} aria-hidden="true" /></span>
    <span className={v2.assetNums}>
      <span><small>{c.position.principal}</small><b>{usdtNumber(position.principalAtomic, locale)}</b></span>
      <span><small>{c.position.paid}</small><b data-tone={BigInt(position.totalPaidAtomic) > BigInt(0) ? 'up' : undefined}>{signedUsdt(position.totalPaidAtomic, locale)}</b></span>
    </span>
    {position.pendingOrders.length > 0 && <small className={v2.assetNote}>{c.position.pending}</small>}
  </button>
}
