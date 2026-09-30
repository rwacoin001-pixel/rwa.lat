'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, BadgeCheck, Scale, ShieldCheck } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import { readSession } from '@/lib/api/_http'
import { consumeAuthDestination } from '@/lib/api/auth-navigation'
import { getKycStatus, type KycState } from '@/lib/session-data'
import styles from '@/components/screens/P02-Login.module.css'
import welcome from './welcome.module.css'
import { AuthShell } from '@/components/screens/AuthShell'

type WelcomeCopy = {
  kicker: string; title: string; lede: string
  steps: [string, string][]
  optional: string; review: string; done: string; start: string; later: string; note: string
}

const en: WelcomeCopy = {
  kicker: 'Account created', title: 'Welcome to RWA.LAT', lede: 'You can browse and follow assets now. Verification unlocks subscriptions and withdrawals whenever you are ready.',
  steps: [['Identity verification', 'ID document and a short selfie, about 3 minutes'], ['Investor eligibility', 'Confirms which offerings you can join'], ['Risk profile', 'A few questions to match products to you']],
  optional: 'Optional', review: 'In review', done: 'Done', start: 'Start verification', later: 'Maybe later', note: 'You can finish this anytime under Profile → Verification.',
}

const copy: Record<AppLocale, WelcomeCopy> = {
  en,
  'zh-CN': {
    kicker: '账户已创建', title: '欢迎来到 RWA.LAT', lede: '现在就可以浏览和关注资产。完成认证后即可认购与提现，随时都能开始。',
    steps: [['身份认证', '证件与简短自拍，约 3 分钟'], ['投资资格', '确认你可参与的项目范围'], ['风险测评', '几道题，帮你匹配合适的产品']],
    optional: '可选', review: '审核中', done: '已完成', start: '开始身份认证', later: '稍后再说', note: '之后可在「我的 → 认证中心」随时完成',
  },
  hi: {
    kicker: 'खाता बन गया', title: 'RWA.LAT में स्वागत है', lede: 'आप अभी संपत्तियाँ देख और फ़ॉलो कर सकते हैं। सत्यापन के बाद सदस्यता और निकासी खुलती है।',
    steps: [['पहचान सत्यापन', 'पहचान पत्र और छोटी सेल्फ़ी, लगभग 3 मिनट'], ['निवेशक पात्रता', 'आप किन पेशकशों में शामिल हो सकते हैं'], ['जोखिम प्रोफ़ाइल', 'उत्पाद मिलाने के लिए कुछ प्रश्न']],
    optional: 'वैकल्पिक', review: 'समीक्षा में', done: 'पूर्ण', start: 'सत्यापन शुरू करें', later: 'बाद में', note: 'प्रोफ़ाइल → सत्यापन में कभी भी पूरा करें।',
  },
  es: {
    kicker: 'Cuenta creada', title: 'Te damos la bienvenida', lede: 'Ya puedes explorar y seguir activos. La verificación habilita suscripciones y retiros cuando quieras.',
    steps: [['Verificación de identidad', 'Documento y un breve selfie, unos 3 minutos'], ['Elegibilidad', 'Confirma en qué ofertas puedes participar'], ['Perfil de riesgo', 'Unas preguntas para ajustar los productos']],
    optional: 'Opcional', review: 'En revisión', done: 'Hecho', start: 'Empezar verificación', later: 'Más tarde', note: 'Puedes completarlo en Perfil → Verificación.',
  },
  ar: {
    kicker: 'تم إنشاء الحساب', title: 'مرحبًا بك في RWA.LAT', lede: 'يمكنك الآن تصفح الأصول ومتابعتها. التحقق يتيح الاكتتاب والسحب متى كنت مستعدًا.',
    steps: [['التحقق من الهوية', 'وثيقة هوية وصورة ذاتية قصيرة، نحو 3 دقائق'], ['أهلية المستثمر', 'تحدد العروض التي يمكنك المشاركة فيها'], ['ملف المخاطر', 'أسئلة قليلة لمطابقة المنتجات']],
    optional: 'اختياري', review: 'قيد المراجعة', done: 'مكتمل', start: 'ابدأ التحقق', later: 'لاحقًا', note: 'يمكنك إكماله في الملف الشخصي ← التحقق.',
  },
  fr: {
    kicker: 'Compte créé', title: 'Bienvenue sur RWA.LAT', lede: 'Vous pouvez déjà explorer et suivre des actifs. La vérification ouvre souscriptions et retraits quand vous le souhaitez.',
    steps: [['Vérification d’identité', 'Pièce d’identité et court selfie, environ 3 minutes'], ['Éligibilité', 'Précise les offres accessibles'], ['Profil de risque', 'Quelques questions pour adapter les produits']],
    optional: 'Facultatif', review: 'En cours', done: 'Terminé', start: 'Commencer la vérification', later: 'Plus tard', note: 'À compléter à tout moment dans Profil → Vérification.',
  },
  pt: {
    kicker: 'Conta criada', title: 'Boas-vindas à RWA.LAT', lede: 'Você já pode explorar e acompanhar ativos. A verificação libera subscrições e saques quando quiser.',
    steps: [['Verificação de identidade', 'Documento e uma selfie rápida, cerca de 3 minutos'], ['Elegibilidade', 'Confirma de quais ofertas você pode participar'], ['Perfil de risco', 'Algumas perguntas para ajustar os produtos']],
    optional: 'Opcional', review: 'Em análise', done: 'Concluído', start: 'Iniciar verificação', later: 'Mais tarde', note: 'Conclua quando quiser em Perfil → Verificação.',
  },
}

const ICONS = [ShieldCheck, BadgeCheck, Scale]

/** First landing after an account is created: verification is offered, never required. */
export default function WelcomePage() {
  const { locale } = useI18n()
  const text = copy[locale]
  const [kyc, setKyc] = useState<KycState | null>(null)

  useEffect(() => {
    if (!readSession()) { window.location.replace('/login'); return }
    let active = true
    getKycStatus().then(view => { if (active) setKyc(view?.state ?? 'not_started') }).catch(() => {})
    return () => { active = false }
  }, [])

  const leave = (target?: string) => {
    const destination = consumeAuthDestination(sessionStorage, location.origin)
    window.location.replace(target ?? destination)
  }
  const identityStatus = kyc === 'approved' ? text.done : kyc && ['submitted', 'in_progress', 'needs_information'].includes(kyc) ? text.review : text.optional

  return <AuthShell>
    <header className={styles.cardHead}>
      <p className={welcome.kicker}>{text.kicker}</p>
      <h1 className={styles.cardTitle}>{text.title}</h1>
      <p className={styles.cardLede}>{text.lede}</p>
    </header>
    <ol className={welcome.steps}>
      {text.steps.map(([name, detail], index) => {
        const Icon = ICONS[index]
        const status = index === 0 ? identityStatus : text.optional
        return <li key={name} data-state={index === 0 && kyc === 'approved' ? 'done' : undefined}>
          <span className={welcome.icon} aria-hidden="true"><Icon size={18} strokeWidth={1.6} /></span>
          <span className={welcome.text}><b>{name}</b><small>{detail}</small></span>
          <span className={welcome.status}>{status}</span>
        </li>
      })}
    </ol>
    {kyc !== 'approved' && <button type="button" className={styles.primary} onClick={() => leave('/profile/verification')}>
      <span>{text.start}</span><span className={styles.ctaIcon} aria-hidden="true"><ArrowUpRight size={18} strokeWidth={1.8} /></span>
    </button>}
    <button type="button" className={styles.textLink} onClick={() => leave()}>{text.later}</button>
    <p className={welcome.note}>{text.note}</p>
  </AuthShell>
}
