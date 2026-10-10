import type { AppLocale } from './i18n'

type AuthVisualCopy = {
  hero: [string, string]
  login: string
  register: string
  emailAddress: string
  continueEmail: string
  otherMethods: string
  newHere: string
  createAccount: string
  haveAccount: string
  signIn: string
  needHelp: string
  loginLegal: string
  consentStart: string
  consentMiddle: string
  consentEnd: string
  terms: string
  privacy: string
  consentRequired: string
  google: string
  x: string
  wallet: string
  switchTheme: string
}

export const authVisualCopy: Record<AppLocale, AuthVisualCopy> = {
  en: { hero: ['Invest in', 'what lasts.'], login: 'Sign in.', register: 'Create account.', emailAddress: 'Email address', continueEmail: 'Continue with email', otherMethods: 'OR', newHere: 'New here?', createAccount: 'Create account', haveAccount: 'Already a member?', signIn: 'Sign in', needHelp: 'Need help?', loginLegal: 'Use is subject to', consentStart: 'I agree to', consentMiddle: 'and', consentEnd: 'and eligibility checks.', terms: 'Terms', privacy: 'Privacy', consentRequired: 'Agree to the terms to create an account.', google: 'Continue with Google', x: 'Continue with X', wallet: 'Continue with wallet', switchTheme: 'Switch color theme' },
  'zh-CN': { hero: ['投资真实', '面向长远'], login: '登录。', register: '创建账户。', emailAddress: '邮箱地址', continueEmail: '使用邮箱继续', otherMethods: '或', newHere: '还没有账户？', createAccount: '创建账户', haveAccount: '已有账户？', signIn: '登录', needHelp: '需要帮助？', loginLegal: '继续使用即受以下文件约束：', consentStart: '我同意', consentMiddle: '、', consentEnd: '及准入核查。', terms: '服务条款', privacy: '隐私政策', consentRequired: '请先同意条款，再创建账户。', google: '使用 Google 继续', x: '使用 X 继续', wallet: '使用钱包继续', switchTheme: '切换冷暖主题' },
  hi: { hero: ['जो टिके,', 'उसमें निवेश।'], login: 'साइन इन करें।', register: 'खाता बनाएँ।', emailAddress: 'ईमेल पता', continueEmail: 'ईमेल से जारी रखें', otherMethods: 'या', newHere: 'नए हैं?', createAccount: 'खाता बनाएँ', haveAccount: 'पहले से सदस्य हैं?', signIn: 'साइन इन करें', needHelp: 'मदद चाहिए?', loginLegal: 'उपयोग इन शर्तों के अधीन है:', consentStart: 'मैं सहमत हूँ', consentMiddle: 'और', consentEnd: 'और पात्रता जाँच से।', terms: 'शर्तें', privacy: 'गोपनीयता', consentRequired: 'खाता बनाने के लिए शर्तों से सहमत हों।', google: 'Google से जारी रखें', x: 'X से जारी रखें', wallet: 'वॉलेट से जारी रखें', switchTheme: 'रंग थीम बदलें' },
  es: { hero: ['Invierte en', 'lo que perdura.'], login: 'Inicia sesión.', register: 'Crea una cuenta.', emailAddress: 'Correo electrónico', continueEmail: 'Continuar con correo', otherMethods: 'O', newHere: '¿Eres nuevo?', createAccount: 'Crear cuenta', haveAccount: '¿Ya tienes cuenta?', signIn: 'Iniciar sesión', needHelp: '¿Necesitas ayuda?', loginLegal: 'El uso está sujeto a', consentStart: 'Acepto', consentMiddle: 'y', consentEnd: 'y las verificaciones de elegibilidad.', terms: 'Términos', privacy: 'Privacidad', consentRequired: 'Acepta los términos para crear una cuenta.', google: 'Continuar con Google', x: 'Continuar con X', wallet: 'Continuar con cartera', switchTheme: 'Cambiar tema de color' },
  ar: { hero: ['استثمر فيما', 'يدوم.'], login: 'تسجيل الدخول.', register: 'إنشاء حساب.', emailAddress: 'البريد الإلكتروني', continueEmail: 'المتابعة بالبريد', otherMethods: 'أو', newHere: 'جديد هنا؟', createAccount: 'أنشئ حسابًا', haveAccount: 'لديك حساب؟', signIn: 'سجّل الدخول', needHelp: 'تحتاج مساعدة؟', loginLegal: 'يخضع الاستخدام لـ', consentStart: 'أوافق على', consentMiddle: 'و', consentEnd: 'والتحقق من الأهلية.', terms: 'الشروط', privacy: 'الخصوصية', consentRequired: 'وافق على الشروط لإنشاء حساب.', google: 'المتابعة عبر Google', x: 'المتابعة عبر X', wallet: 'المتابعة بالمحفظة', switchTheme: 'تغيير السمة' },
  fr: { hero: ['Investissez dans', 'ce qui dure.'], login: 'Connexion.', register: 'Créer un compte.', emailAddress: 'Adresse e-mail', continueEmail: 'Continuer par e-mail', otherMethods: 'OU', newHere: 'Nouveau ici ?', createAccount: 'Créer un compte', haveAccount: 'Déjà membre ?', signIn: 'Se connecter', needHelp: 'Besoin d’aide ?', loginLegal: 'L’utilisation est soumise aux', consentStart: 'J’accepte les', consentMiddle: 'et la', consentEnd: 'ainsi que les vérifications d’éligibilité.', terms: 'Conditions', privacy: 'Confidentialité', consentRequired: 'Acceptez les conditions pour créer un compte.', google: 'Continuer avec Google', x: 'Continuer avec X', wallet: 'Continuer avec un portefeuille', switchTheme: 'Changer de thème' },
  pt: { hero: ['Invista no', 'que permanece.'], login: 'Entrar.', register: 'Criar conta.', emailAddress: 'Endereço de e-mail', continueEmail: 'Continuar com e-mail', otherMethods: 'OU', newHere: 'Novo por aqui?', createAccount: 'Criar conta', haveAccount: 'Já tem conta?', signIn: 'Entrar', needHelp: 'Precisa de ajuda?', loginLegal: 'O uso está sujeito aos', consentStart: 'Concordo com os', consentMiddle: 'e a', consentEnd: 'e com as verificações de elegibilidade.', terms: 'Termos', privacy: 'Privacidade', consentRequired: 'Aceite os termos para criar uma conta.', google: 'Continuar com Google', x: 'Continuar com X', wallet: 'Continuar com carteira', switchTheme: 'Mudar tema de cores' },
}
