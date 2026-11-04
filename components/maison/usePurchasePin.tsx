'use client'

/**
 * Payment PIN before every purchase (2026-11-05, user: buying a product or placing a prediction asks for the payment
 * password, the same one as for withdrawals). Like Alipay / WeChat Pay / brokerage apps: the order is reviewed, then
 * the 6-digit PIN confirms it; no PIN yet → set one first, then continue. The server checks the PIN on every purchase
 * (apps/api TransactionPinService.verifyPurchase); a wrong PIN keeps the sheet open with the attempts left.
 * `ask(summary, run)` resolves with run's result, or null when the member backs out.
 */
import { useRef, useState, type ReactNode } from 'react'
import type { ApiResult } from '@/lib/api/_http'
import { getTransactionPinStatus, isPinError, pinErrorDetails, pinGate, type TransactionPinStatus } from '@/lib/api/transaction-pin'
import { transactionPinCopy } from '@/lib/maison-transaction-pin-copy'
import { useI18n } from '@/lib/i18n'
import { TransactionPinManager, TransactionPinPrompt } from './TransactionPin'

type Line = { label: string; value: ReactNode }
type Pending<T> = { summary: Line[]; run: (pin: string) => Promise<ApiResult<T>>; resolve: (result: ApiResult<T> | null) => void }

export function usePurchasePin<T>() {
  const { locale } = useI18n()
  const p = transactionPinCopy[locale]
  const [stage, setStage] = useState<'idle' | 'setup' | 'prompt'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const pending = useRef<Pending<T> | null>(null)

  const finish = (result: ApiResult<T> | null) => { const job = pending.current; pending.current = null; setStage('idle'); setBusy(false); setError(undefined); job?.resolve(result) }

  const ask = (summary: Line[], run: (pin: string) => Promise<ApiResult<T>>) => new Promise<ApiResult<T> | null>((resolve) => {
    pending.current = { summary, run, resolve }
    setError(undefined)
    void getTransactionPinStatus().then((status) => {
      if (!status.ok) { setStage('prompt'); return } // the server still checks; the prompt shows its answer
      const gate = pinGate(status.data)
      if (gate === 'unset') { setStage('setup'); return }
      if (gate === 'locked') { setStage('prompt'); setError(p.gate.locked); return }
      setStage('prompt') // the post-reset cooldown limits withdrawals only, not purchases
    })
  })

  const confirm = async (pin: string) => {
    const job = pending.current
    if (!job) return
    setBusy(true); setError(undefined)
    const result = await job.run(pin)
    setBusy(false)
    if (!result.ok && isPinError(result.error.code)) {
      const details = pinErrorDetails(result.error)
      if (result.error.code === 'TRANSACTION_PIN_UNSET' || result.error.code === 'TRANSACTION_PIN_NOT_SET') { setStage('setup'); return }
      setError([p.errors[result.error.code] ?? result.error.message, details.remainingAttempts === undefined ? null : p.attempts(details.remainingAttempts)].filter(Boolean).join(' · '))
      return
    }
    finish(result)
  }

  const ui = <>
    <TransactionPinManager open={stage === 'setup'} mode="setup" onClose={() => finish(null)} onDone={(state: TransactionPinStatus) => { void state; setStage('prompt') }} />
    <TransactionPinPrompt open={stage === 'prompt'} onClose={() => { if (!busy) finish(null) }} onConfirm={confirm} summary={pending.current?.summary ?? []} busy={busy} error={error} />
  </>
  return { ask, ui }
}
