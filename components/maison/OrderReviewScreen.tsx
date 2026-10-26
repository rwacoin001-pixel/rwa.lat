'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { createOrder, estimateQuantity, getQuote, getWallet, isListed, listProducts, type CreateOrderBody } from '@/lib/api/markets'
import { toAtomic, USDT_DECIMALS } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { fmtAtomic, fmtDuration } from './format'
import { flowKitCopy } from '@/lib/flow-kit-copy'
import { AmountPad, FlowConfirm, share } from './flow-kit'

const ORDER_PATH = '/v1/orders'

export function OrderReviewScreen({ query }: { query: string }) {
  const { locale } = useI18n()
  const copy = marketCopy[locale]
  const r = copy.review
  const productId = queryParam(query, 'product')
  const products = useQuery('markets:catalog', listProducts, { staleTime: 60_000 })
  const product = products.data?.find((item) => item.id === productId && isListed(item))
  const quote = useQuery(product ? `markets:quote:${product.id}` : null, () => getQuote(product!.id), { staleTime: 15_000 })
  const wallet = useQuery('wallet:summary:order', getWallet, { staleTime: 15_000 })
  const [amount, setAmount] = useState(() => queryParam(query, 'amount') ?? '')
  const [outcome, setOutcome] = useState<'yes' | 'no' | null>(null)
  const [risk, setRisk] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())
  const kit = flowKitCopy(locale)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])

  const topbar = <RwaTopbar screen="order-review" title={r.title} onBack={() => backOr(product ? `/asset/${encodeURIComponent(product.externalRef ?? product.id)}` : '/markets')} />
  const decimals = product?.assetDecimals ?? 6
  const settlementUnit = 'USDT'
  const unit = quote.data?.currency ?? settlementUnit
  const isPrediction = product?.assetClassId === 'prediction'
  const atomic = amount ? toAtomic(amount, USDT_DECIMALS) : null
  const available = wallet.data?.balances.availableAtomic ?? null
  const walletDecimals = wallet.data?.asset.decimals ?? 6
  const walletIsUsdt = wallet.data?.asset.code === settlementUnit && walletDecimals === USDT_DECIMALS

  const fieldError = useMemo(() => {
    if (!product || !amount) return null
    if (!atomic || atomic === '0') return r.errors.format
    if (product.minOrderAtomicAmount && BigInt(atomic) < BigInt(product.minOrderAtomicAmount)) return fill(r.errors.min, { v: fmtAtomic(product.minOrderAtomicAmount, USDT_DECIMALS, unit) })
    if (product.maxOrderAtomicAmount && BigInt(atomic) > BigInt(product.maxOrderAtomicAmount)) return fill(r.errors.max, { v: fmtAtomic(product.maxOrderAtomicAmount, USDT_DECIMALS, unit, 0) })
    if (available !== null && walletIsUsdt && BigInt(atomic) > BigInt(available)) return r.errors.balance
    return null
  }, [amount, atomic, available, product, r.errors, unit, walletIsUsdt])

  const secondsLeft = quote.data ? Math.max(0, Math.floor((Date.parse(quote.data.validUntil) - now) / 1000)) : 0
  const quoteExpired = !quote.data || quote.data.stale || secondsLeft <= 0
  const quantity = atomic && quote.data && !fieldError
    ? estimateQuantity(atomic, quote.data.unitPriceAtomicAmount, decimals, quote.data.unitPriceDecimals, USDT_DECIMALS)
    : null
  const after = atomic && available !== null && !fieldError && walletIsUsdt ? (BigInt(available) - BigInt(atomic)).toString() : null


  const placeOrder = async () => {
    if (!product || !atomic || fieldError || pending || quoteExpired || (isPrediction && !outcome) || !risk) return
    const body: CreateOrderBody = { productId: product.id, atomicAmount: atomic, outcomeKey: isPrediction ? outcome! : 'long', riskAccepted: true }
    // Same body → same key, so a retry after a timeout cannot create a second order.
    const key = idempotencyKeyForIntent(keys.current, 'POST', ORDER_PATH, body)
    setPending(true)
    setServerError(null)
    const result = await createOrder(body, key)
    setPending(false)
    if (!result.ok) {
      const code = result.error.code
      setServerError(r.server[code] ?? result.error.message ?? copy.common.errorGeneric)
      if (code === 'QUOTE_STALE') void quote.refetch()
      return
    }
    invalidate(['wallet:', 'portfolio:', 'orders:', 'home:'])
    openPath(`/orders/status?id=${encodeURIComponent(result.data.id)}`, { replace: true })
  }

  if (!productId) return <MaisonPage page="order-review" topbar={topbar}><div className={s.hero}><StateBlock title={r.errors.noProduct} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{copy.status.backMarkets}</button>} /></div></MaisonPage>
  if (!products.data && !products.error) return <MaisonPage page="order-review" topbar={topbar}><div className={s.hero}><Skeleton rows={4} /></div></MaisonPage>
  if (!product) return <MaisonPage page="order-review" topbar={topbar}><div className={s.hero}>
    {products.error ? <StateBlock tone="error" title={copy.common.errorGeneric} body={products.error.message} retry={products.refetch} retryLabel={copy.common.retry} />
      : <StateBlock title={copy.detail.notFound} body={r.errors.noProduct} action={<button type="button" className={s.link} onClick={() => openPath('/markets')}>{copy.status.backMarkets}</button>} />}
  </div></MaisonPage>

  // What can go in: the balance, capped by the product maximum.
  const cap = available && walletIsUsdt ? (product.maxOrderAtomicAmount && BigInt(product.maxOrderAtomicAmount) < BigInt(available) ? product.maxOrderAtomicAmount : available) : null
  const money = (value: string | null | undefined, digits?: number) => fmtAtomic(value, USDT_DECIMALS, settlementUnit, digits)
  const talk = !amount ? kit.enterAmount
    : fieldError === r.errors.balance ? kit.insufficient
    : fieldError ? fieldError
    : isPrediction && !outcome ? r.errors.outcome
    : !quote.data && !quote.error ? kit.checking
    : quoteExpired ? r.refresh
    : pending ? r.submitting
    : kit.buyN(money(atomic))
  const canReview = Boolean(atomic && !fieldError && (!isPrediction || outcome) && !pending && !quoteExpired)
  const refreshOnly = Boolean(atomic && !fieldError && (!isPrediction || outcome) && quoteExpired && (quote.data || quote.error))
  return <MaisonPage page="order-review" topbar={topbar}>
    <AmountPad value={amount} onChange={(next) => { setAmount(next); setServerError(null) }} decimals={2} unit={settlementUnit} disabled={pending}
      invalid={Boolean(fieldError)} error={serverError && !reviewOpen ? serverError : null}
      sub={!wallet.data && !wallet.error ? '…' : <>{kit.available(fmtAtomic(available, walletDecimals, wallet.data?.asset.code ?? unit))} · {product.maxOrderAtomicAmount ? <bdi dir="ltr">{fmtAtomic(product.minOrderAtomicAmount, USDT_DECIMALS, '', 0).trim()}–{fmtAtomic(product.maxOrderAtomicAmount, USDT_DECIMALS, '', 0).trim()}</bdi> : kit.belowMin(fmtAtomic(product.minOrderAtomicAmount, USDT_DECIMALS, '', 0).trim())}</>}
      side={[{ label: '25%', value: share(cap, 25, USDT_DECIMALS) }, { label: '50%', value: share(cap, 50, USDT_DECIMALS) }, { label: '75%', value: share(cap, 75, USDT_DECIMALS) }, { label: kit.max, value: share(cap, 100, USDT_DECIMALS) }]}
      header={<div className={s.orderHead}>
        <p className={s.kicker}>{r.kicker}</p>
        <h1 className={s.orderTitle}>{product.displayName}</h1>
        {isPrediction && <div className={s.outcome} style={{ marginTop: 12 }}>
          <button type="button" data-side="yes" aria-pressed={outcome === 'yes'} onClick={() => setOutcome('yes')}>{r.yes}</button>
          <button type="button" data-side="no" aria-pressed={outcome === 'no'} onClick={() => setOutcome('no')}>{r.no}</button>
        </div>}
      </div>}
      cta={{ label: talk, disabled: !canReview && !refreshOnly, busy: pending, onClick: () => {
        if (refreshOnly) { void quote.refetch(); return }
        setServerError(null); setRisk(false); setReviewOpen(true)
      } }} />
    <FlowConfirm open={reviewOpen} onClose={() => { if (!pending) setReviewOpen(false) }} busy={pending} title={kit.reviewBuy}
      amount={atomic ? fmtAtomic(atomic, USDT_DECIMALS, '').trim() : '0'} unit={settlementUnit}
      rows={[
        { label: r.kicker, value: product.displayName },
        ...(isPrediction && outcome ? [{ label: r.outcome, value: outcome === 'yes' ? r.yes : r.no }] : []),
        { label: r.unitPrice, value: quote.data ? fmtAtomic(quote.data.unitPriceAtomicAmount, quote.data.unitPriceDecimals, quote.data.currency, 6) : '—' },
        { label: r.estQty, value: quantity ? fmtAtomic(quantity, decimals, '', 6).trim() : '—' },
        { label: r.after, value: after ? money(after) : '—' },
        { label: r.locked, value: atomic ? money(atomic) : '—', strong: true },
      ]}
      note={<>{quoteExpired ? r.expired : <>{r.refreshIn.split('{s}')[0]}<bdi>{fmtDuration(secondsLeft)}</bdi>{r.refreshIn.split('{s}')[1]}</>} · {r.eligibility}</>}
      consent={{ label: r.risk, checked: risk, onChange: (checked) => { setRisk(checked); setServerError(null) } }}
      error={serverError} confirmLabel={quoteExpired ? r.refresh : kit.confirmBuy} onConfirm={() => { if (quoteExpired) { void quote.refetch(); return } void placeOrder() }} />
  </MaisonPage>
}
