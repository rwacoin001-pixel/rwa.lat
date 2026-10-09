import type { AppLocale } from './app-locales'

type SessionUnlockCopy = { title: string; description: string; unlock: string; verifying: string; signInAgain: string }

/** Copy for the local privacy unlock screen. */
export const sessionUnlockCopy: Record<AppLocale, SessionUnlockCopy> = {
  'zh-CN': { title: '欢迎回来', description: '验证身份后继续', unlock: '解锁', verifying: '验证中…', signInAgain: '重新登录' },
  en: { title: 'Welcome back', description: 'Verify your identity to continue', unlock: 'Unlock', verifying: 'Verifying…', signInAgain: 'Sign in again' },
  hi: { title: 'फिर से स्वागत है', description: 'जारी रखने के लिए अपनी पहचान सत्यापित करें', unlock: 'अनलॉक करें', verifying: 'सत्यापित किया जा रहा है…', signInAgain: 'फिर से लॉग इन करें' },
  es: { title: 'Bienvenido de nuevo', description: 'Verifica tu identidad para continuar', unlock: 'Desbloquear', verifying: 'Verificando…', signInAgain: 'Iniciar sesión de nuevo' },
  ar: { title: 'مرحبًا بعودتك', description: 'تحقّق من هويتك للمتابعة', unlock: 'فتح القفل', verifying: 'جارٍ التحقق…', signInAgain: 'تسجيل الدخول مجددًا' },
  fr: { title: 'Bon retour', description: 'Vérifiez votre identité pour continuer', unlock: 'Déverrouiller', verifying: 'Vérification…', signInAgain: 'Se reconnecter' },
  pt: { title: 'Bem-vindo de volta', description: 'Verifique sua identidade para continuar', unlock: 'Desbloquear', verifying: 'Verificando…', signInAgain: 'Entrar novamente' },
}
