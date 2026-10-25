'use client'

import { ArrowLeft, Delete, LockKeyhole, ShieldCheck, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { usePaletteA } from '@/lib/palette-preview'
import { flowKitCopy } from '@/lib/flow-kit-copy'
import { NumPad } from './flow-kit'
import { useI18n } from '@/lib/i18n'
import { SESSION_CHANGED, SESSION_EXPIRED } from '@/lib/api/_http'
import type { StepUpResult } from '@/lib/api/security'
import { changeTransactionPin, isPin, resetTransactionPin, setupTransactionPin, type TransactionPinStatus } from '@/lib/api/transaction-pin'
import { transactionPinCopy, type TransactionPinMode, type TransactionPinStep } from '@/lib/maison-transaction-pin-copy'
import { Sheet } from './Sheet'
import { StepUpPanel, type StepUpLine } from './StepUp'
import { maison as s } from './primitives'
import x from './transaction-pin.module.css'

type PinStage = TransactionPinStep | 'verify'

const SHUFFLE_KEY = 'rwa.pin.shuffle'
const shuffled = () => { const list = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']; for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]] } return list }

/** Palette A PIN pad: the shared keypad, with an optional shuffled layout (remembered) so the key positions say nothing. */
function KitPinPad({ value, onChange, disabled, invalid, onBack, backLabel }: { value: string; onChange: (value: string) => void; disabled: boolean; invalid: boolean; onBack?: () => void; backLabel?: string }) {
  const { locale } = useI18n()
  const copy = transactionPinCopy[locale].pad
  const kit = flowKitCopy(locale)
  const [shuffle, setShuffle] = useState(false)
  useEffect(() => { try { setShuffle(window.localStorage.getItem(SHUFFLE_KEY) === '1') } catch { /* off */ } }, [])
  const order = useMemo(() => shuffle ? shuffled() : undefined, [shuffle])
  const latest = useRef(value)
  latest.current = value
  const key = (pressed: string) => {
    const next = pressed === 'back' ? latest.current.slice(0, -1) : pressed === 'clear' ? '' : /^\d$/.test(pressed) && latest.current.length < 6 ? latest.current + pressed : latest.current
    latest.current = next
    onChange(next)
  }
  const toggle = () => setShuffle((on) => { try { window.localStorage.setItem(SHUFFLE_KEY, on ? '0' : '1') } catch { /* not remembered */ } return !on })
  return <div className={x.kitPad} role="group" aria-label={copy.label} data-pin-pad="" data-invalid={invalid || undefined}>
    <div className={x.slots} dir="ltr" role="img" aria-live="polite" aria-label={copy.filled(value.length, 6)}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} data-filled={i < value.length} aria-hidden="true" />)}
    </div>
    <NumPad onKey={key} decimal={false} disabled={disabled} order={order} label={copy.label}
      left={onBack ? <button type="button" disabled={disabled} aria-label={backLabel} onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button> : undefined} />
    <button type="button" className={x.shuffle} aria-pressed={shuffle} onClick={toggle}><Shuffle size={14} aria-hidden="true" />{kit.shuffle}</button>
  </div>
}

export function TransactionPinPad({ value, onChange, disabled = false, invalid = false, onBack, backLabel }: { value: string; onChange: (value: string) => void; disabled?: boolean; invalid?: boolean; onBack?: () => void; backLabel?: string }) {
  if (usePaletteA()) return <KitPinPad value={value} onChange={onChange} disabled={disabled} invalid={invalid} onBack={onBack} backLabel={backLabel} />
  return <ClassicPinPad value={value} onChange={onChange} disabled={disabled} invalid={invalid} onBack={onBack} backLabel={backLabel} />
}

function ClassicPinPad({ value, onChange, disabled = false, invalid = false, onBack, backLabel }: { value: string; onChange: (value: string) => void; disabled?: boolean; invalid?: boolean; onBack?: () => void; backLabel?: string }) {
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
  return <div className={x.pad} ref={pad} tabIndex={disabled ? -1 : 0} onKeyDown={keyboard} role="group" aria-label={copy.label} data-pin-pad="" data-invalid={invalid || undefined}>
    <div className={x.slots} dir="ltr" role="img" aria-live="polite" aria-label={copy.filled(value.length, 6)}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} data-filled={i < value.length} aria-hidden="true" />)}
    </div>
    <div className={x.keys} dir="ltr">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => <button key={n} type="button" disabled={disabled || value.length >= 6} aria-label={copy.digit(n)} onClick={() => digit(n)}>{n}</button>)}
      {onBack ? <button type="button" className={x.keyBack} disabled={disabled} aria-label={backLabel} onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button> : <span aria-hidden="true" />}
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
  // Palette A: the sixth digit confirms (the keypad has no Enter); the button stays only as a busy line.
  const paletteA = usePaletteA()
  const confirmRef = useRef(confirm)
  confirmRef.current = confirm
  useEffect(() => { if (paletteA && open && isPin(value)) void confirmRef.current() }, [paletteA, open, value])
  return <Sheet open={open} busy={busy} onClose={() => { setValue(''); onClose() }} title={p.prompt.title} data-transaction-pin="confirm">
    <dl className={`${s.summary} ${x.summary}`}>{summary.map(line => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>
    <TransactionPinPad value={value} onChange={setValue} disabled={busy} invalid={Boolean(error)} />
    {error && <p className={s.fieldError} role="alert">{error}</p>}
    {paletteA ? <p className={x.working} aria-live="polite">{busy ? p.working : null}</p>
      : <button type="button" className={s.cta} disabled={busy || !isPin(value)} aria-busy={busy} onClick={() => void confirm()}>
        <span>{busy ? p.working : p.prompt.confirm}</span><LockKeyhole size={18} aria-hidden="true" />
      </button>}
  </Sheet>
}

export function TransactionPinManager({ open, mode, onClose, onDone }: {
  open: boolean; mode: TransactionPinMode; onClose: () => void; onDone: (state: TransactionPinStatus) => void
}) {
  const { locale } = useI18n()
  const p = transactionPinCopy[locale]
  const stages: PinStage[] = mode === 'change' ? ['current', 'next', 'confirm', 'verify'] : ['next', 'confirm', 'verify']
  const first = stages[0]
  const [stage, setStage] = useState<PinStage>(first)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const secrets = useRef({ current: '', next: '', confirm: '' })
  const epoch = useRef(0)
  const inflight = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const wipe = () => { secrets.current = { current: '', next: '', confirm: '' }; setValue('') }
  const cancel = () => { epoch.current++; wipe(); onClose() }
  useEffect(() => {
    epoch.current++; secrets.current = { current: '', next: '', confirm: '' }; setValue(''); setError(null); setRound(0)
    setStage(mode === 'change' ? 'current' : 'next')
  }, [open, mode])
  useEffect(() => {
    const clearAccount = () => { epoch.current++; secrets.current = { current: '', next: '', confirm: '' }; setValue(''); closeRef.current() }
    window.addEventListener(SESSION_CHANGED, clearAccount); window.addEventListener(SESSION_EXPIRED, clearAccount)
    return () => { epoch.current++; secrets.current = { current: '', next: '', confirm: '' }; window.removeEventListener(SESSION_CHANGED, clearAccount); window.removeEventListener(SESSION_EXPIRED, clearAccount) }
  }, [])

  // Six digits move the card on by themselves; a wrong confirmation stays on the same step so only that entry is redone.
  const advance = () => {
    if (stage === 'verify' || !isPin(value) || busy || inflight.current) return
    if (stage === 'current') { secrets.current.current = value; setValue(''); setStage('next'); return }
    if (stage === 'next') { secrets.current.next = value; setValue(''); setStage('confirm'); return }
    if (value !== secrets.current.next) { setValue(''); setError(p.mismatch); return }
    secrets.current.confirm = value; setValue(''); setStage('verify')
  }
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  useEffect(() => {
    if (stage === 'verify' || busy || !isPin(value)) return
    const timer = window.setTimeout(() => advanceRef.current(), 160)
    return () => window.clearTimeout(timer)
  }, [value, stage, busy])

  const back = () => {
    const previous = stages[stages.indexOf(stage) - 1]
    if (!previous || busy) return
    if (previous !== 'verify') secrets.current[previous] = ''
    setValue(''); setError(null); setStage(previous)
  }

  const submit = async (verified: StepUpResult) => {
    if (inflight.current) return
    const attempt = epoch.current
    const body = { pin: secrets.current.next, confirmation: secrets.current.confirm, reauthentication: verified.reauthentication }
    const currentPin = secrets.current.current
    let retry = false
    setError(null); setBusy(true); inflight.current = true
    try {
      const result = mode === 'setup' ? await setupTransactionPin(body) : mode === 'change' ? await changeTransactionPin({ ...body, currentPin }) : await resetTransactionPin(body)
      if (attempt !== epoch.current) return
      if (result.ok) { onDone(result.data); return }
      if (result.error.code === 'STEP_UP_REQUIRED') { retry = true; setRound((n) => n + 1); setError(p.flow.expired); return }
      setError(p.errors[result.error.code] ?? (result.error.status > 0 ? `${p.failed} (${result.error.code})` : p.failed))
      setStage(first)
    } catch { if (attempt === epoch.current) { setError(p.failed); setStage(first) } }
    finally {
      inflight.current = false
      if (attempt === epoch.current) { if (!retry) wipe(); setBusy(false) }
    }
  }

  const index = stages.indexOf(stage)
  return <Sheet open={open} busy={busy} onClose={cancel} title={p.title[mode]} data-transaction-pin={mode}
    kicker={<><ShieldCheck size={13} aria-hidden="true" />{p.flow.stepOf(index + 1, stages.length)}</>}>
    <ol className={x.progress} aria-hidden="true">{stages.map((id, i) => <li key={id} data-state={i < index ? 'done' : i === index ? 'now' : 'todo'} />)}</ol>
    <div className={x.lead} key={stage}>
      <h3 aria-live="polite">{stage === 'verify' ? p.flow.verifyTitle : p.step[stage]}</h3>
      <p>{stage === 'verify' ? p.flow.verifyHint : p.flow.hint[stage]}</p>
    </div>
    {mode === 'reset' && (stage === first || stage === 'verify') && <p className={s.notice} data-tone="warn">{p.resetNotice}</p>}
    {stage === 'verify' ? <>
      <div className={x.msgSlot}>{error && <p role="alert">{error}</p>}</div>
      <StepUpPanel key={round} emailFirst locked={busy} onVerified={(verified) => void submit(verified)} onLeave={cancel} />
    </> : <>
      <TransactionPinPad key={stage} value={value} onChange={(next) => { setValue(next); if (error) setError(null) }} disabled={busy} invalid={Boolean(error)} onBack={index > 0 ? back : undefined} backLabel={p.back} />
      <div className={x.msgSlot}>{error && <p role="alert">{error}</p>}</div>
    </>}
    {stage === 'verify' && <button type="button" className={x.back} disabled={busy} onClick={back}><ArrowLeft size={14} aria-hidden="true" />{p.back}</button>}
  </Sheet>
}
