'use client'

import { ArrowUpFromLine, Check, Info } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { invalidate, useQuery } from '@/lib/api/_query'
import { idempotencyKeyForIntent } from '@/lib/api/idempotency'
import { cancelRedemption, listRedemptions, REDEMPTION_CANCELLABLE, REDEMPTION_OPEN, requestRedemption, type Position, type Redemption } from '@/lib/api/portfolio'
import type { ApiError } from '@/lib/api/_http'
import { fromAtomic, toAtomic } from '@/lib/money'
import { assetToolsCopy } from '@/lib/maison-assets-tools-copy'
import { fill, marketCopy } from '@/lib/maison-market-copy'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { SectionHead, Skeleton, StateBlock, maison as s } from './primitives'
import { Sheet } from './Sheet'
import { useAutoAnimate } from './motion'
import { fmtAtomic, fmtDateTime } from './format'

const ZERO = BigInt(0)
const REDEEM_PATH = '/v1/portfolio/redemptions'
const pow10 = (decimals: number) => BigInt(`1${'0'.repeat(Math.max(0, decimals))}`)
const stateTone = (state: Redemption['state']) => state === 'completed' ? 'live' : state === 'failed' ? 'down' : state === 'canceled' ? undefined : state === 'executing' ? 'accent' : 'warn'
export const useRedemptions = () => useQuery('portfolio:redemptions', listRedemptions, { staleTime: 15_000 })

/**
 * Held vs. already requested for one product. Only `long` rows are redeemable (completion debits the long position);
 * the server does not reserve quantity at request time, so open requests are subtracted here to avoid over-asking.
 */
export function redeemableFor(positions: Position[], redemptions: Redemption[] | undefined, productId: string) {
  const held = positions.filter((row) => row.productId === productId && row.outcomeKey === 'long').reduce((sum, row) => sum + BigInt(row.quantityAtomicAmount), ZERO)
  const open = (redemptions ?? []).filter((item) => item.productId === productId && REDEMPTION_OPEN.has(item.state)).reduce((sum, item) => sum + BigInt(item.quantityAtomicAmount), ZERO)
  return { held, open, redeemable: held > open ? held - open : ZERO }
}

/** Redemption requests for one product, newest first, with a two-step cancel while requested/queued. */
/** `index` is accepted for existing callers but no longer drawn: numbered section heads read as a form, not a portfolio. */
export function RedemptionsSection({ productId, decimals }: { productId: string; decimals: number; index?: string }) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].redeem
  const common = marketCopy[locale].common
  const redemptions = useRedemptions()
  const rows = useMemo(() => (redemptions.data ?? []).filter((item) => item.productId === productId).sort((x, y) => Date.parse(y.requestedAt) - Date.parse(x.requestedAt)), [productId, redemptions.data])
  const [arming, setArming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [list] = useAutoAnimate<HTMLUListElement>({ duration: 220 })

  const cancel = async (item: Redemption) => {
    if (busy) return
    if (arming !== item.id) { setArming(item.id); return }
    setBusy(item.id)
    setErrors(({ [item.id]: _, ...rest }) => rest)
    const result = await cancelRedemption(item.id)
    setBusy(null)
    setArming(null)
    if (!result.ok) setErrors((current) => ({ ...current, [item.id]: t.errors[result.error.code] ?? (result.error.message || common.errorGeneric) }))
    invalidate(['portfolio:redemptions'])
  }

  return <>
    <SectionHead title={t.list} note={t.listNote} />
    {redemptions.error && !redemptions.data ? <StateBlock tone="error" title={common.errorGeneric} body={redemptions.error.message} retry={redemptions.refetch} retryLabel={common.retry} />
      : !redemptions.data ? <Skeleton rows={2} />
      : !rows.length ? <StateBlock title={t.empty} />
      : <ul className={s.list} ref={list}>{rows.map((item) => {
        const price = fmtAtomic(item.estimatedUnitPriceAtomicAmount, item.estimatedUnitPriceDecimals, '', 4).trim()
        return <li key={item.id}>
          <div className={s.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'default' }}>
            <span className={s.rowMain}>
              <b><span className={s.muted} style={{ fontWeight: 500 }}>{t.qty} </span><bdi className={s.num} dir="ltr">{fmtAtomic(item.quantityAtomicAmount, decimals, '', 4).trim()}</bdi></b>
              <small>{fill(t.requested, { t: fmtDateTime(item.requestedAt, locale) })}</small>
              <small><bdi dir="ltr">{fill(t.estAt, { v: `${price} ${item.currency}` })}</bdi></small>
            </span>
            <span className={s.rowFig}>
              <span className={s.badge} data-tone={stateTone(item.state)}>{t.states[item.state] ?? item.state}</span>
              {REDEMPTION_CANCELLABLE.has(item.state) && <small>
                <button type="button" className={s.link} style={arming === item.id ? { color: 'var(--m-down)' } : undefined} disabled={busy !== null} aria-busy={busy === item.id}
                  onClick={() => void cancel(item)} onBlur={() => { if (busy !== item.id) setArming((current) => current === item.id ? null : current) }}>
                  {busy === item.id ? t.cancelling : arming === item.id ? t.confirmCancel : t.cancel}
                </button>
              </small>}
            </span>
          </div>
          {errors[item.id] && <p className={s.fieldError} role="alert">{errors[item.id]}</p>}
        </li>
      })}</ul>}
  </>
}

/** Sheet that records a redemption request. The estimate uses the latest quote; the payout is priced at completion. */
export function RedeemSheet({ open, onClose, onDone, productId, name, positions, unitPriceAtomic, unitPriceDecimals, currency }: {
  open: boolean; onClose: () => void; onDone: (item: Redemption) => void
  productId: string; name: string; positions: Position[]; unitPriceAtomic: string | null; unitPriceDecimals: number; currency: string
}) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].redeem
  const common = marketCopy[locale].common
  const redemptions = useRedemptions()
  const long = positions.find((row) => row.productId === productId && row.outcomeKey === 'long')
  const decimals = long?.assetDecimals ?? 6
  const unit = long?.assetCode ?? ''
  const { held, open: requested, redeemable } = redeemableFor(positions, redemptions.data, productId)

  const [qty, setQty] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())
  const inflight = useRef(false)
  useEffect(() => { if (open) { setQty(''); setConsent(false); setServerError(null) } }, [open])

  const atomic = qty ? toAtomic(qty, decimals) : null
  const amount = atomic ? BigInt(atomic) : null
  const fieldError = !qty ? null : amount === null || amount <= ZERO ? fill(t.invalid, { n: String(decimals) }) : amount > redeemable ? t.over : null
  const price = unitPriceAtomic && /^\d+$/.test(unitPriceAtomic) && BigInt(unitPriceAtomic) > ZERO ? BigInt(unitPriceAtomic) : null
  const estimate = amount !== null && amount > ZERO && price !== null ? amount * price / pow10(decimals) : null
  const ready = Boolean(redemptions.data && amount !== null && amount > ZERO && !fieldError && consent && !pending)
  const setPart = (num: bigint, den: bigint) => { const part = redeemable * num / den; setQty(part > ZERO ? fromAtomic(part.toString(), decimals).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : ''); setServerError(null) }

  const submit = async () => {
    if (!ready || !atomic || inflight.current) return
    const body = { productId, quantityAtomicAmount: atomic }
    // Same intent → same requestId, so a retry after a dropped response cannot record a second request.
    const requestId = idempotencyKeyForIntent(keys.current, 'POST', REDEEM_PATH, body)
    inflight.current = true
    setPending(true)
    setServerError(null)
    const result = await requestRedemption({ ...body, requestId })
    inflight.current = false
    setPending(false)
    if (!result.ok) {
      setServerError(errorText(t.errors, result.error, common.errorGeneric))
      invalidate(['portfolio:redemptions'])
      return
    }
    keys.current.clear()
    invalidate(['portfolio:'])
    onDone(result.data)
  }

  return <Sheet open={open} onClose={onClose} busy={pending} data-redeem="" kicker={<>{t.kicker} · {name}</>} title={t.title}>
          {redemptions.error && !redemptions.data ? <StateBlock tone="error" title={common.errorGeneric} body={redemptions.error.message} retry={redemptions.refetch} retryLabel={common.retry} />
            : !redemptions.data ? <Skeleton rows={3} />
            : <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
              <dl className={s.summary} style={{ marginTop: 12 }}>
                <div><dt>{t.held}</dt><dd className={s.num} dir="ltr">{fmtAtomic(held.toString(), decimals, unit, 4)}</dd></div>
                <div><dt>{t.inRequests}</dt><dd className={s.num} dir="ltr">{fmtAtomic(requested.toString(), decimals, unit, 4)}</dd></div>
                <div data-strong="true"><dt>{t.redeemable}</dt><dd className={s.num} dir="ltr"><b>{fmtAtomic(redeemable.toString(), decimals, unit, 4)}</b></dd></div>
              </dl>
              {redeemable <= ZERO ? <div className={s.notice} data-tone="info"><Info size={16} /><span>{t.nothing}</span></div>
                : <>
                  <label className={s.kicker} htmlFor="redeem-quantity" style={{ marginTop: 20 }}>{t.qty}</label>
                  <div className={s.amount}>
                    <input id="redeem-quantity" value={qty} name="redeem-quantity" inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={Boolean(fieldError)} aria-describedby="redeem-error"
                      onChange={(event) => { setQty(event.target.value.replace(',', '.').replace(/[^\d.]/g, '')); setServerError(null) }} />
                    <span>{unit}</span>
                  </div>
                  <div className={s.chips} role="group" aria-label={t.qty} style={{ marginTop: 8 }}>
                    <button type="button" className={s.chip} style={{ minHeight: 44, minWidth: 64 }} onClick={() => setPart(BigInt(1), BigInt(4))}>25%</button>
                    <button type="button" className={s.chip} style={{ minHeight: 44, minWidth: 64 }} onClick={() => setPart(BigInt(1), BigInt(2))}>50%</button>
                    <button type="button" className={s.chip} style={{ minHeight: 44, minWidth: 64 }} onClick={() => setPart(BigInt(1), BigInt(1))}>{fundsCopy[locale].common.max}</button>
                  </div>
                  {fieldError && <p className={s.fieldError} id="redeem-error" role="alert">{fieldError}</p>}
                  <dl className={s.summary} style={{ marginTop: 12 }}>
                    <div><dt>{t.price}</dt><dd className={s.num} dir="ltr">{price === null ? '—' : fmtAtomic(price.toString(), unitPriceDecimals, currency, 4)}</dd></div>
                    <div data-strong="true"><dt>{t.estimate}</dt><dd className={s.num} dir="ltr"><b>{estimate === null ? '—' : fmtAtomic(estimate.toString(), unitPriceDecimals, currency, 2)}</b></dd></div>
                  </dl>
                  {price === null && <p className={s.muted} style={{ margin: '6px 0 0', fontSize: 12 }}>{t.noQuote}</p>}
                  <label className={s.consent}>
                    <input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setServerError(null) }} />
                    <span>{t.consent}</span>
                  </label>
                  {serverError && <div className={s.notice} data-tone="error" role="alert"><Info size={16} /><span>{serverError}</span></div>}
                  <button type="submit" className={s.cta} style={{ marginTop: 16 }} disabled={!ready} aria-busy={pending}>
                    <span>{pending ? t.submitting : t.submit}</span>
                    <span className={s.ctaIcon}><ArrowUpFromLine size={17} /></span>
                  </button>
                </>}
            </form>}
  </Sheet>
}

const errorText = (errors: Record<string, string>, error: ApiError, fallback: string) => errors[error.code] ?? (error.message || fallback)

/** Inline confirmation shown on the position page after a request is recorded. */
export function RedeemDone({ item, onDismiss }: { item: Redemption; onDismiss: () => void }) {
  const { locale } = useI18n()
  const t = assetToolsCopy[locale].redeem
  return <div className={s.notice} data-tone="info" role="status">
    <Check size={16} />
    <span><b>{t.done}</b> · {fill(t.doneBody, { s: t.states[item.state] ?? item.state })} <button type="button" className={s.link} onClick={onDismiss}>{t.close}</button></span>
  </div>
}
