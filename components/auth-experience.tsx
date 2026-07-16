'use client'

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  FileCheck2,
  Gift,
  Globe2,
  IdCard,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  ScanFace,
  ShieldCheck,
  Upload,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useI18n } from '@/lib/i18n'
import { authFlowCopy, authText, type AuthFlowCopy } from '@/lib/auth-flow-copy'
import AnimatedBrand from './animated-brand'
import LanguageMenu from './language-menu'
import styles from './auth-experience.module.css'

export type AuthExperienceMode = 'welcome' | 'login' | 'register' | 'verify-email' | 'recovery' | 'kyc'

type AuthExperienceProps = {
  mode: AuthExperienceMode
  go: (screen: RwaScreen) => void
  notify: (message: string) => void
  onGuest?: () => void
  onAuthenticated?: () => void
}

type Provider = 'google' | 'x' | 'wallet' | null
type KycStage = 'intro' | 'document' | 'face' | 'eligibility' | 'complete'

const delay = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Spinner() {
  return <LoaderCircle className={styles.spinner} size={21} aria-hidden="true" />
}

function AuthShell({ children, mode }: { children: React.ReactNode; mode: AuthExperienceMode }) {
  return (
    <section className={`${styles.root} ${styles[`mode_${mode}`]}`} data-auth-mode={mode}>
      <div className={styles.starfield} aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      {children}
      <span className={styles.homeIndicator} aria-hidden="true" />
    </section>
  )
}

function GoogleMark() {
  return (
    <svg className={styles.providerMark} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3.1-4.3 3.1-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.6c-.9.6-2 1-3.5 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.4 14Z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.9.5 3.9 1.5l2.9-2.8A9.8 9.8 0 0 0 3.1 7.4l3.3 2.7C7.2 7.7 9.4 6 12 6Z" />
    </svg>
  )
}

function XMark() {
  return <span className={`${styles.providerMark} ${styles.xMark}`} aria-hidden="true">𝕏</span>
}

function AssetToken({ className, src, imageClass }: { className: string; src: string; imageClass?: string }) {
  return (
    <span className={`${styles.assetToken} ${className}`} aria-hidden="true">
      <span className={styles.assetTokenGlass}>
        <img className={imageClass ?? ''} src={src} alt="" />
        <i />
      </span>
    </span>
  )
}

function WelcomeExperience({ go, notify, onGuest }: Pick<AuthExperienceProps, 'go' | 'notify' | 'onGuest'>) {
  const { locale, t } = useI18n()
  const copy = authFlowCopy[locale]

  return (
    <AuthShell mode="welcome">
      <div className={styles.welcomeTop}>
        <LanguageMenu variant="wide" onChange={(label) => notify(authText(locale, 'languageSet', { label }) as string)} />
      </div>

      <div className={styles.constellation} aria-label={copy.networkIllustration}>
        <span className={`${styles.orbitLine} ${styles.orbitLineOne}`} />
        <span className={`${styles.orbitLine} ${styles.orbitLineTwo}`} />
        <span className={`${styles.orbitLine} ${styles.orbitLineThree}`} />
        <span className={`${styles.orbitDot} ${styles.dotOne}`} />
        <span className={`${styles.orbitDot} ${styles.dotTwo}`} />
        <span className={`${styles.orbitDot} ${styles.dotThree}`} />
        <span className={`${styles.orbitDot} ${styles.dotFour}`} />
        <AssetToken className={styles.assetCompute} src="/media/generated/project-assets/h100-inference-v1.png" />
        <AssetToken className={styles.assetProperty} src="/media/generated/project-assets/multifamily-refi-v1.png" />
        <AssetToken className={styles.assetTreasury} src="/media/generated/project-assets/rwa-collection-v1.png" imageClass={styles.assetCropTreasury} />
        <AssetToken className={styles.assetMarket} src="/media/generated/project-assets/markets-collection-v1.png" imageClass={styles.assetCropMarket} />
        <span className={styles.heroSphere}>
          <span className={styles.sphereHighlight} />
          <AnimatedBrand compact />
        </span>
        <span className={styles.heroPedestal}><i /><b /></span>
      </div>

      <div className={styles.welcomeCopy}>
        <h1>{t('auth.hero')}</h1>
        <p>{t('auth.body')}</p>
      </div>

      <div className={styles.welcomeActions}>
        <button className={`${styles.glassButton} ${styles.primaryLight}`} type="button" onClick={() => go('register')}>
          <span>{t('auth.start')}</span><ArrowRight size={24} />
        </button>
        <button className={`${styles.glassButton} ${styles.secondaryButton}`} type="button" onClick={() => { onGuest?.(); notify(copy.guestEnabled); go('home') }}>
          <span>{t('auth.guest')}</span><ArrowRight size={23} />
        </button>
      </div>
    </AuthShell>
  )
}

function AuthHeader({ onBack, backLabel }: { onBack?: () => void; backLabel: string }) {
  return (
    <div className={styles.authHeader}>
      {onBack ? <button className={styles.backButton} type="button" aria-label={backLabel} onClick={onBack}><ArrowLeft size={24} /></button> : <span className={styles.headerSpacer} />}
      <AnimatedBrand compact />
      <LanguageMenu />
    </div>
  )
}

function SignInExperience({ mode, go, notify, onAuthenticated }: AuthExperienceProps & { mode: 'login' | 'register' }) {
  const { locale, t } = useI18n()
  const copy = authFlowCopy[locale]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [pending, setPending] = useState(false)
  const [providerPending, setProviderPending] = useState<Provider>(null)
  const [error, setError] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setError('')
    setPending(false)
  }, [mode])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!emailPattern.test(email)) {
      setError(copy.invalidEmail)
      emailInput.current?.focus()
      return
    }
    if (mode === 'register' && password.length < 8) {
      setError(copy.shortPassword)
      return
    }
    if (mode === 'register' && !accepted) {
      setError(copy.acceptTermsError)
      return
    }
    setPending(true)
    await delay(850)
    setPending(false)
    if (mode === 'register') {
      window.sessionStorage.setItem('rwa-auth-email', email)
      notify(copy.verificationPrepared)
      go('verify-email')
      return
    }
    onAuthenticated?.()
    notify(copy.demoSession)
    go('home')
  }

  const runProvider = async (provider: Exclude<Provider, null>) => {
    setError('')
    setProviderPending(provider)
    await delay(950)
    setProviderPending(null)
    setError('OAuth and wallet sign-in require a configured provider and are unavailable in this local demo.')
  }

  return (
    <AuthShell mode={mode}>
      <div className={styles.signInArc} aria-hidden="true"><i /><b /></div>
      <AuthHeader onBack={() => go('welcome')} backLabel={copy.back} />

      <div className={styles.signInCopy}>
        <h1>{mode === 'login' ? t('auth.login') : t('auth.register')}</h1>
        <p>{mode === 'login' ? copy.loginBody : copy.registerBody}</p>
      </div>

      <form className={styles.authForm} onSubmit={submit} noValidate>
        <label className={`${styles.field} ${error && !emailPattern.test(email) ? styles.fieldError : ''}`}>
          <Mail size={22} aria-hidden="true" />
          <span className={styles.visuallyHidden}>{copy.email}</span>
          <input
            ref={emailInput}
            value={email}
            onChange={(event) => { setEmail(event.target.value); setError('') }}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={copy.email}
            aria-invalid={Boolean(error && !emailPattern.test(email))}
          />
        </label>

        {mode === 'register' && (
          <label className={styles.field}>
            <LockKeyhole size={21} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{copy.password}</span>
            <input
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError('') }}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={copy.createPassword}
            />
            <button className={styles.revealButton} type="button" aria-label={showPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </label>
        )}

        {error && <p className={styles.formError} role="alert"><AlertCircle size={16} />{error}</p>}

        {mode === 'register' && (
          <label className={styles.termsRow}>
            <input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); setError('') }} />
            <span><i><Check size={13} /></i>{copy.termsConsent}</span>
          </label>
        )}

        <button className={`${styles.glassButton} ${styles.emailButton}`} type="submit" disabled={pending || Boolean(providerPending)}>
          {pending ? <><Spinner /><span>{copy.securing}</span></> : <><Mail size={22} /><span>{mode === 'login' ? t('auth.email') : t('auth.register')}</span></>}
        </button>

        <button className={`${styles.glassButton} ${styles.providerButton}`} type="button" disabled={pending || Boolean(providerPending)} onClick={() => runProvider('google')}>
          {providerPending === 'google' ? <Spinner /> : <GoogleMark />}<span>{t('auth.google')}</span>
        </button>
        <button className={`${styles.glassButton} ${styles.providerButton}`} type="button" disabled={pending || Boolean(providerPending)} onClick={() => runProvider('x')}>
          {providerPending === 'x' ? <Spinner /> : <XMark />}<span>{t('auth.x')}</span>
        </button>
        <button className={`${styles.glassButton} ${styles.providerButton}`} type="button" disabled={pending || Boolean(providerPending)} onClick={() => runProvider('wallet')}>
          {providerPending === 'wallet' ? <Spinner /> : <WalletCards className={styles.providerMark} />}<span>{t('auth.wallet')}</span>
        </button>

        <button className={styles.inviteToggle} type="button" aria-expanded={inviteOpen} onClick={() => setInviteOpen((value) => !value)}>
          <Gift size={20} /><span>{copy.inviteCode}</span><ChevronDown size={16} />
        </button>
        {inviteOpen && (
          <label className={`${styles.field} ${styles.inviteField}`}>
            <KeyRound size={20} /><span className={styles.visuallyHidden}>{copy.inviteCode}</span>
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase().slice(0, 12))} placeholder="RWA-XXXX" autoComplete="off" />
          </label>
        )}

        <div className={styles.authFooterLinks}>
          {mode === 'login' ? (
            <><button type="button" onClick={() => go('recovery')}>{copy.needHelp}</button><button type="button" onClick={() => go('register')}>{copy.createAccount}</button></>
          ) : (
            <><span>{copy.alreadyAccount}</span><button type="button" onClick={() => go('login')}>{copy.signIn}</button></>
          )}
        </div>
      </form>
    </AuthShell>
  )
}

function CodeInput({ value, onChange, copy }: { value: string; onChange: (value: string) => void; copy: AuthFlowCopy }) {
  const hiddenInput = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.codeInput} role="group" aria-label={copy.codeGroup} onClick={() => hiddenInput.current?.focus()}>
      {Array.from({ length: 6 }, (_, index) => <span key={index} className={value.length === index ? styles.codeActive : ''}>{value[index] ?? ''}</span>)}
      <input
        ref={hiddenInput}
        className={styles.codeHidden}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={copy.verificationCode}
      />
    </div>
  )
}

function VerifyEmailExperience({ go, notify }: Pick<AuthExperienceProps, 'go' | 'notify'>) {
  const { locale } = useI18n()
  const copy = authFlowCopy[locale]
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(30)
  const [email, setEmail] = useState('alex@rwa.lat')

  useEffect(() => {
    setEmail(window.sessionStorage.getItem('rwa-auth-email') || 'alex@rwa.lat')
  }, [])

  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [remaining])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (code.length !== 6) {
      setError(copy.incompleteCode)
      return
    }
    setPending(true)
    setError('')
    await delay(800)
    if (code === '000000') {
      setPending(false)
      setError(copy.expiredCode)
      return
    }
    notify(copy.emailVerified)
    go('kyc')
  }

  return (
    <AuthShell mode="verify-email">
      <AuthHeader onBack={() => go('register')} backLabel={copy.back} />
      <div className={styles.verifyIllustration} aria-hidden="true">
        <span className={styles.mailOrb}><Mail size={39} /><i /></span>
        <span className={styles.verifyOrbit}><i /><i /><i /></span>
      </div>
      <div className={styles.flowCopy}>
        <p>{copy.secureSetup}</p>
        <h1>{copy.verifyEmail}</h1>
        <small>{copy.verifyEmailBody} <b>{email}</b>. {copy.verifyDemoHint}</small>
      </div>
      <form className={`${styles.flowCard} ${styles.liquidCard}`} onSubmit={submit}>
        <CodeInput value={code} copy={copy} onChange={(value) => { setCode(value); setError('') }} />
        {error && <p className={styles.formError} role="alert"><AlertCircle size={16} />{error}</p>}
        <button className={`${styles.glassButton} ${styles.emailButton}`} type="submit" disabled={pending}>
          {pending ? <><Spinner /><span>{copy.verifying}</span></> : <><ShieldCheck size={21} /><span>{copy.verifyContinue}</span><ArrowRight size={20} /></>}
        </button>
        <button className={styles.resendButton} type="button" disabled={remaining > 0} onClick={() => { setRemaining(30); setCode(''); setError(''); notify(copy.newCode) }}>
          {remaining > 0 ? authText(locale, 'resendIn', { seconds: remaining }) as string : copy.resendCode}
        </button>
      </form>
      <p className={styles.securityNote}><LockKeyhole size={15} />{copy.seedWarning}</p>
    </AuthShell>
  )
}

function RecoveryExperience({ go, notify }: Pick<AuthExperienceProps, 'go' | 'notify'>) {
  const { locale } = useI18n()
  const copy = authFlowCopy[locale]
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!emailPattern.test(email)) {
      setError(copy.invalidAccountEmail)
      return
    }
    setPending(true)
    setError('')
    await delay(850)
    setPending(false)
    setSent(true)
    notify(copy.recoveryRecorded)
  }

  return (
    <AuthShell mode="recovery">
      <AuthHeader onBack={() => go('login')} backLabel={copy.back} />
      <div className={styles.recoveryIcon} aria-hidden="true"><KeyRound size={38} /><i /></div>
      <div className={styles.flowCopy}>
        <p>{copy.protectedRecovery}</p>
        <h1>{copy.recoverAccess}</h1>
        <small>{copy.recoveryBody}</small>
      </div>
      <form className={`${styles.flowCard} ${styles.liquidCard}`} onSubmit={submit}>
        {sent ? (
          <div className={styles.successState} role="status">
            <CheckCircle2 size={38} /><h2>{copy.checkInbox}</h2><p>{authText(locale, 'inboxBody', { email }) as string}</p>
            <button className={`${styles.glassButton} ${styles.providerButton}`} type="button" onClick={() => go('login')}><ArrowLeft size={19} /><span>{copy.returnSignIn}</span></button>
          </div>
        ) : (
          <>
            <label className={styles.field}><AtSign size={21} /><span className={styles.visuallyHidden}>{copy.email}</span><input value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} type="email" autoComplete="email" placeholder={copy.accountEmail} /></label>
            {error && <p className={styles.formError} role="alert"><AlertCircle size={16} />{error}</p>}
            <button className={`${styles.glassButton} ${styles.emailButton}`} type="submit" disabled={pending}>{pending ? <><Spinner /><span>{copy.preparingRecovery}</span></> : <><KeyRound size={21} /><span>{copy.sendRecovery}</span></>}</button>
          </>
        )}
      </form>
    </AuthShell>
  )
}

function DigitalFace() {
  return (
    <span className={styles.particleFace} aria-hidden="true">
      <img className={styles.digitalHead} src="/media/kyc-digital-head.webp?v=wireframe" alt="" draggable={false} />
      <img className={`${styles.digitalHead} ${styles.digitalHeadScan}`} src="/media/kyc-digital-head.webp?v=wireframe" alt="" draggable={false} />
    </span>
  )
}

function PassportAndFace({ activeStage, scanning, copy }: { activeStage: number; scanning: boolean; copy: AuthFlowCopy }) {
  return (
    <div className={`${styles.kycVisual} ${scanning ? styles.isScanning : ''}`} aria-label={copy.kycIllustration}>
      <span className={styles.gridPlane} aria-hidden="true" />
      <span className={styles.passport} aria-hidden="true">
        <span className={styles.passportSpine} />
        <Globe2 className={styles.passportGlobe} size={74} strokeWidth={1.05} />
        <span className={styles.passportChip}><i /><i /><i /><i /></span>
        <span className={styles.passportTitle}>PASSPORT</span>
      </span>
      <DigitalFace />
      <span className={styles.scanCorners} aria-hidden="true"><i /><i /><i /><i /></span>
      <span className={styles.scanBeam} aria-hidden="true" />
      <span className={styles.visualStageBadge}>{activeStage === 1 ? copy.documentEncryption : activeStage === 2 ? copy.livenessAnalysis : copy.eligibilityDecision}</span>
    </div>
  )
}

function KycProgress({ current, complete, copy, locale }: { current: number; complete?: boolean; copy: AuthFlowCopy; locale: ReturnType<typeof useI18n>['locale'] }) {
  const steps = [copy.identityDocument, copy.faceVerification, copy.eligibilityCheck]
  return (
    <div className={styles.kycProgress} aria-label={authText(locale, 'stepOf', { current }) as string}>
      <p><b>{complete ? 3 : current}</b> / 3</p>
      <div className={styles.progressTrack}>
        {steps.map((label, index) => {
          const number = index + 1
          const isDone = complete || number < current
          const isActive = !complete && number === current
          return (
            <div key={label} className={`${styles.progressStep} ${isDone ? styles.progressDone : ''} ${isActive ? styles.progressActive : ''}`}>
              <span>{isDone ? <Check size={17} /> : number}</span><small>{label}</small>
              {number < 3 && <i />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KycExperience({ go, notify }: Pick<AuthExperienceProps, 'go' | 'notify'>) {
  const { locale } = useI18n()
  const copy = authFlowCopy[locale]
  const [stage, setStage] = useState<KycStage>('intro')
  const [documentType, setDocumentType] = useState('passport')
  const [fileName, setFileName] = useState('')
  const [pending, setPending] = useState(false)
  const [faceComplete, setFaceComplete] = useState(false)
  const [countryIndex, setCountryIndex] = useState(0)
  const [investorTypeIndex, setInvestorTypeIndex] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  const current = stage === 'face' ? 2 : stage === 'eligibility' || stage === 'complete' ? 3 : 1

  const uploadDocument = async () => {
    if (!fileName) {
      setError(copy.selectDocumentError)
      return
    }
    setPending(true)
    setError('')
    await delay(1100)
    setPending(false)
    setStage('face')
    notify(copy.documentValidated)
  }

  const runFaceScan = async () => {
    setPending(true)
    setError('')
    await delay(1650)
    setPending(false)
    setFaceComplete(true)
    notify(copy.livenessCompleted)
  }

  const submitEligibility = async () => {
    if (!confirmed) {
      setError(copy.confirmEligibilityError)
      return
    }
    setPending(true)
    setError('')
    await delay(1200)
    setPending(false)
    setStage('complete')
    notify(copy.reviewCompleted)
  }

  return (
    <AuthShell mode="kyc">
      <AuthHeader onBack={() => stage === 'intro' ? go('profile') : setStage(stage === 'document' ? 'intro' : stage === 'face' ? 'document' : 'face')} backLabel={copy.back} />
      <div className={styles.kycCopy}>
        <h1>{stage === 'complete' ? copy.identityVerified : copy.verifyIdentity}</h1>
        <p>{stage === 'complete' ? copy.investorReady : copy.firstInvestmentRequired}</p>
      </div>

      <PassportAndFace activeStage={current} scanning={pending && stage === 'face'} copy={copy} />
      <KycProgress current={current} complete={stage === 'complete'} copy={copy} locale={locale} />

      <div className={styles.kycActionArea}>
        {stage === 'intro' && (
          <>
            <button className={`${styles.glassButton} ${styles.kycPrimary}`} type="button" onClick={() => setStage('document')}><ShieldCheck size={23} /><span>{copy.startVerification}</span></button>
            <button className={`${styles.glassButton} ${styles.kycLater}`} type="button" onClick={() => go('home')}>{copy.notNow}</button>
            <p><LockKeyhole size={14} />{copy.demoPrivacy}</p>
          </>
        )}

        {stage === 'document' && (
          <div className={`${styles.kycPanel} ${styles.liquidCard}`}>
            <div className={styles.panelHeading}><IdCard size={21} /><span><b>{copy.chooseDocument}</b><small>{copy.documentGuidance}</small></span></div>
            <div className={styles.documentTypes}>
              {[['passport', copy.passport], ['identity card', copy.identityCard], ['driver licence', copy.driverLicence]].map(([value, label]) => <button key={value} type="button" className={documentType === value ? styles.selected : ''} onClick={() => setDocumentType(value)}>{label}</button>)}
            </div>
            <label className={styles.uploadZone}>
              <Upload size={23} /><span><b>{fileName || copy.uploadFront}</b><small>{copy.uploadRules}</small></span>
              <input type="file" accept="image/png,image/jpeg,image/heic" onChange={(event) => { setFileName(event.target.files?.[0]?.name || ''); setError('') }} />
            </label>
            {!fileName && <button className={styles.demoDocument} type="button" onClick={() => { setFileName('demo-passport-secure.jpg'); setError('') }}><FileCheck2 size={17} />{copy.useDemoPassport}</button>}
            {error && <p className={styles.formError} role="alert"><AlertCircle size={16} />{error}</p>}
            <button className={`${styles.glassButton} ${styles.kycPrimary}`} type="button" disabled={pending} onClick={uploadDocument}>{pending ? <><Spinner /><span>{copy.encryptingDocument}</span></> : <><span>{copy.continueFace}</span><ArrowRight size={20} /></>}</button>
          </div>
        )}

        {stage === 'face' && (
          <div className={`${styles.kycPanel} ${styles.liquidCard}`}>
            <div className={styles.panelHeading}><ScanFace size={22} /><span><b>{copy.faceVerification}</b><small>{copy.faceGuidance}</small></span></div>
            <div className={`${styles.cameraPreview} ${pending ? styles.cameraActive : ''} ${faceComplete ? styles.cameraComplete : ''}`}>
              <Camera size={31} /><span>{faceComplete ? copy.livenessConfirmed : pending ? copy.analysingMovement : copy.cameraReady}</span>{faceComplete && <CheckCircle2 size={21} />}
            </div>
            <ul className={styles.checkList}><li><Check size={14} />{copy.goodLighting}</li><li><Check size={14} />{copy.removeGlasses}</li><li><Check size={14} />{copy.keepSteady}</li></ul>
            <button className={`${styles.glassButton} ${styles.kycPrimary}`} type="button" disabled={pending} onClick={() => faceComplete ? setStage('eligibility') : runFaceScan()}>{pending ? <><Spinner /><span>{copy.runningLiveness}</span></> : faceComplete ? <><span>{copy.continueEligibility}</span><ArrowRight size={20} /></> : <><ScanFace size={21} /><span>{copy.beginFaceScan}</span></>}</button>
          </div>
        )}

        {stage === 'eligibility' && (
          <div className={`${styles.kycPanel} ${styles.liquidCard}`}>
            <div className={styles.panelHeading}><MapPin size={21} /><span><b>{copy.eligibilityCheck}</b><small>{copy.eligibilityBody}</small></span></div>
            <label className={styles.selectField}>{copy.countryResidence}<select value={countryIndex} onChange={(event) => setCountryIndex(Number(event.target.value))}>{copy.countries.map((label, index) => <option value={index} key={index}>{label}</option>)}</select></label>
            <label className={styles.selectField}>{copy.investorProfile}<select value={investorTypeIndex} onChange={(event) => setInvestorTypeIndex(Number(event.target.value))}>{copy.investorTypes.map((label, index) => <option value={index} key={index}>{label}</option>)}</select></label>
            <label className={styles.termsRow}><input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setError('') }} /><span><i><Check size={13} /></i>{copy.eligibilityConsent}</span></label>
            {error && <p className={styles.formError} role="alert"><AlertCircle size={16} />{error}</p>}
            <button className={`${styles.glassButton} ${styles.kycPrimary}`} type="button" disabled={pending} onClick={submitEligibility}>{pending ? <><Spinner /><span>{copy.reviewingEligibility}</span></> : <><ShieldCheck size={21} /><span>{copy.submitReview}</span></>}</button>
          </div>
        )}

        {stage === 'complete' && (
          <div className={`${styles.kycPanel} ${styles.completePanel} ${styles.liquidCard}`} role="status">
            <CheckCircle2 size={42} /><h2>{copy.verificationComplete}</h2><p>{copy.verificationCompleteBody}</p>
            <div className={styles.verificationMeta}><span>{copy.profile}<b>{copy.investorTypes[investorTypeIndex]}</b></span><span>{copy.residence}<b>{copy.countries[countryIndex]}</b></span><span>{copy.status}<b>{copy.verified}</b></span></div>
            <button className={`${styles.glassButton} ${styles.kycPrimary}`} type="button" onClick={() => go('home')}><span>{copy.enterApp}</span><ArrowRight size={20} /></button>
          </div>
        )}
      </div>
    </AuthShell>
  )
}

export default function AuthExperience({ mode, go, notify, onGuest, onAuthenticated }: AuthExperienceProps) {
  const keyedMode = useMemo(() => mode, [mode])
  if (keyedMode === 'welcome') return <WelcomeExperience go={go} notify={notify} onGuest={onGuest} />
  if (keyedMode === 'login' || keyedMode === 'register') return <SignInExperience mode={keyedMode} go={go} notify={notify} onAuthenticated={onAuthenticated} />
  if (keyedMode === 'verify-email') return <VerifyEmailExperience go={go} notify={notify} />
  if (keyedMode === 'recovery') return <RecoveryExperience go={go} notify={notify} />
  return <KycExperience go={go} notify={notify} />
}
