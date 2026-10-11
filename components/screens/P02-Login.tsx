'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Fingerprint, LoaderCircle, Mail, Pencil, UserRound } from 'lucide-react'
import Image from 'next/image'
import type { RwaScreen } from '@/lib/rwa-routes'
import {
  beginWalletLogin, completeWalletLogin, getAuthConsentRequirements, loginPassword, loginWithPasskey,
  startOAuth, type AuthConsent, type AuthConsentRequirements, type WalletLoginChallenge,
  confirmEmailCode, lookupEmail, requestEmailCode, type EmailCodeChallenge,
} from '@/lib/api/auth'
import { useI18n } from '@/lib/i18n'
import { authRouteCopy, interpolateRouteCopy } from '@/lib/route-copy'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { authSheetCopy, authPosterTitle, authPosterIntro } from '@/lib/maison-auth-copy'
import { authEmailCopy, normalizeEmailCode } from '@/lib/auth-email-copy'
import styles from './P02-Login.module.css'
import { authErrorMessage, isConsentError } from '@/lib/auth-error-copy'
import { prefetchAuthAttribution, type ApiError } from '@/lib/api/_http'
import { NEW_ACCOUNT_KEY, consumeAuthDestination, markNewAccount, markPasskeyOfferSeen, safeAuthReturnPath } from '@/lib/api/auth-navigation'
import { useUiLoading } from '@/lib/use-ui-loading'
import { continueAuth } from '@/lib/api/auth-flow'
import { authPasswordCopy } from '@/lib/auth-password-copy'
import { AuthShell } from './AuthShell'
import { AuthLegalFooter } from './AuthLegalFooter'
import { connectLoginWallet } from '@/lib/api/wallet-connection'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PENDING_CONSENTS = 'rwa.pending-consents'
const RETURN_TO = 'rwa.return-to'

// Email-first: the address decides the path before anything is sent.
//   existing + passkey → passkey prompt (password or email code on request)
//   existing + password → password (email code on request)
//   existing, no password → email code
//   new → terms, register code, then the set-password flow step
type Step = 'email' | 'passkey' | 'password' | 'new' | 'code'
// Conditional requests hold a server challenge that expires after five minutes; renew it before then.
const AUTOFILL_RENEW_MS = 270_000

function safeReturnTo(value: string | null): string | null {
  return safeAuthReturnPath(value, location.origin)
}

function acceptedConsents(requirements: AuthConsentRequirements | null): AuthConsent[] {
  if (!requirements || !['terms', 'privacy'].every(type => requirements.required.some(item => item.documentType === type))) return []
  return requirements.required.map(item => ({ documentType: item.documentType, version: item.version, accepted: true }))
}

export function LoginScreen({ mode, go, notify, onAuthenticated }: {
  mode: 'login' | 'register'
  go: (screen: RwaScreen) => void
  notify: (message: string) => void
  onAuthenticated: () => void
}) {
  const { locale, t } = useI18n()
  const copy = authRouteCopy[locale]
  const visual = authVisualCopy[locale]
  const sheet = authSheetCopy[locale]
  const emailCopy = authEmailCopy[locale]
  const passwordCopy = authPasswordCopy[locale]
  const [step, setStep] = useState<Step>('email')
  // The address the later steps act on, fixed when the lookup answers; editing it restarts at the email step.
  const [account, setAccount] = useState<{ email: string; isNew: boolean; password: boolean; passkey: boolean } | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passkeyPending, setPasskeyPending] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  // Saved passkeys appear in the email field's autofill; the fingerprint button is only the fallback.
  const [autofill, setAutofill] = useState(false)
  const [autofillRound, setAutofillRound] = useState(0)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [walletPhase, setWalletPhase] = useState<'connecting' | 'checking' | 'signing' | 'verifying' | null>(null)
  useUiLoading(pending && !passkeyPending && !walletPhase)
  const walletProgress = {
    'zh-CN': ['连接钱包…', '检查账户…', '请在钱包确认签名', '验证签名并登录…'],
    en: ['Connecting wallet…', 'Checking account…', 'Confirm the signature in your wallet', 'Verifying and signing in…'],
    hi: ['वॉलेट से जुड़ रहा है…', 'खाता जाँचा जा रहा है…', 'वॉलेट में हस्ताक्षर की पुष्टि करें', 'सत्यापन और लॉगिन जारी…'],
    pt: ['Conectando carteira…', 'Verificando conta…', 'Confirme a assinatura na carteira', 'Verificando e entrando…'],
    es: ['Conectando cartera…', 'Comprobando cuenta…', 'Confirma la firma en tu cartera', 'Verificando e iniciando sesión…'],
    fr: ['Connexion au portefeuille…', 'Vérification du compte…', 'Confirmez la signature dans votre portefeuille', 'Vérification et connexion…'],
    ar: ['جارٍ توصيل المحفظة…', 'جارٍ التحقق من الحساب…', 'أكد التوقيع في محفظتك', 'جارٍ التحقق وتسجيل الدخول…'],
  }[locale]
  useEffect(() => { void prefetchAuthAttribution() }, [])
  const [retryAfter, setRetryAfter] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [requirements, setRequirements] = useState<AuthConsentRequirements | null>(null)
  const [requirementsError, setRequirementsError] = useState('')
  const [requirementsAttempt, setRequirementsAttempt] = useState(0)
  const [walletChallenge, setWalletChallenge] = useState<WalletLoginChallenge | null>(null)
  const [codeChallenge, setCodeChallenge] = useState<EmailCodeChallenge | null>(null)
  const [code, setCode] = useState('')
  const [previousMode, setPreviousMode] = useState(mode)
  const input = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const cooldownDeadline = useRef(0)
  const oauthNavigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passkeyController = useRef<AbortController | null>(null)
  const autofillController = useRef<AbortController | null>(null)
  const autoPrompt = useRef(false)
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || !oauthNavigationTimer.current) return
      clearTimeout(oauthNavigationTimer.current)
      oauthNavigationTimer.current = null
      setPending(false)
    }
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pageshow', restore)
      if (oauthNavigationTimer.current) clearTimeout(oauthNavigationTimer.current)
    }
  }, [])

  // Login and register share one flow; switching route keeps the email but restarts at the first step.
  const restart = () => {
    setStep('email'); setAccount(null); setError(''); setAgreed(false); setWalletChallenge(null)
    setRequirementsError(''); setCodeChallenge(null); setCode(''); setPassword(''); setShowPassword(false)
  }
  if (previousMode !== mode) { setPreviousMode(mode); restart() }

  useEffect(() => {
    const supported = Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials)
    setPasskeySupported(supported)
    if (supported) void PublicKeyCredential.isConditionalMediationAvailable?.().then(setAutofill, () => setAutofill(false))
    const target = safeReturnTo(new URLSearchParams(location.search).get('returnTo'))
    if (target) sessionStorage.setItem(RETURN_TO, target)
    // Desktop gets the caret at once; on touch the keyboard would cover the poster before it is read.
    if (matchMedia('(pointer: fine)').matches) input.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus({ preventScroll: true })
    else if (step === 'password') passwordInput.current?.focus({ preventScroll: true })
  }, [step])

  // Autofill listens only while the email step is idle; any other request aborts it first.
  useEffect(() => {
    if (!autofill || step !== 'email' || walletChallenge || pending) return
    const controller = new AbortController()
    autofillController.current = controller
    const started = Date.now()
    const renew = setTimeout(() => { controller.abort(); setAutofillRound(value => value + 1) }, AUTOFILL_RENEW_MS)
    void loginWithPasskey({ mediation: 'conditional', signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      clearTimeout(renew)
      if (result.ok) { markPasskeyOfferSeen(sessionStorage); finish(false); return }
      // A dismissed prompt listens again; one rejected at once means autofill isn't really on offer here.
      if (result.error.code === 'PASSKEY_CANCELLED' && Date.now() - started > 2000) { setAutofillRound(value => value + 1); return }
      if (continueAuth(result.error)) return
      // Stop listening and fall back to the button; only a failed assertion is worth telling the user about.
      setAutofill(false)
      if (result.error.code === 'PASSKEY_VERIFICATION_FAILED' || (result.error.status >= 400 && result.error.status < 500 && result.error.status !== 429)) setError(passwordCopy.failed)
    })
    return () => { clearTimeout(renew); controller.abort() }
  }, [autofill, step, walletChallenge, pending, autofillRound])

  const needsConsent = step === 'new' || walletChallenge !== null
  useEffect(() => {
    if (!needsConsent) return
    let active = true
    void getAuthConsentRequirements().then(result => {
      if (!active) return
      if (result.ok) { setRequirements(result.data); setRequirementsError('') }
      else setRequirementsError(authErrorMessage(result.error, locale))
    })
    return () => { active = false }
  }, [needsConsent, requirementsAttempt, locale])

  const coolingDown = retryAfter > 0
  useEffect(() => {
    if (!coolingDown) return
    const timer = window.setInterval(() => setRetryAfter(Math.max(0, Math.ceil((cooldownDeadline.current - Date.now()) / 1000))), 1000)
    return () => window.clearInterval(timer)
  }, [coolingDown])

  const startCooldown = (seconds: number) => {
    cooldownDeadline.current = Date.now() + seconds * 1000
    setRetryAfter(seconds)
  }

  useEffect(() => () => { passkeyController.current?.abort(); autofillController.current?.abort() }, [])

  // Only one WebAuthn request may run at a time, so every new request aborts both.
  const stopPasskey = () => { passkeyController.current?.abort(); autofillController.current?.abort() }
  const consents = acceptedConsents(requirements)
  const termsHref = requirements?.required.find(item => item.documentType === 'terms')?.href ?? '/terms'
  const privacyHref = requirements?.required.find(item => item.documentType === 'privacy')?.href ?? '/privacy'
  const consentReady = agreed && consents.length >= 2

  // Account creation marks the tab so the first landing is the optional verification welcome.
  const finish = (isNew: boolean) => {
    markNewAccount(sessionStorage, isNew)
    onAuthenticated()
    location.replace(consumeAuthDestination(sessionStorage, location.origin))
  }

  // One guard for every request: no double submits, and the spinner covers the wait.
  const run = async (task: () => Promise<void>) => {
    if (pending || busy.current) return
    stopPasskey(); busy.current = true; setPending(true); setError('')
    try { await task() } finally { busy.current = false; setPending(false) }
  }

  const showAuthError = (failure: ApiError) => {
    if (continueAuth(failure)) return
    // Only a flow hand-off (e.g. set password) carries the new-account mark forward.
    markNewAccount(sessionStorage, false)
    if (failure.code === 'AUTH_PASSWORD_INVALID') { setError(passwordCopy.credentials); return }
    // The address was registered meanwhile (another tab or device): offer sign-in instead.
    if (failure.code === 'IDENTITY_EMAIL_TAKEN' && account) {
      setAccount({ ...account, isNew: false, password: true }); setStep('password'); setCodeChallenge(null); setCode('')
      return
    }
    setError(failure.code === 'AUTH_EMAIL_CODE_INVALID' ? emailCopy.invalidOrExpired : authErrorMessage(failure, locale))
    if (failure.retryAfter !== undefined) startCooldown(failure.retryAfter)
    if (isConsentError(failure)) {
      setAgreed(false)
      setRequirements(null)
      sessionStorage.removeItem(PENDING_CONSENTS)
      setRequirementsAttempt(value => value + 1)
      if (account?.isNew) { setStep('new'); setCodeChallenge(null); setCode('') }
    }
    if (/WALLET_NONCE_|INVALID_WALLET_SIGNATURE/.test(failure.code)) setWalletChallenge(null)
  }

  const sendCode = async (target: { email: string; isNew: boolean }) => {
    const result = await requestEmailCode(target.email, target.isNew ? 'register' : 'login', locale, target.isNew ? consents : [])
    if (!result.ok) { showAuthError(result.error); return }
    setCode(''); setCodeChallenge(result.data); setStep('code')
    startCooldown(result.data.retryAfter)
  }

  const identify = () => run(async () => {
    const value = email.trim()
    const result = await lookupEmail(value)
    if (!result.ok) { showAuthError(result.error); return }
    if (result.data.account === 'unavailable') { setError(sheet.unavailable); return }
    const next = { email: value, isNew: result.data.account === 'new', password: result.data.password, passkey: passkeySupported && result.data.passkey === true }
    setAccount(next); setPassword(''); setAgreed(false)
    if (next.isNew) setStep('new')
    // The account has a passkey: offer it straight away, scoped to this address.
    else if (next.passkey) { autoPrompt.current = true; setStep('passkey') }
    else if (next.password) setStep('password')
    // No password on file: the email code is the only way in, so send it straight away.
    else await sendCode(next)
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (step === 'email') {
      if (!EMAIL.test(email.trim())) { setError(copy.invalidEmail); input.current?.focus(); return }
      if (retryAfter <= 0) await identify()
      return
    }
    if (!account) return
    if (step === 'passkey') { await usePasskey(account.email); return }
    if (step === 'password') {
      if (!password) { setError(sheet.passwordRequired); passwordInput.current?.focus(); return }
      if (retryAfter > 0) return
      await run(async () => {
        // Leave any new-account mark alone: registration may hand back here after the password step.
        const result = await loginPassword(account.email, password)
        if (!result.ok) { showAuthError(result.error); return }
        setPassword('')
        if (account.passkey) markPasskeyOfferSeen(sessionStorage)
        finish(sessionStorage.getItem(NEW_ACCOUNT_KEY) === '1')
      })
      return
    }
    if (step === 'new') {
      if (!consentReady) { setError(visual.consentRequired); return }
      if (retryAfter <= 0) await run(() => sendCode(account))
      return
    }
    if (!codeChallenge) return
    if (!/^\d{6}$/.test(code)) { setError(emailCopy.invalidCode); codeInput.current?.focus(); return }
    await run(async () => {
      // A new account continues to the set-password step; the mark survives that hop.
      markNewAccount(sessionStorage, account.isNew)
      const result = await confirmEmailCode(account.email, account.isNew ? 'register' : 'login', codeChallenge.challengeId, code)
      if (!result.ok) { showAuthError(result.error); return }
      setCode('')
      notify(copy.loginSuccess)
      finish(account.isNew)
    })
  }

  const sendAgain = () => { if (account && retryAfter <= 0) void run(() => sendCode(account)) }
  const usePasswordInstead = () => { stopPasskey(); setStep('password'); setCodeChallenge(null); setCode(''); setError('') }
  const changeEmail = () => {
    restart()
    requestAnimationFrame(() => input.current?.focus())
  }

  // Providers start as sign-in for everyone: a first-time identity gets the terms step in the auth flow.
  const startProvider = async (provider: 'google' | 'github' | 'x') => {
    if (pending || busy.current) return
    stopPasskey()
    busy.current = true; setPending(true); setError('')
    markNewAccount(sessionStorage, false)
    const result = await startOAuth(provider, 'login', [])
    busy.current = false
    if (!result.ok) { setPending(false); showAuthError(result.error); return }
    oauthNavigationTimer.current = setTimeout(() => { setPending(false); setError(authErrorMessage({ code: 'REQUEST_TIMEOUT', status: 0 }, locale)) }, 20_000)
    window.location.assign(result.data)
  }

  const useWallet = () => {
    if (walletChallenge && !consentReady) { setError(visual.consentRequired); return }
    void run(async () => {
      setWalletPhase('connecting')
      try {
      let started: Awaited<ReturnType<typeof beginWalletLogin>>
      try {
        started = walletChallenge ? { ok: true as const, data: walletChallenge } : await beginWalletLogin(await connectLoginWallet())
      } catch (failure) {
        const code = typeof failure === 'object' && failure !== null && 'code' in failure ? String(failure.code) : 'WALLET_CONNECTION_FAILED'
        showAuthError({ status: 0, code, message: 'Wallet connection failed' })
        return
      }
      if (!started.ok) { showAuthError(started.error); return }
      if (started.data.registrationRequired && !walletChallenge) {
        setWalletChallenge(started.data)
        setAgreed(false)
        return
      }
      markNewAccount(sessionStorage, Boolean(walletChallenge))
      const result = await completeWalletLogin(started.data, walletChallenge ? consents : [], setWalletPhase)
      // Email binding happens in the signed-in account; preserve any required security steps.
      if (!result.ok) { if (continueAuth(result.error)) return; showAuthError(result.error); return }
      notify(copy.loginSuccess)
      finish(Boolean(walletChallenge))
      } finally { setWalletPhase(null) }
    })
  }

  const usePasskey = async (scope?: string) => {
    if (pending || busy.current) return
    stopPasskey()
    busy.current = true; setPending(true); setPasskeyPending(true); setError('')
    const controller = new AbortController()
    passkeyController.current = controller
    try {
      markNewAccount(sessionStorage, false)
      const result = await loginWithPasskey({ mediation: 'required', signal: controller.signal, email: scope })
      if (controller.signal.aborted) return
      if (!result.ok) {
        if (result.error.code === 'PASSKEY_CANCELLED') return
        if (continueAuth(result.error)) return
        setError(result.error.code === 'PASSKEY_UNSUPPORTED' ? passwordCopy.unsupported : passwordCopy.failed)
        return
      }
      markPasskeyOfferSeen(sessionStorage)
      finish(false)
    } finally { busy.current = false; setPending(false); setPasskeyPending(false) }
  }

  // Fires once per lookup. Browsers that demand a fresh tap (Safari) reject it quietly and the button stays.
  useEffect(() => {
    if (step !== 'passkey' || pending || !autoPrompt.current || !account) return
    autoPrompt.current = false
    void usePasskey(account.email)
  }, [step, pending])

  const cta = (label: string) => <><span>{label}</span><span className={styles.ctaIcon} data-ready={Boolean(email.trim())} aria-hidden="true"><ArrowRight size={21} strokeWidth={1.6} /></span></>
  // The email step shows the poster title; every later step names where the lookup sent the user.
  // No ledes: the title, the address chip and the one action say enough.
  const poster = authPosterTitle[locale]
  const heading = walletChallenge || step === 'new' ? sheet.registerTitle : step === 'email' ? null : step === 'code' ? sheet.codeTitle : sheet.loginTitle
  const agreement = <label className={styles.agreement}>
    <input type="checkbox" checked={agreed} onChange={event => { setAgreed(event.target.checked); setError('') }} />
    <span>{visual.consentStart} <a href={termsHref} target="_blank" rel="noopener noreferrer">{visual.terms}</a> {visual.consentMiddle} <a href={privacyHref} target="_blank" rel="noopener noreferrer">{visual.privacy}</a> {visual.consentEnd}</span>
  </label>
  const errors = <>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {requirementsError && <p role="alert" className={styles.error}>{requirementsError} <button type="button" onClick={() => setRequirementsAttempt(value => value + 1)}>{t('common.refresh')}</button></p>}
  </>
  const cooldownLabel = interpolateRouteCopy(copy.retryAfter, { seconds: retryAfter })

  // The address every later step acts on, with a way back to change it.
  const identity = account && <div className={styles.codeDelivery} role="status">
    {step === 'code' ? <Mail size={17} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />}
    <span><b dir="ltr">{account.email}</b></span>
    <button type="button" disabled={pending} aria-label={emailCopy.changeEmail} title={emailCopy.changeEmail} onClick={changeEmail}><Pencil size={16} aria-hidden="true" /></button>
  </div>

  const primaryLabel = step === 'email' ? sheet.continue : step === 'passkey' ? passwordCopy.passkey : step === 'password' ? passwordCopy.signIn : step === 'new' ? emailCopy.sendCode : emailCopy.verify
  const pendingLabel = step === 'email' ? sheet.checking : step === 'passkey' ? passwordCopy.passkey : step === 'code' ? emailCopy.verifying : copy.sending
  const primaryDisabled = pending
    || (step === 'code' ? code.length !== 6 : step !== 'passkey' && retryAfter > 0)
    || (step === 'new' && (!agreed || !requirements))

  const footer = <AuthLegalFooter
    termsHref={termsHref}
    privacyHref={privacyHref}
    termsVersion={requirements?.required.find(item => item.documentType === 'terms')?.version}
    privacyVersion={requirements?.required.find(item => item.documentType === 'privacy')?.version}
  />

  const posterHero = !heading && <>
    <h1 className={styles.cardTitle}>{poster[0]} <em>{poster[1]}</em></h1>
    <p className={styles.cardLede}>{authPosterIntro[locale]}</p>
  </>

  return <AuthShell attrs={{ 'data-auth-mode': mode, 'data-auth-step': walletChallenge ? 'wallet' : step, 'data-auth-compact': 'true', 'data-auth-poster': 'true' }} hero={posterHero} footer={footer}>
    <div className={styles.cardContent} key={walletChallenge ? 'wallet' : step}>
    {heading && <header className={styles.cardHead}>
      <h1 className={styles.cardTitle}>{heading}</h1>
    </header>}

    {walletChallenge ? <>
      <div className={styles.walletIdentity}><Image data-mono="" src="/auth/icon-wallet.svg" alt="" width={22} height={22} style={{ width: 22, height: 22 }} /><span>{walletChallenge.address.slice(0, 6)}…{walletChallenge.address.slice(-4)}</span></div>
      {agreement}
      {errors}
      <button className={styles.primary} type="button" disabled={pending || !agreed || !requirements} onClick={useWallet}>{cta(pending ? copy.sending : visual.wallet)}</button>
      <button className={styles.textLink} type="button" onClick={() => { setWalletChallenge(null); setAgreed(false); setError('') }}>{sheet.signIn}</button>
    </> : <form onSubmit={submit} noValidate aria-busy={pending}>
      {/* The poster's lead: one field, its confirm inside on the end edge. The lookup decides sign-in or registration. */}
      {step === 'email' ? <label className={`${styles.field} ${styles.emailField}`}>
        <span className={styles.srOnly}>{visual.emailAddress}</span>
        <input ref={input} type="email" inputMode="email" placeholder={visual.emailAddress} autoComplete={autofill ? 'username webauthn' : 'username'} aria-invalid={Boolean(error)} value={email} onChange={event => { setEmail(event.target.value); setError('') }} disabled={pending} maxLength={254} autoCapitalize="none" spellCheck={false} enterKeyHint="go" dir="ltr" />
        <button type="submit" className={styles.inlineSubmit} disabled={pending || retryAfter > 0} aria-label={pending ? pendingLabel : retryAfter > 0 ? cooldownLabel : sheet.continue} title={sheet.continue}>
          {pending ? <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
            : <span className={styles.inlineArrow} data-ready={EMAIL.test(email.trim())} aria-hidden="true"><ArrowRight size={19} strokeWidth={1.7} /></span>}
        </button>
      </label> : identity}
      {step === 'email' && retryAfter > 0 && <p className={styles.hint} role="status">{cooldownLabel}</p>}

      {step === 'password' && account && <div className={styles.field}>
        {/* Lets password managers pair the saved password with this address. */}
        <input type="email" name="username" autoComplete="username" value={account.email} readOnly hidden />
        <label className={styles.fieldLabel} htmlFor="auth-password">{passwordCopy.password}</label>
        <button type="button" className={styles.fieldAction} disabled={pending} onClick={() => go('recovery')}>{passwordCopy.forgot}</button>
        <input ref={passwordInput} id="auth-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" enterKeyHint="go" maxLength={128} value={password} onChange={event => { setPassword(event.target.value); setError('') }} aria-invalid={Boolean(error)} disabled={pending} dir="ltr" />
        <button type="button" className={styles.reveal} aria-label={showPassword ? sheet.hidePassword : sheet.showPassword} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button>
      </div>}

      {step === 'new' && agreement}

      {step === 'code' && <label className={`${styles.field} ${styles.codeBox}`}>
        <span className={styles.srOnly}>{emailCopy.codeLabel}</span>
        <input ref={codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} enterKeyHint="done" placeholder="000000" value={code} onChange={event => { setCode(normalizeEmailCode(event.target.value)); setError('') }} aria-invalid={Boolean(error)} disabled={pending} dir="ltr" />
      </label>}

      {errors}
      {step !== 'email' && <button className={styles.primary} type="submit" disabled={primaryDisabled}>
        {pending ? <><LoaderCircle className={styles.spinner} size={20} aria-hidden="true" /><span className={styles.srOnly}>{pendingLabel}</span></>
          : step === 'passkey' ? <><span>{primaryLabel}</span><span className={styles.ctaIcon} aria-hidden="true"><Fingerprint size={18} strokeWidth={1.8} /></span></>
          : cta(step !== 'code' && retryAfter > 0 ? cooldownLabel : primaryLabel)}
      </button>}

      {step === 'passkey' && <>
        {account?.password && <button className={styles.textLink} type="button" disabled={pending} onClick={usePasswordInstead}>{sheet.usePassword}</button>}
        <button className={styles.textLink} type="button" disabled={pending || retryAfter > 0} onClick={sendAgain}>{retryAfter > 0 ? cooldownLabel : sheet.useCode}</button>
      </>}

      {step === 'password' && <button className={styles.textLink} type="button" disabled={pending || retryAfter > 0} onClick={sendAgain}>{retryAfter > 0 ? cooldownLabel : sheet.useCode}</button>}
      {step === 'code' && <>
        <button className={styles.textLink} type="button" disabled={pending || retryAfter > 0} onClick={sendAgain}>{retryAfter > 0 ? cooldownLabel : emailCopy.resend}</button>
        {account?.password && <button className={styles.textLink} type="button" disabled={pending} onClick={usePasswordInstead}>{sheet.usePassword}</button>}
      </>}
    </form>}

    {/* Each icon reuses the existing sign-in handler; email autofill remains available. */}
    {!walletChallenge && step === 'email' && <div className={styles.otherMethods}>
      <div className={styles.altMethods}>
        <button type="button" disabled={pending} onClick={() => void startProvider('google')} aria-label={visual.google} title={visual.google}><Image src="/auth/icon-google-color.png" alt="" width={22} height={22} /></button>
        <button type="button" disabled={pending} onClick={() => void startProvider('github')} aria-label="GitHub" title="GitHub"><Image data-mono="" src="/auth/icon-github.svg" alt="" width={22} height={22} /></button>
        <button type="button" disabled={pending} onClick={useWallet} aria-label={visual.wallet} title={visual.wallet}><Image data-mono="" src="/auth/icon-wallet.svg" alt="" width={22} height={22} /></button>
        <button type="button" disabled={pending || !passkeySupported} onClick={() => void usePasskey()} aria-label={passwordCopy.passkey} title={passkeySupported ? passwordCopy.passkey : passwordCopy.unsupported}><Fingerprint size={23} strokeWidth={1.6} aria-hidden="true" /></button>
      </div>
    </div>}
    {walletPhase && <p className={styles.hint} role="status" aria-live="polite">{walletProgress[['connecting', 'checking', 'signing', 'verifying'].indexOf(walletPhase)]}</p>}
    </div>
  </AuthShell>
}
