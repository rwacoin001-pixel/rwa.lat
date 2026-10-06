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
      <div className={ui.centerAmount}><input id="bet-stake" inputMode="decimal" autoComplete="off" placeholder="0" value={props.stake} disabled={props.pending} aria-invalid={Boolean(props.fieldError)} aria-describedby="bet-stake-meta" onChange={event => props.onStake(event.target.value.replace(',', '.').replace(/[^\d.]/g, ''))}/><span>USDT</span></div>
      <p id="bet-stake-meta" className={ui.balance}>{walletReady ? `${labels.cash} ${props.balance}` : props.walletAction === 'reload' ? copy.common.unavailable : labels.checking}</p>
    </div>
    <div className={ui.ticketOutcomes} role="group" aria-label={copy.review.outcome}>{props.outcomes.map((outcome,index)=><button key={index} type="button" data-side={index?'no':'yes'} aria-pressed={props.outcome===index} disabled={outcome.disabled || props.pending} onClick={()=>props.onOutcome(index)}><span>{outcome.label}</span><small>{outcome.probability}</small></button>)}</div>
    <div className={ui.netWin} aria-live="polite"><span>{labels.netPayout}</span><b className={s.num}>{props.netPayout}</b></div>
    <p className={ui.netCost}>{t.feeEstimate} <bdi dir="ltr">{props.fees}</bdi> · {t.price} <bdi dir="ltr">{props.price}</bdi> · {t.shares} <bdi dir="ltr">{props.shares}</bdi></p>
    <div className={ui.quickAmounts}>{[1,5,10,100].map(amount=><button key={amount} type="button" className={s.chip} disabled={props.pending} onClick={()=>props.onAdd(amount)}>+{amount}</button>)}</div>
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
