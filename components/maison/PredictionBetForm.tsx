'use client'

import { Check, ChevronDown, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { marketCopy } from '@/lib/maison-market-copy'
import { predictionControlText } from '@/lib/prediction-controls-copy'
import { predictionTicketCopy } from '@/lib/prediction-ticket-copy'
import type { PredictionWalletAction } from '@/lib/prediction-ticket-state'
import { maison as s } from './primitives'
import ui from './prediction-experience.module.css'
import rw from '@/components/rewards/rewards.module.css'
import { applyKey, NumPad, settled } from './flow-kit'

export type PredictionBetFormProps = {
  stake: string; onStake: (value: string) => void; onAdd?: (amount: number) => void
  /** Largest stake the member can place now (cash or the per-bet cap, whichever is lower), as a decimal; null = unknown. */
  maxStake?: string | null; decimals?: number
  /** The result line (2026-11-05): return on the stake if right ("+92%") and what is lost if wrong. */
  gain?: string | null; loss?: string | null
  outcomes: Array<{ label: string; probability: string; disabled: boolean }>
  outcome: number | null; onOutcome: (index: number) => void
  balance: string; walletAction: PredictionWalletAction
  price: string; shares: string; fees: string; netPayout: string; updatedAt: string; limit?: string
  fieldError?: string | null; serverError?: string | null
  quoteReason?: Parameters<typeof predictionControlText>[1] | null
  quoteError?: boolean; amountTooLarge?: boolean; smallerStake?: string | null
  refreshing: boolean; pending: boolean; risk: boolean; ready: boolean
  onRisk: (value: boolean) => void; onRefresh: () => void; onLower: () => void
  onReload: () => void; onDeposit: () => void; onSubmit: () => void
  /** Stage 3: a fee coupon the user owns (label, validity line, the estimated discount when on). */
  coupon?: { label: string; sub: string; discount: string | null; on: boolean; onToggle: (on: boolean) => void }
  /** v2: bet vouchers as chips; picking one sets and locks the stake to its face. */
  voucher?: { label: string; hint: string; off: string; options: { id: string; label: string }[]; selected: string | null; onSelect: (id: string | null) => void }
  stakeLocked?: boolean
}

/**
 * Pure view shared by the real ticket and the explicitly isolated design preview.
 * v4 (2026-11-05, user: the sheet was too big and odd, its top hidden on some phones; order agreed with Codex):
 * the market is the sheet's title; then a 44px 是/否 bar with the price in ¢; the amount (40px) with one row of quick
 * chips; one result line (what you get if right) over a small line (what you lose if wrong · the return); a 3×4 keypad;
 * one "offers & details" fold; the risk line; the button carries the amount. Everything fits a 740px-tall screen.
 */
export function PredictionBetForm(props: PredictionBetFormProps) {
  const { locale } = useI18n()
  const t = tradeCopy[locale].prediction, copy = marketCopy[locale], labels = predictionTicketCopy[locale]
  const walletReady = props.walletAction === 'bet' || props.walletAction === 'deposit'
  const canDeposit = props.walletAction === 'deposit' && !props.pending
  const action = props.walletAction === 'deposit' ? props.onDeposit : props.walletAction === 'reload' ? props.onReload : props.onSubmit
  const decimals = props.decimals ?? 6
  // The typed text stays local so "12." survives a render; the ticket only ever sees the settled number.
  const [text, setText] = useState(props.stake)
  useEffect(() => { setText((current) => settled(current) === props.stake ? current : props.stake) }, [props.stake])
  const latest = useRef(text)
  latest.current = text
  const key = (input: string) => {
    if (props.pending || props.stakeLocked) return
    const next = input.startsWith('=') ? input.slice(1) : applyKey(latest.current, input, Math.min(2, decimals))
    if (next === latest.current) return
    latest.current = next
    setText(next)
    props.onStake(settled(next))
  }
  const fits = (value: number) => props.maxStake == null || Number(props.maxStake) >= value ? String(value) : null
  const quick = [
    { label: '10', value: fits(10) }, { label: '50', value: fits(50) }, { label: '100', value: fits(100) },
    { label: labels.max, value: props.maxStake && Number(props.maxStake) > 0 ? props.maxStake : null },
  ]
  const [whole, fraction] = text.split('.')
  const shown = text ? `${Number(whole || '0').toLocaleString(locale === 'ar' ? 'en' : locale)}${fraction === undefined ? '' : `.${fraction}`}` : '0'
  const amountText = props.stake && Number(props.stake) > 0 ? `${shown} USDT` : null
  const label = props.pending ? t.placing : props.walletAction === 'deposit' ? labels.deposit : props.walletAction === 'reload' ? copy.common.retry
    : props.walletAction === 'loading' ? labels.checking : amountText ? `${labels.bet} · ${amountText}` : labels.bet
  // The fold's closed line says what is inside that matters: the voucher or coupon in use, else the fee.
  const offer = props.voucher?.selected ? props.voucher.options.find((o) => o.id === props.voucher!.selected)?.label
    : props.coupon?.on && props.coupon.discount ? props.coupon.discount : null
  const quote = props.quoteError ? <span>{predictionControlText(locale, 'unavailable')}</span>
    : props.amountTooLarge ? props.smallerStake && <button type="button" disabled={props.pending || props.refreshing} onClick={props.onLower}>{labels.lowerAmount} · {props.smallerStake}</button>
    : props.quoteReason && props.quoteReason !== 'no_liquidity' ? <span>{predictionControlText(locale, props.quoteReason)}</span> : null
  return <div className={ui.compactTicket}>
    <div className={ui.ticketOutcomes} role="radiogroup" aria-label={copy.review.outcome}>{props.outcomes.map((outcome, index) =>
      <button key={index} type="button" role="radio" data-side={index ? 'no' : 'yes'} aria-checked={props.outcome === index} aria-pressed={props.outcome === index} disabled={outcome.disabled || props.pending} onClick={() => props.onOutcome(index)}>
        {props.outcome === index && <Check size={15} strokeWidth={2.6} aria-hidden="true" />}<span>{outcome.label}</span><b dir="ltr">{outcome.probability}</b>
      </button>)}</div>
    <div className={ui.ticketAmount}>
      <p className={ui.centerFigure} data-empty={!text || undefined} data-invalid={props.fieldError ? 'true' : undefined} aria-live="polite" aria-label={labels.amount}><bdi dir="ltr">{shown}</bdi><span>USDT</span></p>
      <p id="bet-stake-meta" className={ui.balance}>{walletReady ? `${labels.cash} ${props.balance}` : props.walletAction === 'reload' ? copy.common.unavailable : labels.checking}</p>
    </div>
    {!props.stakeLocked && <div className={ui.quickRow} role="group" aria-label={labels.amount}>{quick.map((q) =>
      <button key={q.label} type="button" disabled={props.pending || !q.value} aria-pressed={Boolean(q.value && settled(text) === q.value)} onClick={() => q.value && key(`=${q.value}`)}>{q.label}</button>)}</div>}
    <div className={ui.winLine} aria-live="polite">
      <div><span>{labels.win}</span><b className={s.num}>{props.netPayout}</b></div>
      <p><span>{props.stakeLocked ? labels.voucherPays : props.loss ? <>{labels.lose} <bdi dir="ltr">{props.loss}</bdi></> : ' '}</span>
        {props.gain && <em dir="ltr" data-tone={props.gain.startsWith('+') ? 'up' : 'flat'}>{labels.returnOf} {props.gain}</em>}</p>
    </div>
    {props.fieldError && props.walletAction !== 'deposit' && <p className={ui.ticketIssue} role="alert">{props.fieldError}</p>}
    {!props.stakeLocked && <div className={ui.ticketPad}><NumPad onKey={key} current={settled(text)} decimal={decimals > 0} disabled={props.pending} label={labels.amount} /></div>}
    <details className={ui.ticketMore}>
      <summary><span>{labels.more}</span>{offer ? <b dir="ltr">{offer}</b> : <small dir="ltr">{props.fees}</small>}<ChevronDown size={16} aria-hidden="true" /></summary>
      <div className={ui.ticketMoreBody}>
        {props.voucher && <div className={rw.voucherRow}><span>{props.voucher.label}<small>{props.voucher.hint}</small></span>
          <div className={rw.voucherChips} role="radiogroup" aria-label={props.voucher.label}>
            <button type="button" role="radio" aria-checked={props.voucher.selected === null} disabled={props.pending} onClick={() => props.voucher!.onSelect(null)}>{props.voucher.off}</button>
            {props.voucher.options.map(o => <button key={o.id} type="button" role="radio" aria-checked={props.voucher!.selected === o.id} disabled={props.pending} onClick={() => props.voucher!.onSelect(o.id)}>{o.label}</button>)}
          </div></div>}
        {props.coupon && <label className={rw.useRow}><span>{props.coupon.label}<small>{props.coupon.sub}</small></span>{props.coupon.discount && <b dir="ltr">{props.coupon.discount}</b>}<input type="checkbox" role="switch" className={rw.switch} checked={props.coupon.on} disabled={props.pending} onChange={event => props.coupon!.onToggle(event.target.checked)} /></label>}
        <dl>
          <div><dt>{t.price}</dt><dd dir="ltr">{props.price}</dd></div>
          <div><dt>{t.shares}</dt><dd dir="ltr">{props.shares}</dd></div>
          <div><dt>{t.feeEstimate}</dt><dd dir="ltr">{props.fees}</dd></div>
          {props.limit && <div><dt>{t.stake}</dt><dd>{props.limit}</dd></div>}
          <div><dt>{copy.common.updated.replace('{t}', '').trim()}</dt><dd><button type="button" className={ui.refreshKey} disabled={props.refreshing || props.pending} onClick={props.onRefresh}><RefreshCw size={12} className={props.refreshing ? ui.quoteSpinner : undefined} aria-hidden="true" />{props.updatedAt}</button></dd></div>
        </dl>
      </div>
    </details>
    {quote && <div className={ui.quoteLine} role="status">{quote}<button type="button" disabled={props.refreshing || props.pending} onClick={props.onRefresh}><RefreshCw size={13} className={props.refreshing ? ui.quoteSpinner : undefined} />{predictionControlText(locale, props.refreshing ? 'refreshing' : 'refresh')}</button></div>}
    {props.serverError && <p className={ui.ticketIssue} role="alert">{props.serverError}</p>}
    <div className={ui.ticketFooter}>
      {props.walletAction === 'bet' && <label className={ui.ticketConsent}><input type="checkbox" checked={props.risk} disabled={props.pending} onChange={event => props.onRisk(event.target.checked)} /><span>{t.risk}</span></label>}
      <button type="button" className={s.cta} onClick={action} disabled={props.pending || (props.walletAction === 'bet' ? !props.ready : props.walletAction === 'loading' ? true : props.walletAction === 'deposit' ? !canDeposit : false)} aria-busy={props.pending || props.walletAction === 'loading'}><span>{label}</span></button>
    </div>
  </div>
}
