'use client'

import { Delete, LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import { changeTransactionPin, isPin, resetTransactionPin, setupTransactionPin, type TransactionPinStatus } from '@/lib/api/transaction-pin'
import { transactionPinCopy, type TransactionPinMode, type TransactionPinStep } from '@/lib/maison-transaction-pin-copy'
import { Sheet } from './Sheet'
import { useStepUp, type StepUpLine } from './StepUp'
import { maison as s } from './primitives'
import x from './transaction-pin.module.css'

export function TransactionPinPad({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { locale } = useI18n()
  const copy = transactionPinCopy[locale].pad
  const pad = useRef<HTMLDivElement>(null)
  useEffect(() => { if (!disabled) pad.current?.focus({ preventScroll: true }) }, [disabled])
  const digit = (n: string) => { if (!disabled && value.length < 6) onChange(value + n) }
  const keyboard = (event: KeyboardEvent) => {
    if (disabled || event.metaKey || event.ctrlKey || event.altKey) return
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); digit(event.key) }
    else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); onChange(value.slice(0, -1)) }
  }
  return <div className={x.pad} ref={pad} tabIndex={disabled ? -1 : 0} onKeyDown={keyboard} role="group" aria-label={copy.label} data-pin-pad="">
    <div className={x.slots} dir="ltr" role="img" aria-live="polite" aria-label={copy.filled(value.length, 6)}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} data-filled={i < value.length} aria-hidden="true">{i < value.length ? '•' : ''}</span>)}
    </div>
    <div className={x.keys} dir="ltr">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => <button key={n} type="button" disabled={disabled || value.length >= 6} aria-label={copy.digit(n)} onClick={() => digit(n)}>{n}</button>)}
      <span aria-hidden="true" />
      <button type="button" disabled={disabled || value.length >= 6} aria-label={copy.digit('0')} onClick={() => digit('0')}>0</button>
      <button type="button" disabled={disabled || !value} aria-label={copy.backspace} onClick={() => onChange(value.slice(0, -1))}><Delete size={23} aria-hidden="true" /></button>
    </div>
  </div>
}

export function TransactionPinPrompt({ open, onClose, onConfirm, summary, busy = false, error }: {
  open: boolean; onClose: () => void; onConfirm: (pin: string) => Promise<void>; summary: StepUpLine[]; busy?: boolean; error?: string
}) {
  const { locale } = useI18n()
  const p = transactionPinCopy[locale]
  const [value, setValue] = useState('')
  const sending = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open || error) setValue('')
    const clear = () => { setValue(''); closeRef.current() }
    window.addEventListener(SESSION_CHANGED, clear); window.addEventListener(SESSION_EXPIRED, clear)
    return () => { window.removeEventListener(SESSION_CHANGED, clear); window.removeEventListener(SESSION_EXPIRED, clear) }
  }, [open, error])
  const confirm = async () => {
    if (busy || sending.current || !isPin(value)) return
    const pin = value
    setValue(''); sending.current = true
    try { await onConfirm(pin) } finally { sending.current = false }
  }
  return <Sheet open={open} busy={busy} onClose={() => { setValue(''); onClose() }} title={p.prompt.title} data-transaction-pin="confirm">
    <dl className={`${s.summary} ${x.summary}`}>{summary.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>
    <TransactionPinPad value={value} onChange={setValue} disabled={busy} />
    {error && <p className={s.fieldError} role="alert">{error}</p>}
    <button type="button" className={s.cta} disabled={busy || !isPin(value)} aria-busy={busy} onClick={() => void confirm()}>
      <span>{busy ? p.working : p.prompt.confirm}</span><LockKeyhole size={18} aria-hidden="true" />
    </button>
  </Sheet>
}

export function TransactionPinManager({ open, mode, onClose, onDone }: {
  open: boolean; mode: TransactionPinMode; onClose: () => void; onDone: (state: TransactionPinStatus) => void
}) {
  const { locale } = useI18n()
  const p = transactionPinCopy[locale]
  const [step, setStep] = useState<TransactionPinStep>(mode === 'change' ? 'current' : 'next')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const secrets = useRef({ current: '', next: '' })
  const epoch = useRef(0)
  const inflight = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const { run, sheet } = useStepUp()
  const clear = () => { secrets.current = { current: '', next: '' }; setValue('') }
  const cancel = () => { epoch.current++; clear(); onClose() }
  useEffect(() => {
    epoch.current++; secrets.current = { current: '', next: '' }; setValue(''); setError(null)
    setStep(mode === 'change' ? 'current' : 'next')
  }, [open, mode])
  useEffect(() => {
    const clearAccount = () => { epoch.current++; secrets.current = { current: '', next: '' }; setValue(''); closeRef.current() }
    window.addEventListener(SESSION_CHANGED, clearAccount); window.addEventListener(SESSION_EXPIRED, clearAccount)
    return () => { epoch.current++; secrets.current = { current: '', next: '' }; window.removeEventListener(SESSION_CHANGED, clearAccount); window.removeEventListener(SESSION_EXPIRED, clearAccount) }
  }, [])
  const advance = async () => {
    if (!isPin(value) || busy || inflight.current) return
    setError(null)
    if (step === 'current') { secrets.current.current = value; setValue(''); setStep('next'); return }
    if (step === 'next') { secrets.current.next = value; setValue(''); setStep('confirm'); return }
    if (value !== secrets.current.next) { clear(); setStep(mode === 'change' ? 'current' : 'next'); setError(p.mismatch); return }
    const attempt = epoch.current
    const payload = { pin: secrets.current.next, confirmation: value, currentPin: secrets.current.current }
    clear(); setBusy(true); inflight.current = true
    try {
      const result = await run(true, reauthentication => {
        if (attempt !== epoch.current) return Promise.resolve({ ok: false as const, error: { status: 0, code: 'SESSION_CHANGED', message: p.failed } })
        const body = { ...payload, reauthentication: reauthentication ?? '' }
        return mode === 'setup' ? setupTransactionPin(body) : mode === 'change' ? changeTransactionPin(body) : resetTransactionPin(body)
      }, [{ label: p.securityLabel, value: p.title[mode] }])
      if (attempt !== epoch.current) return
      if (result?.ok) { onDone(result.data); return }
      setError(result && !result.ok ? p.errors[result.error.code] ?? p.failed : null)
      setStep(mode === 'change' ? 'current' : 'next')
    } catch { if (attempt === epoch.current) { setError(p.failed); setStep(mode === 'change' ? 'current' : 'next') } }
    finally { payload.pin = ''; payload.confirmation = ''; payload.currentPin = ''; inflight.current = false; if (attempt === epoch.current) setBusy(false) }
  }
  return <>
    <Sheet open={open} busy={busy} onClose={cancel} title={p.title[mode]} data-transaction-pin={mode}>
      <p className={x.step}>{p.step[step]}</p>
      {mode === 'reset' && <p className={s.notice} data-tone="warn">{p.resetNotice}</p>}
      <TransactionPinPad key={step} value={value} onChange={setValue} disabled={busy} />
      {error && <p className={s.fieldError} role="alert">{error}</p>}
      <button type="button" className={s.cta} disabled={busy || !isPin(value)} aria-busy={busy} onClick={() => void advance()}>
        <span>{busy ? p.working : step === 'confirm' ? p.submit : p.next}</span><LockKeyhole size={18} aria-hidden="true" />
      </button>
    </Sheet>
    {sheet}
  </>
}
