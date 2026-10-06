'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { authSheetCopy } from '@/lib/maison-auth-copy'
import { authPasswordCopy } from '@/lib/auth-password-copy'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { readAuthFlow, clearAuthFlow, completeAuthFlow, resendAuthFlow, continueAuth, patchAuthFlow, submitAuthFlowEmail, type AuthFlow } from '@/lib/api/auth-flow'
import { getAuthConsentRequirements, type AuthConsentRequirements } from '@/lib/api/auth'
import { clearSession, saveSession } from '@/lib/api/_http'
import { consumeAuthDestination, markNewAccount } from '@/lib/api/auth-navigation'
import { authErrorMessage } from '@/lib/auth-error-copy'
import styles from '@/components/screens/P02-Login.module.css'
import flowStyles from '@/components/screens/P03-AuthFlow.module.css'
import { AuthShell } from '@/components/screens/AuthShell'

export default function ContinueAuthPage() {
  const { locale } = useI18n()
  const t = authPasswordCopy[locale], visual = authVisualCopy[locale], sheet = authSheetCopy[locale]
  const [flow, setFlow] = useState<AuthFlow | null>(null)
  const [ready, setReady] = useState(false)
  const [value, setValue] = useState(''), [repeat, setRepeat] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [show, setShow] = useState(false)
  const [requirements, setRequirements] = useState<AuthConsentRequirements | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0), [attempt, setAttempt] = useState(0)
  const [address, setAddress] = useState(''), [entered, setEntered] = useState(false)
  const locked = useRef(false)
  useEffect(() => { const saved = readAuthFlow(); setFlow(saved); setRetry(saved?.retryAfter ?? 0); setReady(true) }, [])
  useEffect(() => {
    if (flow?.step !== 'consent') return
    let active = true
    void getAuthConsentRequirements().then(result => {
      if (!active) return
      if (result.ok) setRequirements(result.data)
      else setError(authErrorMessage(result.error, locale))
    })
    return () => { active = false }
  }, [flow?.step, locale, attempt])
  useEffect(() => {
    if (retry <= 0) return
    const timer = setTimeout(() => setRetry(retry - 1), 1000)
    return () => clearTimeout(timer)
  }, [retry])
  const password = flow?.step === 'password'
  // GitHub / wallet accounts without an email on file add one here before the code step.
  const needsEmail = flow?.step === 'email' && flow.emailRequired === true
  const label = password ? sheet.setupTitle : needsEmail ? t.addEmail : flow?.step === 'consent' ? t.consent : flow?.step === 'totp' ? t.totp : t.emailCode
  const lede = password ? sheet.setupLede : needsEmail ? t.addEmailLede : flow?.step === 'email' && flow.email ? t.sentTo.replace('{email}', flow.email) : ''
  const sendEmail = async () => {
    if (!flow) return
    const email = address.trim()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t.badEmail); return }
    locked.current = true; setBusy(true); setError('')
    try {
      const result = await submitAuthFlowEmail(flow, email)
      if (!result.ok) {
        if (continueAuth(result.error)) return
        setError(result.error.code === 'AUTH_FLOW_INVALID' ? t.expired : authErrorMessage(result.error, locale))
        if (result.error.code === 'AUTH_FLOW_INVALID') { clearAuthFlow(); setFlow(null) }
        return
      }
      const patch = { emailRequired: false, email: result.data.email ?? email, retryAfter: result.data.retryAfter }
      patchAuthFlow(patch)
      setFlow({ ...flow, ...patch }); setRetry(result.data.retryAfter); setValue(''); setEntered(true)
    } finally { locked.current = false; setBusy(false) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!flow || locked.current) return
    if (needsEmail) { await sendEmail(); return }
    if (password && (value.length < 12 || value.length > 128)) { setError(t.policy); return }
    if (password && value !== repeat) { setError(t.mismatch); return }
    locked.current = true; setBusy(true); setError('')
    try {
      const result = await completeAuthFlow(flow, password ? { password: value } : flow.step === 'consent'
        ? { consents: requirements?.required.map(item => ({ documentType: item.documentType, version: item.version, accepted: true })) }
        : { code: value })
      if (!result.ok) {
        if (continueAuth(result.error)) return
        setError(result.error.code === 'AUTH_CODE_INVALID' ? t.invalid : result.error.code === 'AUTH_FLOW_INVALID' ? t.expired : result.error.code === 'AUTH_PASSWORD_POLICY' ? t.policy : authErrorMessage(result.error, locale))
        if (result.error.code === 'AUTH_FLOW_INVALID') { clearAuthFlow(); setFlow(null) }
        if (result.error.code.includes('CONSENT')) { setAgreed(false); setRequirements(null); setAttempt(n => n + 1) }
        return
      }
      // New OAuth users have finished registration here and go straight home.
      if (flow.step === 'consent') markNewAccount(sessionStorage, false)
      clearAuthFlow()
      setValue(''); setRepeat('')
      if (result.data.requiresLogin) { clearSession(); window.location.replace('/login'); return }
      if (!result.data.token) { setError(t.failed); return }
      saveSession(result.data.token, { userId: result.data.userId, sessionId: result.data.sessionId })
      const oauth = sessionStorage.getItem('rwa.auth-oauth') === '1'
      sessionStorage.removeItem('rwa.auth-oauth')
      if (flow.step === 'consent') {
        sessionStorage.removeItem('rwa.return-to')
        consumeAuthDestination(sessionStorage, location.origin, oauth, true)
        window.location.replace('/home')
      } else window.location.replace(consumeAuthDestination(sessionStorage, location.origin, oauth))
    } finally { locked.current = false; setBusy(false) }
  }
  const resend = async () => {
    if (!flow || locked.current || retry > 0) return
    locked.current = true; setBusy(true); setError('')
    try { const result = await resendAuthFlow(flow); if (result.ok) setRetry(result.data.retryAfter); else setError(authErrorMessage(result.error, locale)) }
    finally { locked.current = false; setBusy(false) }
  }
  const lengthOk = value.length >= 12 && value.length <= 128
  const matchOk = Boolean(repeat) && value === repeat
  const reveal = <button type="button" className={styles.reveal} aria-label={show ? sheet.hidePassword : sheet.showPassword} aria-pressed={show} onClick={() => setShow(v => !v)}>{show ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
  return <AuthShell>
    {ready && !flow ? <p role="alert" className={styles.error}>{t.expired}</p> : <form onSubmit={submit} aria-busy={busy}>
      <header className={styles.cardHead}>
        <h1 className={styles.cardTitle}>{label}</h1>
        {lede && <p className={styles.cardLede}>{lede}</p>}
      </header>
      {needsEmail ? <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="flow-email">{t.addEmail}</label>
        <input id="flow-email" value={address} onChange={e => { setAddress(e.target.value); setError('') }} type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" maxLength={254} disabled={busy} dir="ltr" autoFocus />
      </div> : flow?.step === 'consent' ? <label className={styles.agreement}><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} /><span>{visual.consentStart} <a href={requirements?.required.find(i => i.documentType === 'terms')?.href ?? '/terms'} target="_blank" rel="noopener noreferrer">{visual.terms}</a> {visual.consentMiddle} <a href={requirements?.required.find(i => i.documentType === 'privacy')?.href ?? '/privacy'} target="_blank" rel="noopener noreferrer">{visual.privacy}</a> {visual.consentEnd}</span></label> : password ? <>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="new-password">{t.newPassword}</label>
          <input id="new-password" value={value} onChange={e => { setValue(e.target.value); setError('') }} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••••••" maxLength={128} disabled={busy} dir="ltr" />
          {reveal}
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="repeat-password">{t.repeat}</label>
          <input id="repeat-password" value={repeat} onChange={e => { setRepeat(e.target.value); setError('') }} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••••••" maxLength={128} disabled={busy} dir="ltr" />
        </div>
        <ul className={styles.rules} aria-live="polite">
          <li data-met={lengthOk}><Check size={13} strokeWidth={2.2} aria-hidden="true" />{sheet.ruleLength}</li>
          <li data-met={matchOk}><Check size={13} strokeWidth={2.2} aria-hidden="true" />{sheet.ruleMatch}</li>
        </ul>
      </> : <label className={`${styles.field} ${styles.codeBox}`}>
        <span className={styles.srOnly}>{label}</span>
        <input value={value} onChange={e => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))} type="text" autoComplete="one-time-code" inputMode="numeric" placeholder="000000" maxLength={6} disabled={busy} dir="ltr" />
      </label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {flow?.step === 'consent' && !requirements && error && <button type="button" className={styles.textLink} onClick={() => setAttempt(n => n + 1)}>{t.retry}</button>}
      <button className={styles.primary} disabled={!flow || busy || (needsEmail ? !address.trim() : flow.step === 'consent' ? !agreed || !requirements : password ? !lengthOk || !matchOk : value.length !== 6)}>{busy ? <LoaderCircle size={20} className={styles.spinner} aria-label={t.confirm} /> : <span>{t.confirm}</span>}</button>
      {flow?.step === 'email' && !needsEmail && <button className={styles.textLink} type="button" disabled={busy || retry > 0} onClick={() => void resend()}>{retry > 0 ? `${retry}s` : t.resend}</button>}
      {flow?.step === 'email' && !needsEmail && entered && <button className={styles.textLink} type="button" disabled={busy} onClick={() => { setFlow({ ...flow, emailRequired: true }); patchAuthFlow({ emailRequired: true }); setValue(''); setError('') }}>{t.changeEmail}</button>}
    </form>}
    <footer className={flowStyles.footer}><button type="button" onClick={() => { clearAuthFlow(); sessionStorage.removeItem('rwa.auth-oauth'); window.location.assign('/login') }}><ArrowLeft size={15} aria-hidden="true" />{t.back}</button></footer>
  </AuthShell>
}
