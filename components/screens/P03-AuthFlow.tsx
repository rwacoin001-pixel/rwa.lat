'use client'
import { consumeAuthDestination, markNewAccount } from '@/lib/api/auth-navigation'
import { continueAuth } from '@/lib/api/auth-flow'
import { useUiLoading } from '@/lib/use-ui-loading'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { confirmRecovery, registerEmail, requestRecovery, verifyEmail, type AuthConsent } from '@/lib/api/auth'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { authRouteCopy, interpolateRouteCopy } from '@/lib/route-copy'
import { authVisualCopy } from '@/lib/auth-visual-copy'
import { authErrorMessage, isConsentError } from '@/lib/auth-error-copy'
import styles from './P02-Login.module.css'
import flow from './P03-AuthFlow.module.css'
import { AuthShell } from './AuthShell'
import { getSessionToken } from '@/lib/api/_http'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const authFlowCopy: Record<AppLocale, { security: string; recoverTitle: string; verifyTitle: string; recoverBody: string; verifyBody: string; done: string; processing: string; resend: string; send: string; sentPrefix: string; recovered: string; verified: string }> = {
  en: { security: 'SECURITY CHECK', recoverTitle: 'Recover account', verifyTitle: 'Verify email', recoverBody: 'Enter your account email and we will send a recovery link.', verifyBody: 'Open the link in your email to verify your address.', done: 'Verification complete. Taking you home…', processing: 'Processing…', resend: 'Resend email', send: 'Send email', sentPrefix: 'Verification email sent to', recovered: 'Account recovered', verified: 'Email verified' },
  'zh-CN': { security: '安全验证', recoverTitle: '找回账户', verifyTitle: '验证邮箱', recoverBody: '提交账户邮箱，我们会发送恢复链接。', verifyBody: '打开邮件中的链接，验证你的邮箱。', done: '验证完成，正在进入首页…', processing: '处理中…', resend: '重新发送', send: '发送邮件', sentPrefix: '邮件已发送至', recovered: '账户已恢复', verified: '邮箱验证成功' },
  hi: { security: 'सुरक्षा जाँच', recoverTitle: 'खाता पुनर्प्राप्त करें', verifyTitle: 'ईमेल सत्यापित करें', recoverBody: 'अपना खाता ईमेल दें और हम रिकवरी लिंक भेजेंगे।', verifyBody: 'पता सत्यापित करने के लिए ईमेल का लिंक खोलें।', done: 'सत्यापन पूरा। होम पर जा रहे हैं…', processing: 'प्रक्रिया में…', resend: 'ईमेल फिर भेजें', send: 'ईमेल भेजें', sentPrefix: 'सत्यापन ईमेल भेजा गया:', recovered: 'खाता पुनर्प्राप्त', verified: 'ईमेल सत्यापित' },
  es: { security: 'COMPROBACIÓN DE SEGURIDAD', recoverTitle: 'Recuperar cuenta', verifyTitle: 'Verificar correo', recoverBody: 'Introduce el correo de tu cuenta y enviaremos un enlace de recuperación.', verifyBody: 'Abre el enlace del correo para verificar tu dirección.', done: 'Verificación completa. Volviendo al inicio…', processing: 'Procesando…', resend: 'Reenviar correo', send: 'Enviar correo', sentPrefix: 'Correo de verificación enviado a', recovered: 'Cuenta recuperada', verified: 'Correo verificado' },
  ar: { security: 'فحص الأمان', recoverTitle: 'استرداد الحساب', verifyTitle: 'تحقق من البريد', recoverBody: 'أدخل بريد حسابك وسنرسل رابط الاسترداد.', verifyBody: 'افتح الرابط في بريدك للتحقق من عنوانك.', done: 'اكتمل التحقق. جارٍ الانتقال إلى الصفحة الرئيسية…', processing: 'جارٍ المعالجة…', resend: 'إعادة إرسال البريد', send: 'إرسال البريد', sentPrefix: 'أُرسلت رسالة التحقق إلى', recovered: 'تم استرداد الحساب', verified: 'تم التحقق من البريد' },
  fr: { security: 'VÉRIFICATION DE SÉCURITÉ', recoverTitle: 'Récupérer le compte', verifyTitle: 'Vérifier l’e-mail', recoverBody: 'Saisissez l’e-mail du compte et nous enverrons un lien de récupération.', verifyBody: 'Ouvrez le lien reçu pour vérifier votre adresse.', done: 'Vérification terminée. Retour à l’accueil…', processing: 'Traitement…', resend: 'Renvoyer l’e-mail', send: 'Envoyer l’e-mail', sentPrefix: 'E-mail de vérification envoyé à', recovered: 'Compte récupéré', verified: 'E-mail vérifié' },
  pt: { security: 'VERIFICAÇÃO DE SEGURANÇA', recoverTitle: 'Recuperar conta', verifyTitle: 'Verificar e-mail', recoverBody: 'Insira o e-mail da conta e enviaremos um link de recuperação.', verifyBody: 'Abra o link no e-mail para verificar seu endereço.', done: 'Verificação concluída. Indo para o início…', processing: 'Processando…', resend: 'Reenviar e-mail', send: 'Enviar e-mail', sentPrefix: 'E-mail de verificação enviado para', recovered: 'Conta recuperada', verified: 'E-mail verificado' },
}
const recoverySent: Record<AppLocale, string> = {
  en: 'If the account is available, a recovery link is on its way.',
  'zh-CN': '若账户可恢复，我们将发送恢复链接。',
  hi: 'यदि खाता उपलब्ध है, तो पुनर्प्राप्ति लिंक भेजा जाएगा।',
  es: 'Si la cuenta está disponible, recibirás un enlace de recuperación.',
  ar: 'إذا كان الحساب متاحًا، فسيصلك رابط الاسترداد.',
  fr: 'Si le compte est disponible, un lien de récupération vous sera envoyé.',
  pt: 'Se a conta estiver disponível, você receberá um link de recuperação.',
}

export function AuthFlowScreen({ step, go, notify, onAuthenticated }: { step: 'verify' | 'recover'; go: (screen: RwaScreen) => void; notify: (message: string) => void; onAuthenticated: () => void }) {
  const { locale } = useI18n()
  const copy = authFlowCopy[locale]
  const authCopy = authRouteCopy[locale]
  const visual = authVisualCopy[locale]
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'pending' | 'sent' | 'done' | 'error'>('idle')
  useUiLoading(state === 'pending')
  const [message, setMessage] = useState('')
  const [retryAfter, setRetryAfter] = useState(0)
  const sending = useRef(false)
  const attempt = useRef<{ step: string; request: ReturnType<typeof verifyEmail> } | null>(null)
  const handlers = useRef({ go, notify, onAuthenticated, locale, copy })
  handlers.current = { go, notify, onAuthenticated, locale, copy }
  useEffect(() => {
    if (step === 'verify' && !new URLSearchParams(location.search).get('token') && getSessionToken()) {
      location.replace('/home?bindEmail=1')
      return
    }
    setEmail(sessionStorage.getItem('rwa.pending-email') ?? '')
  }, [step])
  useEffect(() => {
    let active = true
    if (!attempt.current || attempt.current.step !== step) {
      const token = new URLSearchParams(location.search).get('token')
      if (!token) return
      // The route decides the purpose. Stale login UI state must never reinterpret a verification token.
      attempt.current = { step, request: step === 'recover' ? confirmRecovery(token) : verifyEmail(token) }
      history.replaceState(history.state, '', location.pathname)
    }
    setState('pending')
    void attempt.current.request.then(result => {
      if (!active) return
      if (!result.ok) { if (continueAuth(result.error)) return; setMessage(authErrorMessage(result.error, handlers.current.locale)); setRetryAfter(result.error.retryAfter ?? 0); setState('error'); return }
      handlers.current.onAuthenticated(); setState('done')
      sessionStorage.removeItem('rwa.pending-consents')
      // A verified registration link is a new account: land on the optional verification welcome.
      if (step === 'verify' && sessionStorage.getItem('rwa.pending-email-mode') === 'register') markNewAccount(sessionStorage, true)
      handlers.current.notify(step === 'recover' ? handlers.current.copy.recovered : handlers.current.copy.verified)
      location.replace(consumeAuthDestination(sessionStorage, location.origin))
    }).catch(() => {
      if (!active) return
      setMessage(authErrorMessage({ status: 0, code: 'AUTH_FLOW_FAILED' }, handlers.current.locale))
      setState('error')
    })
    return () => { active = false }
  }, [step])
  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = window.setInterval(() => setRetryAfter(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [retryAfter])
  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (sending.current || retryAfter > 0 || state === 'done') return
    if (!EMAIL.test(email.trim())) { setMessage(authCopy.invalidEmail); setState('error'); return }
    sending.current = true
    setState('pending'); setMessage('')
    try {
      let result
      if (step === 'recover') result = await requestRecovery(email.trim())
      else {
        let consents: AuthConsent[] = []
        try {
          const stored = JSON.parse(sessionStorage.getItem('rwa.pending-consents') ?? 'null')
          if (Array.isArray(stored) && ['terms', 'privacy'].every(type => stored.some(item => item?.documentType === type && item?.accepted === true && typeof item?.version === 'string'))) consents = stored
        } catch { /* Register collects explicit consent again. */ }
        if (!consents.length) { go('register'); return }
        result = await registerEmail(email.trim(), locale === 'zh-CN' ? 'zh' : locale, consents)
      }
      if (!result.ok) {
        if (isConsentError(result.error)) { sessionStorage.removeItem('rwa.pending-consents'); go('register'); notify(authErrorMessage(result.error, locale)); return }
        setMessage(authErrorMessage(result.error, locale)); setRetryAfter(result.error.retryAfter ?? 0); setState('error'); return
      }
      sessionStorage.setItem('rwa.pending-email', email.trim())
      setState('sent'); setRetryAfter(30)
    } finally { sending.current = false }
  }
  const title = step === 'recover' ? copy.recoverTitle : copy.verifyTitle
  const busy = state === 'pending'
  return <AuthShell attrs={{ 'data-auth-flow': step }}>
    <div className={flow.flow} aria-labelledby="auth-flow-title">
      <header className={styles.cardHead}>
        <h1 id="auth-flow-title" className={styles.cardTitle}>{title}</h1>
        <p className={styles.cardLede}>{step === 'recover' ? copy.recoverBody : copy.verifyBody}</p>
      </header>
      {state === 'done' ? <p className={styles.success} role="status">{copy.done}</p> : <form onSubmit={send} noValidate aria-busy={busy}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{visual.emailAddress}</span>
          <input name="email" value={email} onChange={event => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} dir="ltr" aria-invalid={state === 'error' || undefined} placeholder="name@example.com" disabled={busy} />
        </label>
        {state === 'sent' && <p className={flow.success} role="status">{step === 'recover' ? recoverySent[locale] : authCopy.emailSent}</p>}
        {state === 'error' && <p role="alert" className={styles.error}>{message}</p>}
        <button className={styles.primary} type="submit" disabled={busy || retryAfter > 0}>{busy ? <><LoaderCircle className={styles.spinner} size={18} aria-hidden="true" /><span className={styles.srOnly}>{copy.processing}</span></> : <span>{retryAfter > 0 ? interpolateRouteCopy(authCopy.retryAfter, { seconds: retryAfter }) : state === 'sent' ? copy.resend : copy.send}</span>}</button>
      </form>}
      <footer className={flow.footer}><button type="button" onClick={() => go('login')}><ArrowLeft size={15} aria-hidden="true" />{visual.signIn}</button></footer>
    </div>
  </AuthShell>
}
