'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, LoaderCircle, ShieldCheck, Smartphone } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import { readSession } from '@/lib/api/_http'
import { completePasskeyOffer } from '@/lib/api/auth-navigation'
import { listSecurityFactors, registerPasskey } from '@/lib/api/security'
import styles from '@/components/screens/P02-Login.module.css'
import welcome from '../welcome/welcome.module.css'
import local from './passkey.module.css'
import { AuthShell } from '@/components/screens/AuthShell'

type OfferCopy = {
  kicker: string; title: string; lede: string
  points: [string, string][]
  enable: string; later: string; note: string
  unsupported: string; failed: string; exists: string
}

const en: OfferCopy = {
  kicker: 'Faster sign-in', title: 'Turn on a passkey', lede: 'Next time, sign in with Face ID, fingerprint or your device PIN. No password to type.',
  points: [['Stays on your devices', 'Saved in this device or your password manager'], ['Resists phishing', 'Only works on RWA.LAT, never on a look-alike site']],
  enable: 'Turn on passkey', later: 'Not now', note: 'Manage passkeys anytime in Profile → Security.',
  unsupported: 'This device can’t create passkeys. You can keep using your password.', failed: 'The passkey couldn’t be saved. Try again or skip for now.', exists: 'This passkey is already saved for your account.',
}

const copy: Record<AppLocale, OfferCopy> = {
  en,
  'zh-CN': {
    kicker: '更快登录', title: '开启通行密钥', lede: '下次用面容、指纹或设备密码一键登录，不用再输入密码。',
    points: [['只保存在你的设备上', '存于本机或你的密码管理器'], ['防钓鱼', '只在 RWA.LAT 生效，仿冒网站无法使用']],
    enable: '开启通行密钥', later: '以后再说', note: '之后可在「我的 → 安全」中管理通行密钥',
    unsupported: '此设备无法创建通行密钥，可继续使用密码登录。', failed: '通行密钥未能保存，请重试或先跳过。', exists: '该通行密钥已添加到你的账户。',
  },
  hi: {
    kicker: 'तेज़ साइन इन', title: 'पासकी चालू करें', lede: 'अगली बार Face ID, फ़िंगरप्रिंट या डिवाइस PIN से साइन इन करें। पासवर्ड टाइप नहीं करना होगा।',
    points: [['आपके डिवाइस पर रहती है', 'इस डिवाइस या पासवर्ड मैनेजर में सहेजी जाती है'], ['फ़िशिंग से सुरक्षित', 'केवल RWA.LAT पर काम करती है, नकली साइट पर नहीं']],
    enable: 'पासकी चालू करें', later: 'अभी नहीं', note: 'प्रोफ़ाइल → सुरक्षा में कभी भी प्रबंधित करें।',
    unsupported: 'यह डिवाइस पासकी नहीं बना सकता। आप पासवर्ड से जारी रख सकते हैं।', failed: 'पासकी सहेजी नहीं जा सकी। फिर कोशिश करें या अभी छोड़ें।', exists: 'यह पासकी आपके खाते में पहले से है।',
  },
  es: {
    kicker: 'Acceso más rápido', title: 'Activa una llave de acceso', lede: 'La próxima vez entra con Face ID, huella o el PIN del dispositivo. Sin escribir contraseña.',
    points: [['Se queda en tus dispositivos', 'Se guarda en este dispositivo o en tu gestor de contraseñas'], ['Resiste el phishing', 'Solo funciona en RWA.LAT, nunca en sitios falsos']],
    enable: 'Activar llave de acceso', later: 'Ahora no', note: 'Gestiónalas cuando quieras en Perfil → Seguridad.',
    unsupported: 'Este dispositivo no puede crear llaves de acceso. Puedes seguir con tu contraseña.', failed: 'No se pudo guardar la llave. Inténtalo de nuevo u omítelo.', exists: 'Esta llave ya está guardada en tu cuenta.',
  },
  ar: {
    kicker: 'دخول أسرع', title: 'فعّل مفتاح المرور', lede: 'في المرة القادمة سجّل الدخول ببصمة الوجه أو الإصبع أو رمز الجهاز، دون كتابة كلمة مرور.',
    points: [['يبقى على أجهزتك', 'يُحفظ على هذا الجهاز أو في مدير كلمات المرور'], ['مقاوم للتصيّد', 'يعمل على RWA.LAT فقط، لا على المواقع المقلّدة']],
    enable: 'تفعيل مفتاح المرور', later: 'ليس الآن', note: 'يمكنك إدارتها في الملف الشخصي ← الأمان.',
    unsupported: 'لا يمكن لهذا الجهاز إنشاء مفاتيح مرور. يمكنك متابعة استخدام كلمة المرور.', failed: 'تعذّر حفظ مفتاح المرور. أعد المحاولة أو تخطَّ الآن.', exists: 'مفتاح المرور هذا محفوظ في حسابك مسبقًا.',
  },
  fr: {
    kicker: 'Connexion plus rapide', title: 'Activez une clé d’accès', lede: 'La prochaine fois, connectez-vous avec Face ID, l’empreinte ou le code de l’appareil. Sans mot de passe.',
    points: [['Reste sur vos appareils', 'Enregistrée sur cet appareil ou dans votre gestionnaire de mots de passe'], ['Résiste au phishing', 'Ne fonctionne que sur RWA.LAT, jamais sur un faux site']],
    enable: 'Activer la clé d’accès', later: 'Plus tard', note: 'Gérez vos clés à tout moment dans Profil → Sécurité.',
    unsupported: 'Cet appareil ne peut pas créer de clé d’accès. Vous pouvez garder votre mot de passe.', failed: 'La clé n’a pas pu être enregistrée. Réessayez ou passez pour l’instant.', exists: 'Cette clé est déjà enregistrée sur votre compte.',
  },
  pt: {
    kicker: 'Login mais rápido', title: 'Ative uma chave de acesso', lede: 'Na próxima vez, entre com Face ID, digital ou o PIN do aparelho. Sem digitar senha.',
    points: [['Fica nos seus aparelhos', 'Salva neste aparelho ou no seu gerenciador de senhas'], ['Resiste a phishing', 'Só funciona na RWA.LAT, nunca em sites falsos']],
    enable: 'Ativar chave de acesso', later: 'Agora não', note: 'Gerencie quando quiser em Perfil → Segurança.',
    unsupported: 'Este aparelho não cria chaves de acesso. Você pode continuar com a senha.', failed: 'Não foi possível salvar a chave. Tente de novo ou pule por agora.', exists: 'Esta chave já está salva na sua conta.',
  },
}

const ICONS = [Smartphone, ShieldCheck]
// How long the offer stays away: after "not now", and once the account has a passkey or the device can't make one.
const LATER_DAYS = 30
const SETTLED_DAYS = 180

/** One optional stop after sign-in: add a passkey so the next sign-in is a single tap. */
export default function PasskeyOfferPage() {
  const { locale } = useI18n()
  const text = copy[locale]
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const leave = (days: number) => {
    window.location.replace(completePasskeyOffer(location.origin, days))
  }

  // Skip silently when the offer would be noise: no built-in authenticator, or the account already has a passkey.
  useEffect(() => {
    if (!readSession()) { window.location.replace('/login'); return }
    let active = true
    void (async () => {
      const platform = await window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false)
      if (!active) return
      if (!platform) { leave(SETTLED_DAYS); return }
      const factors = await listSecurityFactors()
      if (!active) return
      if (factors.ok && factors.data.passkeys.some(item => item.state === 'active')) { leave(SETTLED_DAYS); return }
      setReady(true)
    })()
    return () => { active = false }
  }, [])

  const enable = async () => {
    if (pending) return
    setPending(true); setError('')
    const result = await registerPasskey()
    if (result.ok) { leave(SETTLED_DAYS); return }
    setPending(false)
    const code = result.error.code
    if (code === 'PASSKEY_REGISTRATION_CANCELLED') return
    if (code === 'PASSKEY_ALREADY_REGISTERED') { setError(text.exists); return }
    setError(code === 'PASSKEY_UNSUPPORTED' ? text.unsupported : text.failed)
  }

  const later = () => leave(LATER_DAYS)

  if (!ready) return <AuthShell><div className={local.checking} role="status"><LoaderCircle className={styles.spinner} size={22} aria-hidden="true" /></div></AuthShell>

  return <AuthShell>
    <header className={styles.cardHead}>
      <p className={welcome.kicker}>{text.kicker}</p>
      <h1 className={styles.cardTitle}>{text.title}</h1>
      <p className={styles.cardLede}>{text.lede}</p>
    </header>
    <ol className={welcome.steps}>
      {text.points.map(([name, detail], index) => {
        const Icon = ICONS[index]
        return <li key={name}>
          <span className={welcome.icon} aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>
          <span className={welcome.text}><b>{name}</b><small>{detail}</small></span>
        </li>
      })}
    </ol>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button type="button" className={styles.primary} disabled={pending} onClick={() => void enable()} aria-busy={pending}>
      {pending ? <LoaderCircle className={styles.spinner} size={20} aria-hidden="true" /> : <><span>{text.enable}</span><span className={styles.ctaIcon} aria-hidden="true"><Fingerprint size={18} strokeWidth={1.8} /></span></>}
    </button>
    <button type="button" className={styles.textLink} disabled={pending} onClick={later}>{text.later}</button>
    <p className={welcome.note}>{text.note}</p>
  </AuthShell>
}
