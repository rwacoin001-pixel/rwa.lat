import type { AppLocale } from './app-locales'

type InviteCopy = {
  invitation: string; headline: [string, string]; welcome: string; saved: string; code: string
  accept: string; login: string; risk: string; terms: string; privacy: string; language: string; theme: string
}

export const kimengInviteCopy: Record<AppLocale, InviteCopy> = {
  en: {
    invitation: 'You’re invited', headline: ['See clearly.', 'Choose thoughtfully.'],
    welcome: 'A new perspective begins with KIMENG.', saved: 'Your invitation is saved for sign-up.', code: 'Invitation code',
    accept: 'Get started', login: 'Sign in', risk: 'Investing involves risk, including loss of capital. Understand the risks and make your own decisions.',
    terms: 'Terms', privacy: 'Privacy', language: 'Language', theme: 'Change appearance',
  },
  'zh-CN': {
    invitation: '一份给你的邀请', headline: ['看得更清楚，', '选择更从容。'],
    welcome: '从 金英 开始，发现新的视角。', saved: '邀请码已保存，将在注册时使用。', code: '邀请码',
    accept: '开启体验', login: '登录', risk: '投资涉及风险，本金可能损失。请充分了解后独立决策。',
    terms: '服务条款', privacy: '隐私政策', language: '语言', theme: '切换外观',
  },
  hi: {
    invitation: 'आपके लिए एक आमंत्रण', headline: ['स्पष्ट नज़रिया।', 'सोच-समझकर चुनाव।'],
    welcome: 'KIMENG के साथ एक नया नज़रिया अपनाएँ।', saved: 'पंजीकरण के लिए आपका आमंत्रण सहेजा गया है।', code: 'आमंत्रण कोड',
    accept: 'शुरू करें', login: 'साइन इन', risk: 'निवेश में जोखिम है और मूलधन का नुकसान हो सकता है। जोखिम समझें और अपना निर्णय स्वयं लें।',
    terms: 'शर्तें', privacy: 'गोपनीयता', language: 'भाषा', theme: 'रंग बदलें',
  },
  es: {
    invitation: 'Una invitación para ti', headline: ['Una mirada clara.', 'Una elección meditada.'],
    welcome: 'Una nueva perspectiva comienza en KIMENG.', saved: 'Tu invitación está guardada para el registro.', code: 'Código de invitación',
    accept: 'Comenzar', login: 'Iniciar sesión', risk: 'Invertir conlleva riesgos, incluida la pérdida de capital. Comprende los riesgos y decide por tu cuenta.',
    terms: 'Términos', privacy: 'Privacidad', language: 'Idioma', theme: 'Cambiar apariencia',
  },
  ar: {
    invitation: 'دعوة لك', headline: ['رؤية أوضح.', 'اختيار متأنٍ.'],
    welcome: 'منظور جديد يبدأ مع KIMENG.', saved: 'تم حفظ دعوتك لاستخدامها عند التسجيل.', code: 'رمز الدعوة',
    accept: 'ابدأ الآن', login: 'تسجيل الدخول', risk: 'ينطوي الاستثمار على مخاطر، بما فيها خسارة رأس المال. افهم المخاطر واتخذ قرارك بشكل مستقل.',
    terms: 'الشروط', privacy: 'الخصوصية', language: 'اللغة', theme: 'تغيير المظهر',
  },
  fr: {
    invitation: 'Une invitation pour vous', headline: ['Un regard plus clair.', 'Un choix réfléchi.'],
    welcome: 'Une nouvelle perspective commence avec KIMENG.', saved: 'Votre invitation est conservée pour l’inscription.', code: 'Code d’invitation',
    accept: 'Commencer', login: 'Se connecter', risk: 'Investir comporte des risques, dont la perte du capital. Comprenez les risques et décidez en toute indépendance.',
    terms: 'Conditions', privacy: 'Confidentialité', language: 'Langue', theme: 'Changer l’apparence',
  },
  pt: {
    invitation: 'Um convite para você', headline: ['Um olhar mais claro.', 'Uma escolha ponderada.'],
    welcome: 'Uma nova perspectiva começa com a KIMENG.', saved: 'Seu convite está salvo para o cadastro.', code: 'Código de convite',
    accept: 'Começar', login: 'Entrar', risk: 'Investir envolve riscos, incluindo a perda de capital. Entenda os riscos e decida de forma independente.',
    terms: 'Termos', privacy: 'Privacidade', language: 'Idioma', theme: 'Mudar aparência',
  },
}
