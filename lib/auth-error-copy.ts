import type { AppLocale } from './i18n'
import type { ApiError } from './api/_http'

type ErrorCopy = { retry: string; expired: string; consent: string; network: string; wallet: string; restart: string; account: string; limited: string; cancelled: string; taken: string }
const copy: Record<AppLocale, ErrorCopy> = {
  en: { retry: 'Unable to continue. Please try again.', expired: 'This link has expired or was already used. Request a new one.', consent: 'The terms have changed. Review and agree again.', network: 'Check your connection and try again.', wallet: 'Connect your wallet and approve the sign-in request.', restart: 'Start sign-in again in this browser.', account: 'Use the sign-in method linked to your account.', limited: 'Too many attempts. Please wait before trying again.', cancelled: 'Sign-in was cancelled. You can try again or use another method.', taken: 'This email already has an account. Sign in instead.' },
  'zh-CN': { retry: '暂时无法继续，请重试。', expired: '链接已过期或已使用，请重新发送。', consent: '条款已更新，请阅读后重新勾选。', network: '请检查网络后重试。', wallet: '请连接钱包并确认登录签名。', restart: '请在此浏览器重新发起登录。', account: '请使用与账户绑定的登录方式。', limited: '操作过于频繁，请稍后重试。', cancelled: '已取消授权登录，可重试或换一种方式。', taken: '该邮箱已注册，请直接登录。' },
  hi: { retry: 'जारी नहीं रख सके। फिर प्रयास करें।', expired: 'लिंक समाप्त या उपयोग हो चुका है। नया लिंक माँगें।', consent: 'शर्तें बदली हैं। पढ़कर फिर सहमति दें।', network: 'कनेक्शन जाँचकर फिर प्रयास करें।', wallet: 'वॉलेट जोड़ें और साइन-इन अनुरोध स्वीकार करें।', restart: 'इस ब्राउज़र में साइन-इन फिर शुरू करें।', account: 'खाते से जुड़ी साइन-इन विधि का उपयोग करें।', limited: 'बहुत अधिक प्रयास। कुछ देर प्रतीक्षा करें।', cancelled: 'साइन-इन रद्द हुआ। फिर प्रयास करें या दूसरा तरीका चुनें।', taken: 'इस ईमेल से खाता पहले से है। साइन इन करें।' },
  es: { retry: 'No se pudo continuar. Inténtalo de nuevo.', expired: 'El enlace caducó o ya se usó. Solicita otro.', consent: 'Los términos cambiaron. Revísalos y acepta de nuevo.', network: 'Revisa tu conexión e inténtalo de nuevo.', wallet: 'Conecta tu cartera y aprueba el inicio de sesión.', restart: 'Vuelve a iniciar sesión en este navegador.', account: 'Usa el método vinculado a tu cuenta.', limited: 'Demasiados intentos. Espera un momento.', cancelled: 'Se canceló el acceso. Inténtalo de nuevo o usa otro método.', taken: 'Este correo ya tiene cuenta. Inicia sesión.' },
  ar: { retry: 'تعذرت المتابعة. حاول مجددًا.', expired: 'انتهت صلاحية الرابط أو استُخدم. اطلب رابطًا جديدًا.', consent: 'تغيرت الشروط. راجعها ووافق مجددًا.', network: 'تحقق من الاتصال وحاول مجددًا.', wallet: 'اربط محفظتك ووافق على طلب الدخول.', restart: 'ابدأ تسجيل الدخول مجددًا في هذا المتصفح.', account: 'استخدم طريقة الدخول المرتبطة بحسابك.', limited: 'محاولات كثيرة. انتظر قليلًا.', cancelled: 'أُلغي تسجيل الدخول. حاول مجددًا أو استخدم طريقة أخرى.', taken: 'لهذا البريد حساب بالفعل. سجّل الدخول.' },
  fr: { retry: 'Impossible de continuer. Réessayez.', expired: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un autre.', consent: 'Les conditions ont changé. Relisez-les et acceptez à nouveau.', network: 'Vérifiez votre connexion et réessayez.', wallet: 'Connectez votre portefeuille et approuvez la connexion.', restart: 'Recommencez la connexion dans ce navigateur.', account: 'Utilisez la méthode associée à votre compte.', limited: 'Trop de tentatives. Patientez un instant.', cancelled: 'Connexion annulée. Réessayez ou choisissez une autre méthode.', taken: 'Cet e-mail a déjà un compte. Connectez-vous.' },
  pt: { retry: 'Não foi possível continuar. Tente novamente.', expired: 'O link expirou ou já foi usado. Solicite outro.', consent: 'Os termos mudaram. Leia e aceite novamente.', network: 'Verifique a conexão e tente novamente.', wallet: 'Conecte a carteira e aprove o acesso.', restart: 'Reinicie o acesso neste navegador.', account: 'Use o método vinculado à sua conta.', limited: 'Muitas tentativas. Aguarde um momento.', cancelled: 'O acesso foi cancelado. Tente novamente ou use outro método.', taken: 'Este e-mail já tem conta. Entre.' },
}
export const isConsentError = (error: Pick<ApiError, 'code'>) => ['AUTH_CONSENT_VERSION_MISMATCH', 'AUTH_CONSENT_REQUIRED'].includes(error.code)
const providerUnavailable: Record<AppLocale, string> = {
  en: 'This sign-in method is unavailable. Use another method.',
  'zh-CN': '此登录方式暂不可用，请使用其他方式。',
  hi: 'यह साइन-इन तरीका उपलब्ध नहीं है। दूसरा तरीका चुनें।',
  es: 'Este método de acceso no está disponible. Usa otro.',
  ar: 'طريقة الدخول هذه غير متاحة. استخدم طريقة أخرى.',
  fr: 'Cette méthode de connexion est indisponible. Choisissez-en une autre.',
  pt: 'Este método de acesso está indisponível. Use outro.',
}
const walletReturn: Record<AppLocale, string> = {
  en: 'No wallet connection was received. Finish approval in your wallet, return here, and try again.',
  'zh-CN': '尚未收到钱包连接。请在钱包完成授权后返回，再点钱包图标连接。',
  hi: 'वॉलेट कनेक्शन नहीं मिला। वॉलेट में अनुमति पूरी करें, यहाँ लौटें और फिर प्रयास करें।',
  es: 'No se recibió la conexión de la cartera. Completa la aprobación, vuelve aquí e inténtalo de nuevo.',
  ar: 'لم يصل اتصال المحفظة. أكمل الموافقة في المحفظة، ثم عُد إلى هنا وحاول مجددًا.',
  fr: 'Aucune connexion au portefeuille reçue. Terminez l’approbation, revenez ici et réessayez.',
  pt: 'A conexão da carteira não chegou. Conclua a aprovação, volte aqui e tente novamente.',
}
const walletFailure: Record<AppLocale, { connection: string; signature: string }> = {
  en: { connection: 'The wallet connection is unavailable. Reconnect and try again.', signature: 'No sign-in signature was received. Check your wallet connection and try again.' },
  'zh-CN': { connection: '钱包连接暂不可用，请重新连接后重试。', signature: '未收到登录签名，请检查钱包连接后重试。' },
  hi: { connection: 'वॉलेट कनेक्शन उपलब्ध नहीं है। फिर जोड़कर प्रयास करें।', signature: 'साइन-इन हस्ताक्षर नहीं मिला। वॉलेट कनेक्शन जाँचकर फिर प्रयास करें।' },
  es: { connection: 'La conexión de la cartera no está disponible. Vuelve a conectarla e inténtalo de nuevo.', signature: 'No se recibió la firma de acceso. Revisa la conexión de la cartera e inténtalo de nuevo.' },
  ar: { connection: 'اتصال المحفظة غير متاح. أعد الاتصال وحاول مجددًا.', signature: 'لم يصل توقيع تسجيل الدخول. تحقق من اتصال المحفظة وحاول مجددًا.' },
  fr: { connection: 'La connexion au portefeuille est indisponible. Reconnectez-le et réessayez.', signature: 'Aucune signature de connexion reçue. Vérifiez la connexion au portefeuille et réessayez.' },
  pt: { connection: 'A conexão da carteira está indisponível. Reconecte e tente novamente.', signature: 'Nenhuma assinatura de acesso recebida. Verifique a conexão da carteira e tente novamente.' },
}
const inviteRequired: Record<AppLocale, string> = {
  'zh-CN': '注册新账户需要有效的邀请码', en: 'A valid invitation code is required to create an account', hi: 'नया खाता बनाने के लिए मान्य आमंत्रण कोड आवश्यक है',
  es: 'Se necesita un código de invitación válido para crear una cuenta', ar: 'يلزم رمز دعوة صالح لإنشاء حساب',
  fr: 'Un code d’invitation valide est nécessaire pour créer un compte', pt: 'É preciso um código de convite válido para criar uma conta',
}
export function authErrorMessage(error: Pick<ApiError, 'code' | 'status'>, locale: AppLocale): string {
  const text = copy[locale]
  if (isConsentError(error)) return text.consent
  if (error.status === 429) return text.limited
  if (error.code === 'WALLET_CONNECTION_NOT_FOUND') return walletReturn[locale]
  if (['WALLET_CONNECTION_FAILED', 'WALLET_CHAIN_INVALID'].includes(error.code)) return walletFailure[locale].connection
  if (error.code === 'WALLET_SIGNATURE_FAILED') return walletFailure[locale].signature
  if (error.code === 'WALLET_CANCELLED' || error.code === '4001') return text.cancelled
  if (/^WALLET_NONCE_/.test(error.code)) return text.restart
  if (/^OAUTH_PROVIDER_(?:NOT_CONFIGURED|UNAVAILABLE|ACCESS_DENIED|BILLING_REQUIRED)$/.test(error.code)) return providerUnavailable[locale]
  if (['NETWORK_ERROR', 'ABORTED', 'REQUEST_TIMEOUT'].includes(error.code)) return text.network
  if (/VERIFICATION_TOKEN|RECOVERY_TOKEN|EMAIL_TOKEN|TOKEN_EXPIRED/.test(error.code)) return text.expired
  if (/^OAUTH_(?!CANCELLED)|^AUTH_FLOW_|^AUTH_URL_|^PASSKEY_/.test(error.code)) return text.restart
  if (/WALLET/.test(error.code)) return text.wallet
  if (error.code === 'OAUTH_CANCELLED') return text.cancelled
  if (error.code === 'IDENTITY_EMAIL_TAKEN') return text.taken
  if (error.code === 'REFERRAL_CODE_REQUIRED') return inviteRequired[locale]
  if (['IDENTITY_NOT_FOUND', 'REGISTRATION_REQUIRED'].includes(error.code)) return text.account
  return text.retry
}
