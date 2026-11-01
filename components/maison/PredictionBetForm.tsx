'use client'

import { ArrowRight, ChevronDown, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { tradeCopy } from '@/lib/maison-trade-copy'
import { marketCopy } from '@/lib/maison-market-copy'
import { predictionControlText } from '@/lib/prediction-controls-copy'
import { predictionTicketCopy } from '@/lib/prediction-ticket-copy'
import type { PredictionWalletAction } from '@/lib/prediction-ticket-state'
import { maison as s } from './primitives'
import ui from './prediction-experience.module.css'
import rw from '@/components/rewards/rewards.module.css'

export type PredictionBetFormProps = {
  stake: string; onStake: (value: string) => void; onAdd: (amount: number) => void
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

/** Pure view shared by the real ticket and the explicitly isolated design preview. */
export function PredictionBetForm(props: PredictionBetFormProps) {
  const { locale } = useI18n()
  const t = tradeCopy[locale].prediction, copy = marketCopy[locale], labels = predictionTicketCopy[locale]
  const walletReady = props.walletAction === 'bet' || props.walletAction === 'deposit'
  const canDeposit = props.walletAction === 'deposit' && !props.pending
  const action = props.walletAction === 'deposit' ? props.onDeposit : props.walletAction === 'reload' ? props.onReload : props.onSubmit
  const label = props.pending ? t.placing : props.walletAction === 'deposit' ? labels.deposit : props.walletAction === 'reload' ? copy.common.retry : props.walletAction === 'loading' ? labels.checking : labels.bet
  const refresh = <button type="button" disabled={props.refreshing || props.pending} onClick={props.onRefresh}><RefreshCw size={13} className={props.refreshing ? ui.quoteSpinner : undefined}/>{predictionControlText(locale, props.refreshing ? 'refreshing' : 'refresh')}</button>
  return <div className={ui.compactTicket}>
    <div className={ui.ticketAmount}>
      <label htmlFor="bet-stake" className={ui.amountLabel}>{t.stake}</label>
      <div className={ui.centerAmount}><input id="bet-stake" inputMode="decimal" autoComplete="off" placeholder="0" value={props.stake} disabled={props.pending || props.stakeLocked} aria-invalid={Boolean(props.fieldError)} aria-describedby="bet-stake-meta" onChange={event => props.onStake(event.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}/><span>USDT</span></div>
      <p id="bet-stake-meta" className={ui.balance}>{walletReady ? `${labels.cash} ${props.balance}` : props.walletAction === 'reload' ? copy.common.unavailable : labels.checking}</p>
    </div>
    <div className={ui.ticketOutcomes} role="group" aria-label={copy.review.outcome}>{props.outcomes.map((outcome,index)=><button key={index} type="button" data-side={index?'no':'yes'} aria-pressed={props.outcome===index} disabled={outcome.disabled || props.pending} onClick={()=>props.onOutcome(index)}><span>{outcome.label}</span><small>{outcome.probability}</small></button>)}</div>
    <div className={ui.netWin} aria-live="polite"><span>{labels.netPayout}</span><b className={s.num}>{props.netPayout}</b></div>
    <p className={ui.netCost}>{t.feeEstimate} <bdi dir="ltr">{props.fees}</bdi> · {t.price} <bdi dir="ltr">{props.price}</bdi> · {t.shares} <bdi dir="ltr">{props.shares}</bdi></p>
    {props.voucher && <div className={rw.voucherRow}><span>{props.voucher.label}<small>{props.voucher.hint}</small></span>
      <div className={rw.voucherChips} role="radiogroup" aria-label={props.voucher.label}>
        <button type="button" role="radio" aria-checked={props.voucher.selected === null} disabled={props.pending} onClick={() => props.voucher!.onSelect(null)}>{props.voucher.off}</button>
        {props.voucher.options.map(o => <button key={o.id} type="button" role="radio" aria-checked={props.voucher!.selected === o.id} disabled={props.pending} onClick={() => props.voucher!.onSelect(o.id)}>{o.label}</button>)}
      </div></div>}
    {props.coupon && <label className={rw.useRow}><span>{props.coupon.label}<small>{props.coupon.sub}</small></span>{props.coupon.discount && <b dir="ltr">{props.coupon.discount}</b>}<input type="checkbox" role="switch" className={rw.switch} checked={props.coupon.on} disabled={props.pending} onChange={event => props.coupon!.onToggle(event.target.checked)} /></label>}
    {!props.stakeLocked && <div className={ui.quickAmounts}>{[1,5,10,100].map(amount=><button key={amount} type="button" className={s.chip} disabled={props.pending} onClick={()=>props.onAdd(amount)}>+{amount}</button>)}</div>}
    {props.fieldError && props.walletAction !== 'deposit' && <p className={ui.ticketIssue} role="alert">{props.fieldError}</p>}
    <details className={ui.ticketDetails}><summary><span>{labels.details} · {labels.market}</span><ChevronDown size={14}/></summary><dl>
      {props.limit && <div><dt>{t.stake}</dt><dd>{props.limit}</dd></div>}
      <div><dt>{copy.common.updated.replace('{t}', '').trim()}</dt><dd>{props.updatedAt}</dd></div>
    </dl></details>
    <div className={ui.quoteLine} role="status">
      {props.quoteError ? <span>{predictionControlText(locale,'unavailable')}</span> : props.amountTooLarge ? props.smallerStake && <button type="button" disabled={props.pending || props.refreshing} onClick={props.onLower}>{labels.lowerAmount} · {props.smallerStake}</button> : props.quoteReason && props.quoteReason !== 'no_liquidity' ? <span>{predictionControlText(locale,props.quoteReason)}</span> : null}
      {refresh}
    </div>
    {props.walletAction === 'bet' && <label className={`${s.consent} ${ui.ticketConsent}`}><input type="checkbox" checked={props.risk} disabled={props.pending} onChange={event=>props.onRisk(event.target.checked)}/><span>{t.risk}</span></label>}
    {props.serverError && <p className={ui.ticketIssue} role="alert">{props.serverError}</p>}
    <div className={ui.ticketFooter}><button type="button" className={s.cta} onClick={action} disabled={props.pending || (props.walletAction==='bet' ? !props.ready : props.walletAction==='loading' ? true : props.walletAction==='deposit' ? !canDeposit : false)} aria-busy={props.pending || props.walletAction==='loading'}><span>{label}</span><ArrowRight size={20}/></button></div>
  </div>
}
