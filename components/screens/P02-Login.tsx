'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ToastTone } from '@/lib/toast-tone'
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Fingerprint, LoaderCircle, Mail, Pencil, UserRound } from 'lucide-react'
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
import Onboarding from '@/components/onboarding/Onboarding'
import { usePaletteA } from '@/lib/palette-preview'
import { CodePad } from '@/components/maison/flow-kit'
import { paletteASlogan } from '@/lib/palette-a-copy'
import { InviteCodeField, useInviteCode } from './InviteCodeField'
import { AuthLegalFooter } from './AuthLegalFooter'
import controls from '../ui/controls.module.css'
import { connectLoginWallet, connectedWalletLink, openConnectedWallet } from '@/lib/api/wallet-connection'
import { APP_BROWSER_SIGN_IN_PATH, isAndroidApp } from '@/lib/android-app'

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
  notify: (message: string, tone?: ToastTone) => void
  onAuthenticated: () => void
}) {
  const { locale, t } = useI18n()
  const copy = authRouteCopy[locale]
  // Palette A preview: new brand line, and a first-run guide (replay with ?guide=1).
  const paletteA = usePaletteA()
  const [guide, setGuide] = useState(false)
  useEffect(() => {
    if (!paletteA) return
    let seen = false
    try { seen = localStorage.getItem('rwa.onboarded.v2') === '1' } catch { /* Show it again. */ }
    if (!seen || new URLSearchParams(location.search).has('guide')) setGuide(true)
  }, [paletteA])
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
  const invite = useInviteCode()
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
  const openWalletLabel = { 'zh-CN': '打开钱包确认', en: 'Open wallet to confirm', hi: 'पुष्टि के लिए वॉलेट खोलें', pt: 'Abrir carteira para confirmar', es: 'Abrir cartera para confirmar', fr: 'Ouvrir le portefeuille pour confirmer', ar: 'افتح المحفظة للتأكيد' }[locale]
  // The signature request travels over the relay but does not open a mobile wallet; bring it back to the front.
  useEffect(() => {
    if (walletPhase !== 'signing') return
    const timer = setTimeout(() => { openConnectedWallet() }, 600)
    return () => clearTimeout(timer)
  }, [walletPhase])
  useEffect(() => { void prefetchAuthAttribution() }, [])
  const [retryAfter, setRetryAfter] = useState(0)
  const [agreed, setAgreed] = useState(false)
  const [requirements, setRequirements] = useState<AuthConsentRequirements | null>(null)
  const [requirementsError, setRequirementsError] = useState('')
  const [requirementsAttempt, setRequirementsAttempt] = useState(0)
  const [walletChallenge, setWalletChallenge] = useState<WalletLoginChallenge | null>(null)
  const [codeChallenge, setCodeChallenge] = useState<EmailCodeChallenge | null>(null)
  const [code, setCode] = useState('')
  // The code is checked the moment the sixth digit lands: 'verified' shows the tick before the page changes, `shake` replays the wrong-code cue.
  const [codeState, setCodeState] = useState<'idle' | 'verified'>('idle')
  const [shake, setShake] = useState(0)
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
  // The address someone backed out of ("change email"): it must not reopen registration by itself until it is edited.
  const dismissed = useRef('')
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted || !oauthNavigationTimer.current) return
      clearTimeout(oauthNavigationTimer.current)
      oauthNavigationTimer.current = null
      setPending(false)
    }
    // Another app took over (system browser, provider app): the hand-off worked, so no timeout error on return.
    const handedOff = () => {
      if (document.visibilityState !== 'hidden' || !oauthNavigationTimer.current) return
      clearTimeout(oauthNavigationTimer.current)
      oauthNavigationTimer.current = null
      setPending(false)
    }
    window.addEventListener('pageshow', restore)
    document.addEventListener('visibilitychange', handedOff)
    return () => {
      window.removeEventListener('pageshow', restore)
      document.removeEventListener('visibilitychange', handedOff)
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

  // A valid invitation code sends the verification email by itself once the terms are accepted; once per code.
  const autoSent = useRef('')
  useEffect(() => {
    if (step !== 'new' || !account || invite.status !== 'valid' || !consentReady || pending || retryAfter > 0 || autoSent.current === invite.value) return
    autoSent.current = invite.value
    void run(async () => { if (await invite.commit()) await sendCode(account) })
  }, [step, account, invite.status, invite.value, consentReady, pending, retryAfter])

  // A complete address that belongs to no account opens registration by itself, so the invitation field appears
  // without another tap. Existing accounts keep the explicit continue: typing alone never sends a sign-in email.
  useEffect(() => {
    if (step !== 'email' || walletChallenge || pending || retryAfter > 0) return
    const value = email.trim()
    if (!EMAIL.test(value) || value.toLowerCase() === dismissed.current) return
    let active = true
    const timer = setTimeout(() => {
      void lookupEmail(value, 'silent').then(result => {
        if (!active || !result.ok || result.data.account !== 'new' || busy.current) return
        setAccount({ email: value, isNew: true, password: false, passkey: false }); setPassword(''); setAgreed(false); setStep('new')
      })
    }, 1500)
    return () => { active = false; clearTimeout(timer) }
  }, [email, step, walletChallenge, pending, retryAfter])

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
      // The invitation is recorded before the code is sent, so the account created on confirm binds it.
      if (retryAfter <= 0) await run(async () => { if (await invite.commit()) await sendCode(account) })
      return
    }
    await verifyCode(code)
  }

  // Runs on the sixth digit (typed, pasted or autofilled) and on Enter; there is no separate "continue" button for the code.
  const verifyCode = async (value: string) => {
    if (!account || !codeChallenge || pending || busy.current) return
    if (!/^\d{6}$/.test(value)) { setError(emailCopy.invalidCode); codeInput.current?.focus(); return }
    let accepted = false
    await run(async () => {
      // A new account continues to the set-password step; the mark survives that hop.
      markNewAccount(sessionStorage, account.isNew)
      const result = await confirmEmailCode(account.email, account.isNew ? 'register' : 'login', codeChallenge.challengeId, value)
      if (!result.ok) { showAuthError(result.error); return }
      accepted = true
      setCode(''); setCodeState('verified')
      await new Promise(resolve => setTimeout(resolve, 450))
      finish(account.isNew)
    })
    if (accepted) return
    // Wrong or expired code: clear the boxes, replay the cue and put the cursor back, ready for the next try.
    setCode(''); setCodeState('idle'); setShake(count => count + 1)
    window.setTimeout(() => codeInput.current?.focus({ preventScroll: true }), 0)
  }

  const sendAgain = () => { if (account && retryAfter <= 0) void run(() => sendCode(account)) }
  const usePasswordInstead = () => { stopPasskey(); setStep('password'); setCodeChallenge(null); setCode(''); setError('') }
  const changeEmail = () => {
    dismissed.current = (account?.email ?? email).trim().toLowerCase()
    restart()
    requestAnimationFrame(() => input.current?.focus())
  }

  // Providers start as sign-in for everyone: a first-time identity gets the terms step in the auth flow.
  const startProvider = async (provider: 'google' | 'github' | 'x') => {
    if (pending || busy.current) return
    stopPasskey()
    // Providers serve sign-in as well, so an empty code never blocks them; a typed one is recorded first.
    if (!(await invite.commit({ required: false }))) return
    // The Android app hands providers to the system browser, which signs in and returns the session to the app.
    if (isAndroidApp()) { setError(''); window.location.assign(`${APP_BROWSER_SIGN_IN_PATH}?provider=${provider}`); return }
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
      if (walletChallenge && !(await invite.commit())) return
      markNewAccount(sessionStorage, Boolean(walletChallenge))
      const result = await completeWalletLogin(started.data, walletChallenge ? consents : [], setWalletPhase)
      // Email binding happens in the signed-in account; preserve any required security steps.
      if (!result.ok) { if (continueAuth(result.error)) return; showAuthError(result.error); return }
      notify(copy.loginSuccess, 'ok')
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

  const cta = (label: string) => paletteA
    ? <><span>{label}</span><i className={controls.arrow} aria-hidden="true"><ArrowRight size={18} strokeWidth={1.7} /></i></>
    : <><span>{label}</span><span className={styles.ctaIcon} data-ready={Boolean(email.trim())} aria-hidden="true"><ArrowRight size={21} strokeWidth={1.6} /></span></>
  // Palette A: the shared controls (components/ui/controls.module.css) instead of the sign-in page's own.
  const ui = paletteA
    ? { field: controls.field, submit: controls.action, primary: `${controls.primary} ${styles.wide}`, method: controls.icon }
    : { field: `${styles.field} ${styles.emailField}`, submit: styles.inlineSubmit, primary: styles.primary, method: undefined }
  // The email step shows the poster title; every later step names where the lookup sent the user.
  // No ledes: the title, the address chip and the one action say enough.
  const poster = paletteA ? paletteASlogan(locale).lines : authPosterTitle[locale]
  const heading = walletChallenge || step === 'new' ? sheet.registerTitle : step === 'email' ? null : step === 'code' ? sheet.codeTitle : sheet.loginTitle
  const agreement = <label className={styles.agreement}>
    <input type="checkbox" checked={agreed} onChange={event => { setAgreed(event.target.checked); setError('') }} />
    <span>{visual.consentStart} <a href={termsHref} target="_blank" rel="noopener noreferrer">{visual.terms}</a> {visual.consentMiddle} <a href={privacyHref} target="_blank" rel="noopener noreferrer">{visual.privacy}</a> {visual.consentEnd}</span>
  </label>
  const errors = <>
    {error && <div role="alert" className={styles.error}><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>}
    {requirementsError && <div role="alert" className={styles.error}><AlertCircle size={16} aria-hidden="true" /><span>{requirementsError} <button type="button" onClick={() => setRequirementsAttempt(value => value + 1)}>{t('common.refresh')}</button></span></div>}
  </>
  // Required wherever an account is created (new-account step, wallet registration); hidden when a /r/ link carries the invitation.
  const inviteField = <div className={styles.inviteSlot}><InviteCodeField invite={invite} locale={locale} disabled={pending} /></div>
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
    <p className={styles.cardLede}>{paletteA ? paletteASlogan(locale).sub : authPosterIntro[locale]}</p>
  </>

  if (guide) return <Onboarding locale={locale} invite={invite} onDone={() => {
    try { localStorage.setItem('rwa.onboarded.v2', '1') } catch { /* Shown once per session then. */ }
    setGuide(false)
    requestAnimationFrame(() => input.current?.focus())
  }} />

  return <AuthShell attrs={{ 'data-auth-mode': mode, 'data-auth-step': walletChallenge ? 'wallet' : step, 'data-auth-compact': 'true', 'data-auth-poster': 'true' }} hero={posterHero} footer={footer}>
    <div className={styles.cardContent} key={walletChallenge ? 'wallet' : step}>
    {heading && <header className={styles.cardHead}>
      <h1 className={styles.cardTitle}>{heading}</h1>
    </header>}

    {walletChallenge ? <>
      {inviteField}
      <div className={styles.walletIdentity}><Image data-mono="" src="/auth/icon-wallet.svg" alt="" width={22} height={22} style={{ width: 22, height: 22 }} /><span>{walletChallenge.address.slice(0, 6)}…{walletChallenge.address.slice(-4)}</span></div>
      {agreement}
      {errors}
      <button className={ui.primary} type="button" disabled={pending || !agreed || !requirements} onClick={useWallet}>{cta(pending ? copy.sending : visual.wallet)}</button>
      <button className={styles.textLink} type="button" onClick={() => { setWalletChallenge(null); setAgreed(false); setError('') }}>{sheet.signIn}</button>
    </> : <form onSubmit={submit} noValidate aria-busy={pending}>
      {/* The poster's lead: one field, its confirm inside on the end edge. The lookup decides sign-in or registration. */}
      {step === 'email' ? <label className={ui.field}>
        <span className={styles.srOnly}>{visual.emailAddress}</span>
        <input ref={input} type="email" inputMode="email" placeholder={visual.emailAddress} autoComplete={autofill ? 'username webauthn' : 'username'} aria-invalid={Boolean(error)} value={email} onChange={event => { setEmail(event.target.value); setError('') }} disabled={pending} maxLength={254} autoCapitalize="none" spellCheck={false} enterKeyHint="go" dir="ltr" />
        <button type="submit" className={ui.submit} disabled={pending || retryAfter > 0} aria-label={pending ? pendingLabel : retryAfter > 0 ? cooldownLabel : sheet.continue} title={sheet.continue}>
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

      {step === 'new' && <>{inviteField}{agreement}</>}

      {/* Palette A: the code goes in on our keypad (Paste, clipboard pick-up, a switch back to the system keyboard). */}
      {step === 'code' && paletteA && <div key={shake} className={styles.kitCode}>
        <CodePad value={code} label={emailCopy.codeLabel} invalid={Boolean(error)} disabled={pending || codeState === 'verified'}
          onChange={next => { const digits = normalizeEmailCode(next); setCode(digits); setError(''); if (digits.length === 6) void verifyCode(digits) }} />
      </div>}
      {step === 'code' && !paletteA && <label key={shake} className={`${styles.field} ${styles.codeBox}`} data-state={codeState === 'verified' ? 'ok' : error ? 'error' : undefined}>
        <span className={styles.srOnly}>{emailCopy.codeLabel}</span>
        <input ref={codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} enterKeyHint="done" placeholder="000000" value={code} onChange={event => { const next = normalizeEmailCode(event.target.value); setCode(next); setError(''); if (next.length === 6) void verifyCode(next) }} aria-invalid={Boolean(error)} disabled={pending || codeState === 'verified'} dir="ltr" />
      </label>}
      {step === 'code' && (pending || codeState === 'verified') && <div className={styles.codeStatus} role="status" aria-live="polite" data-tone={codeState === 'verified' ? 'ok' : undefined}>
        {codeState === 'verified' ? <><Check size={16} strokeWidth={2.2} aria-hidden="true" />{copy.loginSuccess}</> : <><LoaderCircle className={styles.spinner} size={15} aria-hidden="true" />{emailCopy.verifying}</>}
      </div>}

      {errors}
      {step !== 'email' && step !== 'code' && <button className={ui.primary} type="submit" disabled={primaryDisabled}>
        {pending ? <><LoaderCircle className={styles.spinner} size={20} aria-hidden="true" /><span className={styles.srOnly}>{pendingLabel}</span></>
          : step === 'passkey' ? <><span>{primaryLabel}</span><span className={styles.ctaIcon} aria-hidden="true"><Fingerprint size={18} strokeWidth={1.8} /></span></>
          : cta(retryAfter > 0 ? cooldownLabel : primaryLabel)}
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
      <div className={paletteA ? styles.methodsA : styles.altMethods}>
        <button type="button" className={ui.method} disabled={pending} onClick={() => void startProvider('google')} aria-label={visual.google} title={visual.google}><Image src="/auth/icon-google-color.png" alt="" width={22} height={22} /></button>
        <button type="button" className={ui.method} disabled={pending} onClick={() => void startProvider('github')} aria-label="GitHub" title="GitHub"><Image data-mono="" src="/auth/icon-github.svg" alt="" width={22} height={22} /></button>
        <button type="button" className={ui.method} disabled={pending} onClick={useWallet} aria-label={visual.wallet} title={visual.wallet}><Image data-mono="" src="/auth/icon-wallet.svg" alt="" width={22} height={22} /></button>
        <button type="button" className={ui.method} disabled={pending || !passkeySupported} onClick={() => void usePasskey()} aria-label={passwordCopy.passkey} title={passkeySupported ? passwordCopy.passkey : passwordCopy.unsupported}><Fingerprint size={23} strokeWidth={1.6} aria-hidden="true" /></button>
      </div>
    </div>}
    {walletPhase && <p className={styles.hint} role="status" aria-live="polite">{walletProgress[['connecting', 'checking', 'signing', 'verifying'].indexOf(walletPhase)]}</p>}
    {walletPhase === 'signing' && connectedWalletLink() && <button type="button" className={styles.walletOpen} onClick={() => { openConnectedWallet() }}>{openWalletLabel}</button>}
    </div>
  </AuthShell>
}
