'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getSessionToken } from '@/lib/api/_http'
import { getQuantProduct, listQuantPayouts, useQuantProducts, type QuantProduct } from '@/lib/api/quant'
import { quantCopyFor } from '@/lib/maison-quant-copy'
import { buildTicks, localToday, shortDate } from '@/lib/quant-view-model'
import { openPath } from '@/lib/maison-nav'
import { QuantLedger, QuantReceipt, QuantLegend, signedUsdt, usdtNumber } from './QuantParts'
import { QuantRedeemSheet, QuantSubscribeSheet } from './QuantSheets'
import styles from './quant.module.css'

/** Loads the product and the user's payouts for one slug. The query key carries the sign-in state so a session change refetches. */
export function useQuantProduct(slug: string | undefined) {
  const signedIn = Boolean(getSessionToken())
  const product = useQuery(slug ? `quant:product:${slug}:${signedIn ? 'in' : 'out'}` : null, () => getQuantProduct(slug as string), { staleTime: 30_000 })
  return product
}

/**
 * "My Koala Quant": principal, what has been paid out, and a ledger of my own daily payouts with the receipt of the day I pick.
 * Rendered on the Koala page and, for holders only, on the Assets page.
 */
export function QuantPositionPlate({ product, showLegend = false }: { product: QuantProduct; showLegend?: boolean }) {
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
  const lastSettled = useMemo(() => ticks.map((tick, index) => (tick.kind === 'gain' || tick.kind === 'loss' || tick.kind === 'flat' ? index : -1)).filter((index) => index >= 0).pop() ?? null, [ticks])
  const selected = picked ?? lastSettled
  const payout = selected !== null ? payouts.data?.find((row) => row.tradeDate === ticks[selected]?.date) : undefined
  if (!position) return null

  const principal = BigInt(position.principalAtomic)
  return <>
    <section className={styles.plate} aria-label={c.position.title}>
      <div className={styles.plateHead}><span className={styles.plateKicker}>{c.position.title}</span><span className={styles.plateMeta}>{product.performance.lastSettledDate ? `${c.settledTo} ${shortDate(product.performance.lastSettledDate)}` : c.neverSettled}</span></div>
      <div className={styles.metrics} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
        <div className={styles.metric}>{c.position.principal}<b style={{ fontSize: 24 }}>{usdtNumber(position.principalAtomic, locale)}</b></div>
        <div className={styles.metric} style={{ textAlign: 'end' }}>{c.position.paid}<b className={styles.up} style={{ fontSize: 24 }}>{signedUsdt(position.totalPaidAtomic, locale)}</b></div>
      </div>
      {principal > BigInt(0) && <div className={styles.slot}>
        <QuantLedger ticks={ticks} selected={selected} onSelect={setPicked} height={56} copy={c} label={c.ledgerTitle} />
      </div>}
      {BigInt(position.waitingAtomic) > BigInt(0) && <p className={styles.plateMeta} style={{ margin: '8px 0 0' }}>{c.position.waiting}: {usdtNumber(position.waitingAtomic, locale)} USDT</p>}
      {position.pendingOrders.length > 0 && <ul className={styles.pending} aria-label={c.position.pending}>
        {position.pendingOrders.map((order) => <li key={order.id}><span>{order.kind === 'subscription' ? c.position.orderSubscription : c.position.orderRedemption} · {c.position.orderEffective(order.effectiveDate)}</span><span>{c.position.pending}</span></li>)}
      </ul>}
      <div className={styles.plateActions}>
        <button type="button" className={styles.plateBtn} data-primary="" onClick={() => openPath('/assets/cash/withdraw')}>{c.position.toWithdraw}</button>
        {product.open && <button type="button" className={styles.plateBtn} onClick={() => setSubscribeOpen(true)}>{c.addMore}</button>}
        <button type="button" className={styles.plateBtn} disabled={principal <= BigInt(0)} onClick={() => setRedeemOpen(true)}>{c.redeem}</button>
      </div>
      <p className={styles.plateMeta} style={{ margin: '10px 0 0', lineHeight: 1.45 }}>{c.position.paidNote}</p>
    </section>
    {showLegend && principal > BigInt(0) && <QuantLegend copy={c} />}
    {payout ? <QuantReceipt payout={payout} copy={c} locale={locale} /> : principal > BigInt(0) && payouts.data && payouts.data.length === 0 ? <p className={styles.legend} style={{ marginTop: 10 }}>{c.position.emptyPayouts}</p> : null}
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
  return <div style={{ marginTop: 20 }}><QuantPositionPlate product={product.data} /></div>
}
