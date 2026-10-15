import type { AppLocale } from './i18n'

/**
 * Android app sign-in through the system browser (Google forbids its sign-in inside an app's WebView).
 *
 *   app      opens  /app-login?challenge=<base64url sha256(verifier)>&state=<nonce>   in the system browser
 *   browser  signs in as usual (any method), POST /v1/auth/app-handoff {challenge} → one-time code (2 min)
 *   browser  opens  areit://auth?code=…&state=…   (intent link pinned to com.areit.app where supported)
 *   app      checks the state, loads /app-handoff with {code, verifier} injected at document start
 *   app page POST /v1/auth/app-handoff/redeem {code, verifier} → its own session → home
 *
 * The verifier never leaves the app, so a code caught by another app is useless.
 */
export const APP_PACKAGE = 'com.areit.app'
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/
const STATE = /^[A-Za-z0-9_-]{16,64}$/
const CODE = /^[A-Za-z0-9_-]{43,128}$/

export function readAppLoginParams(search: string): { challenge: string; state: string } | null {
  const params = new URLSearchParams(search)
  const challenge = params.get('challenge') ?? ''
  const state = params.get('state') ?? ''
  return CHALLENGE.test(challenge) && STATE.test(state) ? { challenge, state } : null
}

/** Pinned to the app's package where the browser supports intent links, so only A-REIT can receive it. */
export function appReturnUrls(code: string, state: string) {
  if (!CODE.test(code) || !STATE.test(state)) return null
  const query = `code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
  return {
    intent: `intent://auth?${query}#Intent;scheme=areit;package=${APP_PACKAGE};end`,
    scheme: `areit://auth?${query}`,
  }
}

/** What the app injects into /app-handoff at document start. */
export function readInjectedHandoff(value: unknown): { code: string; verifier: string } | null {
  if (!value || typeof value !== 'object') return null
  const { code, verifier } = value as { code?: unknown; verifier?: unknown }
  return typeof code === 'string' && typeof verifier === 'string' && CODE.test(code) && CODE.test(verifier) ? { code, verifier } : null
}

type Copy = { title: string; signingIn: string; back: string; backHint: string; done: string; failed: string; invalid: string; retry: string; inApp: string; toLogin: string }

export const APP_HANDOFF_COPY: Record<AppLocale, Copy> = {
  'zh-CN': { title: '登录 A-REIT App', signingIn: '正在为 App 完成登录…', back: '返回 A-REIT App', backHint: '没有自动打开？点上面的按钮回到 App。', done: '登录完成，正在进入…', failed: '没能完成登录，请回到 App 重新开始。', invalid: '这个链接已失效，请回到 App 重新点击登录。', retry: '重试', inApp: '正在登录…', toLogin: '返回登录' },
  en: { title: 'Sign in to the A-REIT app', signingIn: 'Finishing sign-in for the app…', back: 'Back to the A-REIT app', backHint: 'Didn’t open? Tap the button above to return to the app.', done: 'Signed in. Opening…', failed: 'Sign-in could not be completed. Start again from the app.', invalid: 'This link has expired. Go back to the app and tap sign in again.', retry: 'Try again', inApp: 'Signing in…', toLogin: 'Back to sign-in' },
  es: { title: 'Iniciar sesión en la app A-REIT', signingIn: 'Completando el inicio de sesión de la app…', back: 'Volver a la app A-REIT', backHint: '¿No se abrió? Toca el botón de arriba para volver a la app.', done: 'Sesión iniciada. Abriendo…', failed: 'No se pudo completar el inicio de sesión. Empieza de nuevo desde la app.', invalid: 'Este enlace ha caducado. Vuelve a la app y toca iniciar sesión otra vez.', retry: 'Reintentar', inApp: 'Iniciando sesión…', toLogin: 'Volver a iniciar sesión' },
  fr: { title: 'Connexion à l’app A-REIT', signingIn: 'Finalisation de la connexion de l’app…', back: 'Revenir à l’app A-REIT', backHint: 'Rien ne s’ouvre ? Touchez le bouton ci-dessus pour revenir à l’app.', done: 'Connecté. Ouverture…', failed: 'La connexion n’a pas abouti. Recommencez depuis l’app.', invalid: 'Ce lien a expiré. Revenez à l’app et touchez à nouveau « Se connecter ».', retry: 'Réessayer', inApp: 'Connexion…', toLogin: 'Retour à la connexion' },
  pt: { title: 'Entrar no app A-REIT', signingIn: 'Concluindo o login do app…', back: 'Voltar ao app A-REIT', backHint: 'Não abriu? Toque no botão acima para voltar ao app.', done: 'Login concluído. Abrindo…', failed: 'Não foi possível concluir o login. Comece de novo pelo app.', invalid: 'Este link expirou. Volte ao app e toque em entrar novamente.', retry: 'Tentar de novo', inApp: 'Entrando…', toLogin: 'Voltar ao login' },
  ar: { title: 'تسجيل الدخول إلى تطبيق A-REIT', signingIn: 'جارٍ إكمال تسجيل الدخول للتطبيق…', back: 'العودة إلى تطبيق A-REIT', backHint: 'لم يُفتح؟ اضغط الزر أعلاه للعودة إلى التطبيق.', done: 'تم تسجيل الدخول. جارٍ الفتح…', failed: 'تعذّر إكمال تسجيل الدخول. ابدأ من جديد من التطبيق.', invalid: 'انتهت صلاحية هذا الرابط. عُد إلى التطبيق واضغط تسجيل الدخول مجددًا.', retry: 'إعادة المحاولة', inApp: 'جارٍ تسجيل الدخول…', toLogin: 'العودة إلى تسجيل الدخول' },
  hi: { title: 'A-REIT ऐप में साइन इन करें', signingIn: 'ऐप के लिए साइन-इन पूरा हो रहा है…', back: 'A-REIT ऐप पर लौटें', backHint: 'नहीं खुला? ऐप पर लौटने के लिए ऊपर का बटन दबाएँ।', done: 'साइन इन हो गया। खुल रहा है…', failed: 'साइन-इन पूरा नहीं हो सका। ऐप से फिर से शुरू करें।', invalid: 'यह लिंक समाप्त हो गया है। ऐप पर लौटें और फिर से साइन इन दबाएँ।', retry: 'फिर से कोशिश करें', inApp: 'साइन इन हो रहा है…', toLogin: 'साइन-इन पर लौटें' },
}
