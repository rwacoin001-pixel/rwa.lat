'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Loader2, Mail } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { normalizeEmailCode } from '@/lib/auth-email-copy'
import type { ApiError } from '@/lib/api/_http'
import {
  bindingAfterSend, bindingAfterStart, classifyBindError, clearBinding, clearOtherBindings, completeEmailBind, isPlausibleEmail,
  loadBinding, resendEmailBindCode, resendWait, saveBinding, sendEmailBindCode, startEmailBind, type StoredBinding,
} from '@/lib/api/email-binding'
import { homeEmailBindingCopy } from '@/lib/home-email-binding-copy'
import styles from './home-email-binding.module.css'

const FOCUS_EVENT = 'rwa:home-email-binding-focus'

/** Lets the Home status CTA bring the user to the in-place slot instead of leaving the page. */
export function focusHomeEmailBinding() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FOCUS_EVENT))
}

type Step = 'idle' | 'email' | 'code' | 'done'
type Busy = 'start' | 'send' | 'resend' | 'verify'
type Message = { kind: 'info' | 'error'; text: string } | null

export function HomeEmailBinding({ userId, onVerified }: { userId: string; onVerified: () => void }) {
  const { locale } = useI18n()
  const copy = homeEmailBindingCopy[locale]
  const [step, setStep] = useState<Step>('idle')
  const [flow, setFlow] = useState<StoredBinding | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<Busy | null>(null)
  const [message, setMessage] = useState<Message>(null)
  const [now, setNow] = useState(() => Date.now())
  const [ring, setRing] = useState(false)
  const busyRef = useRef<Busy | null>(null)
  const aliveRef = useRef(true)
  const touchedRef = useRef(false)
  const onVerifiedRef = useRef(onVerified)
  const wrapRef = useRef<HTMLDivElement>(null)
  const bindRef = useRef<HTMLButtonElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const ringTimer = useRef(0)
  const ids = useId()
  const messageId = `${ids}-msg`
  const errorId = `${ids}-err`
  onVerifiedRef.current = onVerified

  useEffect(() => {
    aliveRef.current = true
    clearOtherBindings(userId)
    const saved = loadBinding(userId)
    if (saved) { setFlow(saved); setStep(saved.sent ? 'code' : 'email') }
    return () => { aliveRef.current = false; window.clearTimeout(ringTimer.current) }
  }, [userId])

  useEffect(() => {
    if (step === 'idle' || step === 'done') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [step])

  useEffect(() => {
    if (!flow || now < flow.expiresAt) return
    clearBinding(userId)
    setFlow(null)
    if (step === 'email' || step === 'code') { setStep('email'); setCode(''); setMessage({ kind: 'error', text: copy.errors.expired }) }
  }, [flow, now, step, userId, copy.errors.expired])

  useEffect(() => {
    if (!touchedRef.current) return
    ;({ idle: bindRef, email: emailRef, code: codeRef, done: null })[step]?.current?.focus()
  }, [step])

  const commit = (next: StoredBinding | null) => {
    setFlow(next)
    if (next) saveBinding(userId, next); else clearBinding(userId)
  }

  const fail = (error: ApiError, current: StoredBinding | null) => {
    const kind = classifyBindError(error)
    if (kind === 'expired') { commit(null); setStep('email'); setCode('') }
    if (kind === 'rateLimited' && current) commit({ ...current, resendAt: Date.now() + (error.retryAfter ?? 60) * 1000 })
    setMessage({ kind: 'error', text: copy.errors[kind] })
    if (kind === 'invalidCode') codeRef.current?.focus()
    if (kind === 'taken' || kind === 'invalidEmail') emailRef.current?.focus()
  }

  const finish = () => {
    clearBinding(userId)
    setFlow(null); setCode(''); setEmail(''); setMessage(null); setStep('done')
    onVerifiedRef.current()
  }

  const run = async (kind: Busy, task: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = kind
    setBusy(kind); setMessage(null)
    try { await task() } finally {
      busyRef.current = null
      if (aliveRef.current) setBusy(null)
    }
  }

  const validFlow = () => (flow && flow.expiresAt > Date.now() ? flow : null)

  const open = () => {
    touchedRef.current = true
    if (validFlow()) { setStep(flow?.sent ? 'code' : 'email'); return }
    void run('start', async () => {
      const result = await startEmailBind(userId)
      if (!aliveRef.current) return
      if (!result.ok) return fail(result.error, null)
      if (result.data.verified) return finish()
      commit(bindingAfterStart(result.data, Date.now()))
      setStep('email')
    })
  }

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current) return
    const value = email.trim()
    if (!isPlausibleEmail(value)) { setMessage({ kind: 'error', text: copy.errors.invalidEmail }); emailRef.current?.focus(); return }
    if (resendWait(flow, Date.now()) > 0) { setMessage({ kind: 'error', text: copy.errors.rateLimited }); return }
    void run('send', async () => {
      let current = validFlow()
      if (!current) {
        const started = await startEmailBind(userId)
        if (!aliveRef.current) return
        if (!started.ok) return fail(started.error, null)
        if (started.data.verified) return finish()
        current = bindingAfterStart(started.data, Date.now())
        commit(current)
      }
      const result = await sendEmailBindCode(current.continuationToken, value, userId)
      if (!aliveRef.current) return
      if (!result.ok) return fail(result.error, current)
      commit(bindingAfterSend(result.data, Date.now()))
      setEmail(''); setCode('')
      setStep('code')
    })
  }

  const resend = () => {
    const current = validFlow()
    if (!current || busyRef.current || resendWait(current, Date.now()) > 0) return
    void run('resend', async () => {
      const result = await resendEmailBindCode(current.continuationToken, userId)
      if (!aliveRef.current) return
      if (!result.ok) return fail(result.error, current)
      commit({ ...current, resendAt: Date.now() + result.data.retryAfter * 1000 })
      setMessage({ kind: 'info', text: copy.resent })
    })
  }

  const verify = (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current) return
    const value = normalizeEmailCode(code)
    if (value.length !== 6) { setMessage({ kind: 'error', text: copy.errors.codeFormat }); codeRef.current?.focus(); return }
    const current = validFlow()
    if (!current) { commit(null); setStep('email'); setCode(''); setMessage({ kind: 'error', text: copy.errors.expired }); return }
    void run('verify', async () => {
      const result = await completeEmailBind(current.continuationToken, value, userId)
      if (!aliveRef.current) return
      if (!result.ok) return fail(result.error, current)
      finish()
    })
  }

  const back = () => {
    if (busyRef.current) return
    setMessage(null); setCode('')
    if (step === 'code' && flow) { commit({ ...flow, sent: false }); setStep('email') } else setStep('idle')
  }

  useEffect(() => {
    const focusSlot = () => {
      wrapRef.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      setRing(true)
      window.clearTimeout(ringTimer.current)
      ringTimer.current = window.setTimeout(() => setRing(false), 1400)
      if (step === 'idle') open()
      else if (step === 'email') emailRef.current?.focus()
      else if (step === 'code') codeRef.current?.focus()
    }
    window.addEventListener(FOCUS_EVENT, focusSlot)
    return () => window.removeEventListener(FOCUS_EVENT, focusSlot)
  })

  const keepInputVisible = (input: HTMLInputElement) => {
    window.setTimeout(() => input.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 90)
  }

  const error = message?.kind === 'error' ? message.text : null
  const wait = resendWait(flow, now)
  const sentTo = step === 'code' && flow?.emailMasked ? copy.sentTo.replace('{email}', flow.emailMasked) : ''
  const info = busy === 'send' || busy === 'start' || busy === 'resend' ? copy.sending : busy === 'verify' ? copy.verifying : (!error && message?.text) || sentTo
  const tail = step === 'code' && !busy && (wait > 0
    ? <em>{copy.resendIn.replace('{s}', new Intl.NumberFormat(locale).format(wait))}</em>
    : <button type="button" className={styles.linkBtn} onClick={resend}>{copy.resend}</button>)
  const label = step === 'email' ? copy.getCode : copy.verify
  const describedBy = error ? errorId : messageId

  return <div className={styles.wrap} ref={wrapRef} data-ring={ring}>
    {step === 'done' ? <div className={styles.slot} role="status">
      <span className={styles.okDot}><Check size={12} strokeWidth={2.6} aria-hidden="true" /></span>
      <span className={styles.slotText}>{copy.verified}</span>
    </div> : step === 'idle' ? <div className={styles.slot}>
      <Mail size={16} strokeWidth={1.7} aria-hidden="true" />
      <span className={styles.slotText}>{copy.unverified}</span>
      <button type="button" className={styles.slotBtn} ref={bindRef} onClick={open} aria-busy={busy === 'start'} aria-disabled={busy === 'start'}>{busy === 'start' ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : copy.bind}</button>
    </div> : <form className={`${styles.slot} ${styles.form}`} noValidate onSubmit={step === 'email' ? send : verify} onKeyDown={event => { if (event.key === 'Escape') back() }}>
      <button type="button" className={styles.slotIcon} onClick={back} aria-label={step === 'email' ? copy.back : copy.changeEmail}><ArrowLeft size={16} aria-hidden="true" /></button>
      {step === 'email' ? <>
        <label className={styles.sr} htmlFor={`${ids}-email`}>{copy.emailLabel}</label>
        <input id={`${ids}-email`} ref={emailRef} className={styles.slotInput} dir="ltr" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254}
          placeholder={copy.emailPlaceholder} value={email} readOnly={Boolean(busy)} aria-invalid={Boolean(error)} aria-describedby={describedBy}
          onFocus={event => keepInputVisible(event.currentTarget)} onChange={event => { setEmail(event.target.value); if (error) setMessage(null) }} />
      </> : <>
        <label className={styles.sr} htmlFor={`${ids}-code`}>{copy.codeLabel}</label>
        <input id={`${ids}-code`} ref={codeRef} className={`${styles.slotInput} ${styles.code}`} dir="ltr" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}
          placeholder={copy.codePlaceholder} value={code} readOnly={Boolean(busy)} aria-invalid={Boolean(error)} aria-describedby={describedBy}
          onFocus={event => keepInputVisible(event.currentTarget)} onChange={event => { setCode(normalizeEmailCode(event.target.value)); if (error) setMessage(null) }} />
      </>}
      <button type="submit" className={`${styles.slotBtn} ${styles.pill}`} aria-label={label} aria-busy={Boolean(busy)} aria-disabled={Boolean(busy)}>{busy ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : label}</button>
    </form>}
    <div id={messageId} className={styles.msg} role="status" hidden={Boolean(error) || (!info && !tail)}><span className={styles.msgText}>{info}</span>{tail}</div>
    {error && <div id={errorId} className={`${styles.msg} ${styles.err}`} role="alert"><span className={styles.msgText}>{error}</span>{tail}</div>}
  </div>
}
