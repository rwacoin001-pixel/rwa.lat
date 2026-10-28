'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Sheet } from './Sheet'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { acknowledgeDisclosure, getWallet } from '@/lib/api/markets'
import { idempotencyKeyForIntent, isFinalRejection, retireIntentKey } from '@/lib/api/idempotency'
import { getQuantDisclosure, getQuantRedemptionPreview, getQuantSubscriptionPreview, redeemQuant, subscribeQuant, type QuantProduct } from '@/lib/api/quant'
import { quantCopyFor, quantErrorMessage } from '@/lib/maison-quant-copy'
import { subscriptionTimeline } from '@/lib/quant-view-model'
import { toAtomic } from '@/lib/money'
import { maison as s } from './primitives'
import { useHideDock, usdtNumber } from './QuantParts'
import styles from './quant.module.css'

const DECIMAL = /^\d{1,30}(\.\d{1,6})?$/
const refreshAll = () => invalidate(['quant:', 'wallet:', 'portfolio:', 'home:'])

/** Amount in USDT text → atomic bigint, or null when the text is not a plain amount of up to 6 places. */
function atomicOf(text: string): bigint | null {
  if (!DECIMAL.test(text)) return null
  const atomic = toAtomic(text, 6)
  return atomic === null ? null : BigInt(atomic)
}

function Timeline({ steps }: { steps: Array<{ title: string; date?: string; body: string; done?: boolean }> }) {
  return <ol className={styles.timeline}>
    {steps.map((step) => <li key={step.title} data-done={step.done || undefined}>
      <span className={styles.rail}><i /></span>
      <div className={styles.step}><b>{step.title}{step.date && <span>{step.date}</span>}</b><small>{step.body}</small></div>
    </li>)}
  </ol>
}

export function QuantSubscribeSheet({ open, onClose, product }: { open: boolean; onClose: () => void; product: QuantProduct }) {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const [amount, setAmount] = useState('')
  const [ack, setAck] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneDate, setDoneDate] = useState<string | null>(null)
  // Steps (2026-10-28): amount → review → receipt; an error shows after leaving the field or tapping Next, with one shake.
  const [step, setStep] = useState<'amount' | 'review'>('amount')
  const [touched, setTouched] = useState(false)
  const [shake, setShake] = useState(0)
  const keys = useRef(new Map<string, string>())
  const wallet = useQuery(open ? 'wallet:summary:quant' : null, getWallet, { staleTime: 15_000 })
  const preview = useQuery(open ? `quant:preview:${product.slug}` : null, () => getQuantSubscriptionPreview(product.slug), { staleTime: 20_000 })
  const disclosure = useQuery(open && product.disclosureId ? 'quant:disclosure' : null, getQuantDisclosure, { staleTime: 5 * 60_000 })
  useHideDock(open)
  useEffect(() => { if (!open) { setAmount(''); setAck(false); setError(null); setDoneDate(null); setPending(false); setStep('amount'); setTouched(false) } }, [open])

  const available = wallet.data?.balances.availableAtomic ?? null
  const value = atomicOf(amount.trim())
  const min = BigInt(product.minSubscriptionAtomic)
  const problem = useMemo(() => {
    if (!amount.trim()) return null
    if (value === null || value <= BigInt(0)) return c.sheet.errors.QUANT_AMOUNT_INVALID
    if (value < min) return c.sheet.min(usdtNumber(product.minSubscriptionAtomic, locale))
    if (available !== null && value > BigInt(available)) return c.sheet.errors.QUANT_INSUFFICIENT_BALANCE
    return null
  }, [amount, available, c, locale, min, product.minSubscriptionAtomic, value])
  const needsAck = Boolean(product.disclosureId)
  const ready = value !== null && !problem && (!needsAck || (ack && Boolean(disclosure.data))) && !pending && Boolean(preview.data) && available !== null

  const submit = async () => {
    if (!ready || value === null) return
    setPending(true)
    setError(null)
    if (product.disclosureId && disclosure.data) {
      const acked = await acknowledgeDisclosure(disclosure.data.id)
      if (!acked.ok) { setPending(false); setError(quantErrorMessage(c, acked.error.code)); return }
    }
    const path = `/v1/quant/products/${product.slug}/subscriptions`
    const text = amount.trim()
    // Same amount → same key: a retry after a timeout returns the original order instead of a second one.
    const key = idempotencyKeyForIntent(keys.current, 'POST', path, { amountUsd: text })
    const result = await subscribeQuant(product.slug, text, key)
    setPending(false)
    if (!result.ok) {
      // A refused order is stored as `rejected` under its key; the next tap must be a new order, not a replay of that one.
      if (isFinalRejection(result.error)) retireIntentKey(keys.current, 'POST', path, { amountUsd: text })
      setError(quantErrorMessage(c, result.error.code)); return
    }
    if (result.data.order.status === 'rejected') {
      // A replayed key returns the earlier refusal as a "duplicate": never show it as a successful subscription.
      retireIntentKey(keys.current, 'POST', path, { amountUsd: text })
      refreshAll()
      setError(quantErrorMessage(c, 'QUANT_INSUFFICIENT_BALANCE')); return
    }
    refreshAll()
    retireIntentKey(keys.current, 'POST', path, { amountUsd: text }) // a confirmed order is done; other unresolved retries keep their keys
    setDoneDate(result.data.order.effectiveDate)
  }

  const p = preview.data
  const steps = p ? subscriptionTimeline(p) : []
  const stepCopy = [
    { title: c.sheet.stepSubmit, body: c.sheet.stepSubmitBody(product.cutoffTime, product.timezone) },
    { title: c.sheet.stepStart, body: c.sheet.stepStartBody },
    { title: c.sheet.stepSettle, body: c.sheet.stepSettleBody },
  ]

  const next = () => {
    setTouched(true)
    if (!amount.trim() || value === null || problem) { setShake((n) => n + 1); navigator.vibrate?.(14); return }
    setStep('review')
  }
  const shown = touched ? problem ?? (amount.trim() ? null : c.sheet.errors.QUANT_AMOUNT_INVALID) : null
  const amountText = value !== null && !problem ? usdtNumber(value.toString(), locale) : '—'

  return <Sheet open={open} onClose={onClose} busy={pending} kicker={c.kicker} title={doneDate ? c.sheet.done : c.sheet.subscribeTitle}>
    <AutoHeight>
    {doneDate
      ? <div className={styles.stepPane} key="done">
        <span className={styles.doneMark} aria-hidden="true"><Check size={28} strokeWidth={2.4} /></span>
        <p className={s.lede}>{c.sheet.doneSubscribe(doneDate)}</p>
        <button type="button" className={s.cta} style={{ marginTop: 16 }} onClick={onClose}><span>{c.sheet.close}</span></button>
      </div>
      : step === 'amount' ? <div className={styles.stepPane} key="amount">
        <label key={shake} className={styles.amountBox} data-shake={shake > 0 && shown ? '' : undefined}>
          <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} aria-label={c.sheet.amount} aria-invalid={Boolean(shown) || undefined}
            onBlur={() => { if (amount.trim()) setTouched(true) }}
            onChange={(event) => { setAmount(event.target.value.replace(/[^0-9.]/g, '')); setError(null) }} />
          <span>USDT</span>
        </label>
        <p className={`${s.muted} ${s.num}`} style={{ margin: '8px 2px 0', fontSize: 12 }}>
          {c.sheet.available} {available === null ? '—' : usdtNumber(available, locale)} · {c.sheet.min(usdtNumber(product.minSubscriptionAtomic, locale))}
        </p>
        <div className={styles.chips} aria-label={c.sheet.quick}>
          {[100, 500, 1000].map((quick) => <button key={quick} type="button" onClick={() => { setAmount(String(quick)); setError(null) }}>{quick.toLocaleString(locale)}</button>)}
        </div>
        {shown && <p className={styles.err} role="alert">{shown}</p>}
        <button type="button" className={s.cta} style={{ marginTop: 20 }} disabled={available === null || !preview.data} onClick={next}>
          <span>{c.sheet.next}</span>
        </button>
      </div>
      : <div className={styles.stepPane} key="review">
        <dl className={styles.review}>
          <div><dt>{c.sheet.amount}</dt><dd>{amountText} USDT</dd></div>
          <div><dt>{c.sheet.feeLine}</dt><dd>{c.sheet.feeValue((product.fees.managementBps / 100).toFixed(2), (product.fees.performanceBps / 100).toFixed(0))}</dd></div>
        </dl>
        <p className={s.kicker} style={{ marginTop: 16 }}>{c.sheet.timelineTitle}</p>
        {p
          ? <Timeline steps={steps.map((item, index) => ({ ...stepCopy[index], date: item.date, done: index === 0 }))} />
          : <p className={s.muted} style={{ fontSize: 12 }}>…</p>}
        {p?.afterCutoff && <p className={s.muted} style={{ margin: '-4px 0 0', fontSize: 12 }}>{c.sheet.afterCutoff}</p>}
        <div className={s.notice}><span>{c.riskLine}</span></div>
        {needsAck && disclosure.error && !disclosure.data && <p className={styles.err} role="alert">{c.loadError} <button type="button" className={s.link} onClick={() => void disclosure.refetch()}>{c.retry}</button></p>}
        {needsAck && <label className={styles.ack}><input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} /><span>{c.sheet.ack}{disclosure.data ? ` · v${disclosure.data.version}` : ''}</span></label>}
        {error && <p className={styles.err} role="alert">{error}</p>}
        <div className={styles.reviewActs}>
          <button type="button" className={s.ghost} disabled={pending} onClick={() => setStep('amount')}>{c.sheet.back}</button>
          {/* The confirm key folds into a ring while the server works; the receipt replaces the sheet only once it confirms. */}
          <button type="button" className={`${s.cta} ${styles.confirm}`} data-busy={pending || undefined} disabled={!ready} aria-busy={pending} onClick={() => void submit()}>
            {pending ? <i className={styles.ring} aria-hidden="true" /> : <span>{c.sheet.confirmSubscribe(amountText)}</span>}
          </button>
        </div>
      </div>}
    </AutoHeight>
  </Sheet>
}

/** Animates its own height to its content (step changes), so the sheet grows and shrinks smoothly. */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  useEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setHeight(Math.ceil(entry.contentRect.height)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <div className={styles.autoHeight} style={{ height }}><div ref={inner}>{children}</div></div>
}

export function QuantRedeemSheet({ open, onClose, product }: { open: boolean; onClose: () => void; product: QuantProduct }) {
  const { locale } = useI18n()
  const c = quantCopyFor(locale)
  const [amount, setAmount] = useState('')
  const [all, setAll] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const keys = useRef(new Map<string, string>())
  useHideDock(open)
  useEffect(() => { if (!open) { setAmount(''); setAll(true); setError(null); setDone(false); setPending(false) } }, [open])

  const text = amount.trim()
  const key = open ? `quant:redeem-preview:${product.slug}:${all ? 'all' : text}` : null
  const preview = useQuery(key && (all || atomicOf(text) !== null) ? key : null, () => getQuantRedemptionPreview(product.slug, all ? { all: true } : { amountUsd: text }), { staleTime: 10_000 })
  const p = preview.data
  const redeemable = p ? BigInt(p.redeemableAtomic) : null
  const wanted = all ? null : atomicOf(text)
  const min = BigInt(product.minRedemptionAtomic)
  const problem = !all && text
    ? wanted === null || wanted <= BigInt(0) ? c.sheet.errors.QUANT_AMOUNT_INVALID
      : wanted < min ? c.sheet.min(usdtNumber(product.minRedemptionAtomic, locale))
      : redeemable !== null && wanted > redeemable ? c.sheet.errors.QUANT_AMOUNT_INVALID : null
    : null
  const ready = Boolean(p) && redeemable !== null && redeemable > BigInt(0) && (all || (wanted !== null && !problem)) && !pending

  const submit = async () => {
    if (!ready) return
    setPending(true)
    setError(null)
    const body = all ? { all: true } : { amountUsd: text }
    const path = `/v1/quant/products/${product.slug}/redemptions`
    const idem = idempotencyKeyForIntent(keys.current, 'POST', path, body)
    const result = await redeemQuant(product.slug, body, idem)
    setPending(false)
    if (!result.ok) {
      if (isFinalRejection(result.error)) retireIntentKey(keys.current, 'POST', path, body)
      setError(quantErrorMessage(c, result.error.code)); return
    }
    refreshAll()
    retireIntentKey(keys.current, 'POST', path, body)
    setDone(true)
  }

  return <Sheet open={open} onClose={onClose} busy={pending} kicker={c.kicker} title={done ? c.sheet.done : c.sheet.redeemTitle}>
    {done
      ? <>
        <p className={s.lede}>{c.sheet.doneRedeem}</p>
        <button type="button" className={s.cta} style={{ marginTop: 16 }} onClick={onClose}><span>{c.sheet.close}</span></button>
      </>
      : <>
        <p className={`${s.muted} ${s.num}`} style={{ margin: '4px 2px 0', fontSize: 12 }}>
          {c.sheet.redeemable} {p ? usdtNumber(p.redeemableAtomic, locale) : '—'} USDT
          {p && BigInt(p.waitingAtomic) > BigInt(0) ? ` · ${c.sheet.waitingLocked}: ${usdtNumber(p.waitingAtomic, locale)}` : ''}
        </p>
        <div className={styles.chips}>
          <button type="button" aria-pressed={all} style={all ? { boxShadow: 'inset 0 0 0 1.5px var(--m-accent)' } : undefined} onClick={() => { setAll(true); setError(null) }}>{c.sheet.redeemAll}</button>
          <button type="button" aria-pressed={!all} style={!all ? { boxShadow: 'inset 0 0 0 1.5px var(--m-accent)' } : undefined} onClick={() => { setAll(false); setError(null) }}>{c.sheet.amount}</button>
        </div>
        {!all && <label className={styles.amountBox}>
          <input inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} aria-label={c.sheet.amount} aria-invalid={Boolean(problem) || undefined}
            onChange={(event) => { setAmount(event.target.value.replace(/[^0-9.]/g, '')); setError(null) }} />
          <span>USDT</span>
        </label>}
        {problem && <p className={styles.err} role="alert">{problem}</p>}

        <p className={s.kicker} style={{ marginTop: 20 }}>{c.sheet.estimateTitle}</p>
        <ul className={styles.lines}>
          <li><span>{c.sheet.estimateFee}</span><span>{p ? usdtNumber(p.feeAtomic, locale) : '—'} USDT</span></li>
          <li><span>{c.sheet.estimatePayout}</span><span><b>{p ? usdtNumber(p.payoutAtomic, locale) : '—'}</b> USDT</span></li>
        </ul>
        <p className={s.muted} style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5 }}>{c.sheet.estimateNote}</p>
        <Timeline steps={[
          { title: c.sheet.redeemSteps.submit, body: '', done: true },
          { title: c.sheet.redeemSteps.settle, date: p?.tradeDate, body: '' },
          { title: c.sheet.redeemSteps.arrive, body: '' },
        ]} />
        {error && <p className={styles.err} role="alert">{error}</p>}
        <button type="button" className={s.cta} style={{ marginTop: 8 }} disabled={!ready} onClick={() => void submit()}><span>{c.sheet.confirmRedeem}</span></button>
      </>}
  </Sheet>
}

