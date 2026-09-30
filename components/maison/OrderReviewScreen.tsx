'use client'

import { AlertTriangle, ArrowRight, RotateCw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { createOrder, estimateQuantity, getQuote, getWallet, isListed, listProducts, type CreateOrderBody } from '@/lib/api/markets'
import { fromAtomic, toAtomic, USDT_DECIMALS } from '@/lib/money'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { backOr, openPath, queryParam } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import { Lacquer } from './motion'
import { fmtAtomic, fmtDuration } from './format'

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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const keys = useRef(new Map<string, string>())
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const dialog = confirmDialog.current
    if (!dialog) return
    if (confirmOpen && !dialog.open) dialog.showModal()
    else if (!confirmOpen && dialog.open) dialog.close()
  }, [confirmOpen])

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
  const quoteWindow = quote.data ? Math.max(1, (Date.parse(quote.data.validUntil) - Date.parse(quote.data.capturedAt)) / 1000) : 1
  const quoteExpired = !quote.data || quote.data.stale || secondsLeft <= 0
  const quantity = atomic && quote.data && !fieldError
    ? estimateQuantity(atomic, quote.data.unitPriceAtomicAmount, decimals, quote.data.unitPriceDecimals, USDT_DECIMALS)
    : null
  const after = atomic && available !== null && !fieldError && walletIsUsdt ? (BigInt(available) - BigInt(atomic)).toString() : null
  const ready = Boolean(product && atomic && !fieldError && risk && !quoteExpired && (!isPrediction || outcome) && !pending)

  const requestConfirmation = () => {
    setTouched(true)
    if (!product || !atomic || fieldError || pending) return
    if (isPrediction && !outcome) { setServerError(r.errors.outcome); return }
    if (!risk) { setServerError(r.errors.risk); return }
    setConfirmOpen(true)
  }

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

  const chips = [product.minOrderAtomicAmount, '1000000000', '5000000000'].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index && (!product.minOrderAtomicAmount || BigInt(value!) >= BigInt(product.minOrderAtomicAmount)))

  return <MaisonPage page="order-review" topbar={topbar} cta>
    <header className={s.hero}>
      <p className={s.kicker}>{r.kicker}</p>
      <h1 className={s.titleL}>{product.displayName}</h1>
    </header>

    <label className={s.kicker} htmlFor="order-amount" style={{ marginTop: 4 }}>{r.amount}</label>
    <div className={s.amount}>
      <input id="order-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} aria-invalid={Boolean(fieldError)} aria-describedby="order-amount-meta"
        onChange={(event) => { setAmount(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); setServerError(null) }} onBlur={() => setTouched(true)} />
      <span>{unit}</span>
    </div>
    <div className={s.fieldMeta} id="order-amount-meta">
      <span>{!wallet.data && !wallet.error ? '…' : wallet.error && !wallet.data ? <button type="button" className={s.link} onClick={wallet.refetch}>{copy.common.unavailable} · {copy.common.retry}</button> : fill(r.available, { v: fmtAtomic(available, walletDecimals, wallet.data?.asset.code ?? unit) })}</span>
      <span className={s.num}>{fmtAtomic(product.minOrderAtomicAmount, USDT_DECIMALS, unit, 0)} – {fmtAtomic(product.maxOrderAtomicAmount, USDT_DECIMALS, unit, 0)}</span>
    </div>
    <p className={s.muted} style={{ margin: '7px 2px 0', fontSize: 12 }}>{r.amountNote}</p>
    {(touched || amount.length > 0) && fieldError && <p className={s.fieldError} role="alert">{fieldError}</p>}
    <div className={s.chips}>
      {chips.map((value) => { const label = fromAtomic(value, USDT_DECIMALS); return <button key={value} type="button" className={s.chip} aria-pressed={amount === label} onClick={() => { setAmount(label); setServerError(null) }}><span className={s.num}>{Number(label).toLocaleString(locale)}</span></button> })}
      {available && walletIsUsdt && BigInt(available) > BigInt(0) && <button type="button" className={s.chip} aria-pressed={amount === fromAtomic(available, USDT_DECIMALS)} onClick={() => setAmount(fromAtomic(available, USDT_DECIMALS))}>MAX</button>}
    </div>

    {isPrediction && <>
      <p className={s.kicker} style={{ marginTop: 24 }}>{r.outcome}</p>
      <div className={s.outcome}>
        <button type="button" data-side="yes" aria-pressed={outcome === 'yes'} onClick={() => setOutcome('yes')}>{r.yes}</button>
        <button type="button" data-side="no" aria-pressed={outcome === 'no'} onClick={() => setOutcome('no')}>{r.no}</button>
      </div>
    </>}

    <Lacquer style={{ marginTop: 26 }} aria-live="polite">
      <dl className={s.summary}>
        <div><dt>{r.unitPrice}</dt><dd className={s.num}>{quote.data ? fmtAtomic(quote.data.unitPriceAtomicAmount, quote.data.unitPriceDecimals, quote.data.currency, 6) : '—'}</dd></div>
        <div><dt>{r.estQty}</dt><dd className={s.num}>{quantity ? fmtAtomic(quantity, decimals, '', 6).trim() : '—'}</dd></div>
        <div data-strong="true"><dt>{r.locked}</dt><dd className={s.num}>{atomic && !fieldError ? fmtAtomic(atomic, USDT_DECIMALS, settlementUnit) : '—'}</dd></div>
        <div><dt>{r.after}</dt><dd className={s.num}>{after ? fmtAtomic(after, USDT_DECIMALS, settlementUnit) : '—'}</dd></div>
      </dl>
      {!quote.data && !quote.error ? <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 12 }}>…</p>
        : quote.error && !quote.data ? <p className={s.muted} style={{ margin: '12px 0 0', fontSize: 12 }}>{copy.detail.quoteUnavailable} · <button type="button" className={s.link} onClick={quote.refetch}>{copy.common.retry}</button></p>
        : <div className={s.countdown}>
          <span className={s.num} style={{ color: quoteExpired ? 'var(--m-lacquer-accent)' : undefined }}>{quoteExpired ? r.expired : <>{r.refreshIn.split('{s}')[0]}<bdi>{fmtDuration(secondsLeft)}</bdi>{r.refreshIn.split('{s}')[1]}</>}</span>
          <i style={{ ['--left' as string]: quoteExpired ? 0 : Math.min(1, secondsLeft / quoteWindow) }} />
          <button type="button" className={s.link} style={{ color: 'var(--m-lacquer-accent)' }} onClick={() => void quote.refetch()} disabled={quote.loading}><RotateCw size={13} />{r.refresh}</button>
        </div>}
    </Lacquer>
    <button type="button" className={s.link} style={{ marginTop: 10 }} onClick={() => openPath('/fees-and-limits')}>{r.fees}<ArrowRight size={13} /></button>

    <label className={s.consent}>
      <input type="checkbox" checked={risk} onChange={(event) => { setRisk(event.target.checked); setServerError(null) }} />
      <span>{r.risk}</span>
    </label>
    {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}

    <div className={s.stickyCta}>
      <p>{r.eligibility}</p>
      <button type="button" className={s.cta} onClick={requestConfirmation} disabled={!ready} aria-busy={pending}>
        <span>{pending ? r.submitting : r.confirm}</span>
        <span className={s.ctaIcon}><ArrowRight size={17} /></span>
      </button>
    </div>

    <dialog ref={confirmDialog} className={s.orderConfirm} aria-labelledby="order-confirm-title" onCancel={(event) => { event.preventDefault(); setConfirmOpen(false) }}>
      <section className={s.orderConfirmCard}>
        <button type="button" className={s.orderConfirmClose} aria-label={copy.common.close} onClick={() => setConfirmOpen(false)}><X size={18} /></button>
        <p className={s.kicker}>{r.title}</p>
        <h2 id="order-confirm-title" className={s.titleL}>{product?.displayName}</h2>
        <div className={s.orderConfirmAmount}>
          <span>{r.locked}</span>
          <b className={s.num}>{atomic ? fmtAtomic(atomic, USDT_DECIMALS, settlementUnit) : '—'}</b>
        </div>
        {isPrediction && outcome && <p className={s.muted}>{r.outcome}: {outcome === 'yes' ? r.yes : r.no}</p>}
        {serverError && <div className={s.notice} data-tone="error" role="alert"><AlertTriangle size={16} /><span>{serverError}</span></div>}
        <div className={s.orderConfirmActions}>
          <button type="button" className={s.ghost} onClick={() => setConfirmOpen(false)} disabled={pending}>{copy.common.back}</button>
          <button type="button" className={s.cta} onClick={() => void placeOrder()} disabled={!ready} aria-busy={pending}>
            <span>{pending ? r.submitting : r.confirm}</span>
            <span className={s.ctaIcon}><ArrowRight size={17} /></span>
          </button>
        </div>
      </section>
    </dialog>
  </MaisonPage>
}
