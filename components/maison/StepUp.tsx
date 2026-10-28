'use client'

import { Fingerprint, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { CodePad } from './flow-kit'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { SESSION_CHANGED, SESSION_EXPIRED, type ApiResult } from '@/lib/api/_http'
import { listSecurityFactors, requestStepUpEmailCode, stepUpWithEmailCode, stepUpWithPasskey, stepUpWithRecoveryCode, stepUpWithTotp, type EmailStepUpChallenge, type StepUpResult } from '@/lib/api/security'
import type { WalletIntegration } from '@/lib/api/wallet'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { marketCopy } from '@/lib/maison-market-copy'
import { transactionPinCopy } from '@/lib/maison-transaction-pin-copy'
import { openPath } from '@/lib/maison-nav'
import { Skeleton, StateBlock, maison as s } from './primitives'
import { Segmented } from './motion'
import { Sheet } from './Sheet'
import x from './transaction-pin.module.css'

/** One line of what is about to be authorised, shown under the title so the factor is entered against the real intent. */
export type StepUpLine = { label: string; value: ReactNode }

type Method = 'email' | 'totp' | 'recovery' | 'passkey'
type MailState = { phase: 'idle' | 'sending' | 'ready' | 'failed' | 'unavailable'; challenge: EmailStepUpChallenge | null; resendAt: number }
type Note = { tone: 'error' | 'info'; text: string }

/** The server answers these when the email factor is not deployed or the account has no verified address; the panel then falls back to the other factors. */
const EMAIL_UNAVAILABLE = new Set(['STEP_UP_EMAIL_UNAVAILABLE', 'EMAIL_NOT_VERIFIED', 'EMAIL_UNAVAILABLE'])

/** Wallet writes skip the server step-up only on the stub custodian with demo execution on; anything else needs a fresh factor. */
export const stepUpRequired = (integration: WalletIntegration | null | undefined) => !integration || !(integration.adapterMode === 'stub' && integration.demoExecutionEnabled)

/**
 * Session-bound re-authentication for money-out actions. Each action obtains fresh verification;
 * `run` asks for it up front when required and once more if the server still answers STEP_UP_REQUIRED.
 * The action receives the token and must keep its idempotency key independent of it, so the retry replays the same intent.
 */
export function useStepUp(): { run: <T>(required: boolean, action: (reauthentication?: string) => Promise<ApiResult<T>>, summary?: StepUpLine[]) => Promise<ApiResult<T> | null>; sheet: ReactNode } {
  const waiter = useRef<((value: string | null) => void) | null>(null)
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState<StepUpLine[] | undefined>()

  const obtain = useCallback((lines?: StepUpLine[]) => {
    return new Promise<string | null>((resolve) => {
      waiter.current?.(null)
      waiter.current = resolve
      setSummary(lines)
      setOpen(true)
    })
  }, [])

  const settle = useCallback((result: StepUpResult | null) => {
    setOpen(false)
    const resolve = waiter.current
    waiter.current = null
    resolve?.(result?.reauthentication ?? null)
  }, [])

  useEffect(() => {
    const clear = () => { waiter.current?.(null); waiter.current = null; setOpen(false); setSummary(undefined) }
    window.addEventListener(SESSION_CHANGED, clear); window.addEventListener(SESSION_EXPIRED, clear)
    return () => { waiter.current?.(null); waiter.current = null; window.removeEventListener(SESSION_CHANGED, clear); window.removeEventListener(SESSION_EXPIRED, clear) }
  }, [])

  const run = useCallback(async <T,>(required: boolean, action: (reauthentication?: string) => Promise<ApiResult<T>>, lines?: StepUpLine[]) => {
    let reauthentication = required ? await obtain(lines) : null
    if (required && !reauthentication) return null
    let result = await action(reauthentication ?? undefined)
    if (!result.ok && result.error.code === 'STEP_UP_REQUIRED') {
      reauthentication = await obtain(lines)
      if (!reauthentication) return null
      result = await action(reauthentication)
    }
    return result
  }, [obtain])

  return { run, sheet: <StepUpSheet open={open} summary={summary} onDone={settle} /> }
}

function StepUpSheet({ open, summary, onDone }: { open: boolean; summary?: StepUpLine[]; onDone: (result: StepUpResult | null) => void }) {
  const { locale } = useI18n()
  const t = fundsCopy[locale].stepUp
  // Not `busy`-locked: closing mid-passkey unmounts the panel, which aborts the pending verification, as before.
  return <Sheet open={open} onClose={() => onDone(null)} data-step-up=""
    kicker={<><ShieldCheck size={13} aria-hidden="true" />{t.required}</>} title={t.title} description={t.body}>
    {summary && summary.length > 0 && <dl className={s.summary} style={{ marginTop: 16 }}>
      {summary.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}
    </dl>}
    {open && <StepUpPanel onVerified={onDone} onLeave={() => onDone(null)} />}
  </Sheet>
}

/** A six-digit code on our keypad (Paste, clipboard pick-up, a switch back to the system keyboard). */
function CodeField({ value, onChange, disabled, invalid, label }: {
  value: string; onChange: (value: string) => void; disabled: boolean; invalid: boolean; label: string; focusToken?: string
}) {
  return <CodePad value={value} onChange={onChange} disabled={disabled} invalid={invalid} label={label} />
}

/**
 * The verification body, usable inside a sheet (`useStepUp`) or inline in another card.
 * With `emailFirst` the emailed code is the default and the other factors are offered as alternatives;
 * if the email factor is unavailable it falls back to them. Without it the layout and order are the original ones.
 */
export function StepUpPanel({ emailFirst = false, locked = false, onVerified, onLeave }: {
  emailFirst?: boolean; locked?: boolean; onVerified: (result: StepUpResult) => void; onLeave?: () => void
}) {
  const { locale } = useI18n()
  const f = fundsCopy[locale]
  const t = f.stepUp
  const e = transactionPinCopy[locale].flow.email
  const common = marketCopy[locale].common
  const factors = useQuery('security:factors', listSecurityFactors, { staleTime: 30_000 })
  const [method, setMethod] = useState<Method | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [mail, setMail] = useState<MailState>({ phase: 'idle', challenge: null, resendAt: 0 })
  const [now, setNow] = useState(() => Date.now())
  const verification = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const requested = useRef(false)

  useEffect(() => { alive.current = true; return () => { alive.current = false; verification.current?.abort() } }, [])

  const sendCode = async (again: boolean) => {
    setMail((current) => ({ ...current, phase: 'sending' }))
    setNote(null)
    const result = await requestStepUpEmailCode(undefined, locale)
    if (!alive.current) return
    if (result.ok) {
      const at = Date.now()
      setMail({ phase: 'ready', challenge: result.data, resendAt: at + Math.max(0, result.data.resendAfterSeconds) * 1000 })
      setNow(at); setCode('')
      if (again) setNote({ tone: 'info', text: e.resent })
      return
    }
    const { status, code: failure, retryAfter } = result.error
    if (status === 404 || status === 405 || status === 501 || EMAIL_UNAVAILABLE.has(failure)) { setMail({ phase: 'unavailable', challenge: null, resendAt: 0 }); return }
    setMail((current) => ({ phase: current.challenge ? 'ready' : 'failed', challenge: current.challenge, resendAt: retryAfter ? Date.now() + retryAfter * 1000 : current.resendAt }))
    setNote({ tone: 'error', text: f.errors[failure] ?? e.sendFailed })
  }

  useEffect(() => {
    if (!emailFirst || requested.current) return
    requested.current = true
    void sendCode(false)
  }, [emailFirst])

  useEffect(() => {
    if (mail.resendAt <= Date.now()) return
    const timer = window.setInterval(() => {
      const at = Date.now()
      setNow(at)
      if (at >= mail.resendAt) window.clearInterval(timer)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [mail.resendAt])

  const totp = factors.data?.totp.find((item) => item.state === 'active')
  const others: Method[] = [
    ...(typeof window !== 'undefined' && window.isSecureContext && typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.get === 'function' && factors.data?.passkeys.some((item) => item.state === 'active') ? ['passkey' as const] : []),
    ...(totp ? ['totp' as const] : []),
    ...(totp && totp.recoveryCodesRemaining > 0 ? ['recovery' as const] : []),
  ]
  const methods: Method[] = emailFirst && mail.phase !== 'unavailable' ? ['email', ...others] : others
  const active = method && methods.includes(method) ? method : methods[0] ?? null
  const emailActive = active === 'email'
  const wait = Math.max(0, Math.ceil((mail.resendAt - now) / 1000))
  const valid = active === 'email' ? /^\d{6}$/.test(code) && Boolean(mail.challenge) : active === 'totp' ? /^\d{6}$/.test(code) : active === 'recovery' ? /^[A-Z0-9-]{8,16}$/.test(code) : active === 'passkey'
  const lock = busy || locked
  const label = (item: Method) => item === 'email' ? e.label : t[item]

  const verify = async () => {
    if (!active || busy || locked || !valid) return
    setBusy(true)
    setNote(null)
    const controller = new AbortController()
    verification.current = controller
    const result = active === 'email' && mail.challenge ? await stepUpWithEmailCode(mail.challenge.challengeId, code, controller.signal)
      : active === 'totp' ? await stepUpWithTotp(code, controller.signal) : active === 'recovery' ? await stepUpWithRecoveryCode(code, controller.signal) : await stepUpWithPasskey(controller.signal)
    if (controller.signal.aborted) return
    verification.current = null
    setBusy(false)
    if (result.ok) { onVerified(result.data); return }
    const { status, code: failure, message } = result.error
    if (active === 'email') {
      if (/EXPIRED|CHALLENGE/i.test(failure)) setMail((current) => ({ ...current, challenge: null, resendAt: 0, phase: 'failed' }))
      setNote({ tone: 'error', text: f.errors[failure] ?? (status === 0 || status >= 500 ? common.errorGeneric : e.wrong) })
    } else setNote({ tone: 'error', text: f.errors[failure] ?? message ?? common.errorGeneric })
    if (active !== 'passkey') setCode('')
  }
  const verifyRef = useRef(verify)
  verifyRef.current = verify
  // Six digits verify by themselves (email and authenticator codes both go in on the keypad, which has no Enter).
  useEffect(() => { if ((active === 'email' || active === 'totp') && /^\d{6}$/.test(code)) void verifyRef.current() }, [code, active])

  const pick = (next: Method) => { setMethod(next); setCode(''); setNote(null) }
  const leave = () => { onLeave?.(); openPath('/profile/security') }

  if (!emailFirst && factors.error && !factors.data) return <StateBlock tone="error" title={t.loadError} body={factors.error.message} retry={factors.refetch} retryLabel={common.retry} />
  if (!factors.data && (!emailFirst || (!active && !factors.error))) return <Skeleton rows={2} />
  if (!active) return emailFirst
    ? <StateBlock tone="unavailable" title={e.unavailable} body={e.unavailableBody} retry={() => void sendCode(false)} retryLabel={e.retry}
      action={<button type="button" className={s.link} onClick={leave}>{t.openSecurity}</button>} />
    : <StateBlock tone="unavailable" title={t.noFactors} body={t.noFactorsBody} action={<button type="button" className={s.link} onClick={leave}>{t.openSecurity}</button>} />

  const alternatives = methods.filter((item) => item !== active)
  const message = note && <p className={emailFirst ? undefined : note.tone === 'error' ? s.fieldError : s.muted} id="step-up-error" role={note.tone === 'error' ? 'alert' : 'status'} data-tone={note.tone}>{note.text}</p>
  return <form className={emailFirst ? x.verify : undefined} onSubmit={(event) => { event.preventDefault(); void verify() }}>
    {!emailFirst && methods.length > 1 && <div style={{ marginTop: 16 }}><Segmented value={active} onChange={pick} label={t.title} role="group" options={methods.map((item) => ({ value: item, label: label(item) }))} /></div>}
    {emailActive ? <>
      <p className={x.sent} aria-live="polite">
        {mail.challenge ? <><Mail size={14} aria-hidden="true" />{e.sentTo(mail.challenge.maskedEmail)}</>
          : mail.phase === 'sending' ? <><Loader2 size={14} className={x.spin} aria-hidden="true" />{e.sending}</> : null}
      </p>
      <CodeField value={code} onChange={(next) => { setCode(next); setNote(null) }} disabled={lock || !mail.challenge} invalid={note?.tone === 'error' && Boolean(mail.challenge)} label={e.codeLabel} focusToken={mail.challenge?.challengeId} />
    </> : active === 'totp' ? <CodePad value={code} onChange={(next) => { setCode(next); setNote(null) }} disabled={locked || busy} invalid={note?.tone === 'error'} label={t.totpLabel} />
      : active === 'passkey' ? <p className={s.muted} style={{ margin: '16px 0 0', fontSize: 13 }}><Fingerprint size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{t.passkeyBody}</p>
      : <label className={s.field}>
        <span>{t.recoveryLabel}</span>
        <input autoFocus value={code} name="step-up-code" aria-invalid={note?.tone === 'error'} aria-describedby="step-up-error" disabled={locked}
          inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={16} placeholder="XXXX-XXXX"
          onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')); setNote(null) }} />
      </label>}
    {emailFirst ? <div className={x.msgSlot}>{message}</div> : message}
    {emailActive ? <div className={x.resend}>
      {wait > 0 ? <span>{e.resendIn(wait)}</span>
        : <button type="button" className={s.link} disabled={lock || mail.phase === 'sending'} onClick={() => void sendCode(true)}>{e.resend}</button>}
    </div> : active === 'totp' ? null : <button type="submit" className={s.cta} style={{ marginTop: 16 }} disabled={!valid || lock} aria-busy={busy}>
      <span>{busy ? t.verifying : active === 'passkey' ? t.passkeyCta : t.verify}</span>
      <span className={s.ctaIcon}>{active === 'passkey' ? <Fingerprint size={17} /> : <KeyRound size={17} />}</span>
    </button>}
    {emailFirst && alternatives.length > 0 && <div className={x.alt}>
      <small>{e.others}</small>
      <div className={x.altList}>{alternatives.map((item) => <button key={item} type="button" disabled={lock} onClick={() => pick(item)}>{label(item)}</button>)}</div>
    </div>}
  </form>
}
