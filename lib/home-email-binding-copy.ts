import type { AppLocale } from './i18n'

export type HomeEmailBindingCopy = {
  unverified: string; bind: string; back: string; changeEmail: string
  emailLabel: string; emailPlaceholder: string; codeLabel: string; codePlaceholder: string
  getCode: string; verify: string; sending: string; verifying: string
  sentTo: string; resendIn: string; resend: string; resent: string; verified: string
  errors: { invalidCode: string; codeFormat: string; expired: string; rateLimited: string; taken: string; invalidEmail: string; mismatch: string; unavailable: string }
}

export const homeEmailBindingCopy: Record<AppLocale, HomeEmailBindingCopy> = {
  'zh-CN': {
    unverified: '邮箱未验证', bind: '绑定邮箱', back: '返回', changeEmail: '修改邮箱',
    emailLabel: '邮箱地址', emailPlaceholder: '邮箱地址', codeLabel: '6 位验证码', codePlaceholder: '6 位验证码',
    getCode: '获取验证码', verify: '验证', sending: '正在发送验证码…', verifying: '正在验证…',
    sentTo: '已发送至 {email}', resendIn: '{s}s 后可重发', resend: '重发验证码', resent: '验证码已重新发送', verified: '邮箱已验证',
    errors: { invalidCode: '验证码错误或已失效', codeFormat: '请输入 6 位验证码', expired: '验证已过期，请重新获取', rateLimited: '操作过于频繁，请稍后再试', taken: '该邮箱已被其他账号使用', invalidEmail: '请输入有效的邮箱地址', mismatch: '验证失败，请重新登录后再试', unavailable: '服务暂不可用，请稍后重试' },
  },
  en: {
    unverified: 'Email not verified', bind: 'Add email', back: 'Back', changeEmail: 'Change email',
    emailLabel: 'Email address', emailPlaceholder: 'Email address', codeLabel: '6-digit code', codePlaceholder: '6-digit code',
    getCode: 'Send code', verify: 'Verify', sending: 'Sending code…', verifying: 'Verifying…',
    sentTo: 'Sent to {email}', resendIn: 'Resend in {s}s', resend: 'Resend code', resent: 'Code sent again', verified: 'Email verified',
    errors: { invalidCode: 'Incorrect or expired code', codeFormat: 'Enter a 6-digit code', expired: 'Verification expired, start again', rateLimited: 'Too many attempts, try later', taken: 'Email used by another account', invalidEmail: 'Enter a valid email address', mismatch: 'Verification failed, sign in again', unavailable: 'Service unavailable, try again' },
  },
  hi: {
    unverified: 'ईमेल सत्यापित नहीं', bind: 'ईमेल जोड़ें', back: 'वापस', changeEmail: 'ईमेल बदलें',
    emailLabel: 'ईमेल पता', emailPlaceholder: 'ईमेल पता', codeLabel: '6 अंकों का कोड', codePlaceholder: '6 अंकों का कोड',
    getCode: 'कोड भेजें', verify: 'सत्यापित करें', sending: 'कोड भेजा जा रहा है…', verifying: 'सत्यापन जारी…',
    sentTo: '{email} पर भेजा गया', resendIn: '{s}s में फिर भेजें', resend: 'कोड फिर भेजें', resent: 'कोड फिर भेजा गया', verified: 'ईमेल सत्यापित',
    errors: { invalidCode: 'कोड गलत या समाप्त है', codeFormat: '6 अंकों का कोड डालें', expired: 'सत्यापन समाप्त, फिर शुरू करें', rateLimited: 'बहुत अधिक प्रयास, बाद में करें', taken: 'ईमेल किसी अन्य खाते में उपयोग में है', invalidEmail: 'मान्य ईमेल पता डालें', mismatch: 'सत्यापन विफल, फिर साइन इन करें', unavailable: 'सेवा अनुपलब्ध, फिर प्रयास करें' },
  },
  es: {
    unverified: 'Correo sin verificar', bind: 'Añadir correo', back: 'Volver', changeEmail: 'Cambiar correo',
    emailLabel: 'Correo electrónico', emailPlaceholder: 'Correo electrónico', codeLabel: 'Código de 6 dígitos', codePlaceholder: 'Código de 6 dígitos',
    getCode: 'Enviar código', verify: 'Verificar', sending: 'Enviando código…', verifying: 'Verificando…',
    sentTo: 'Enviado a {email}', resendIn: 'Reenviar en {s}s', resend: 'Reenviar código', resent: 'Código reenviado', verified: 'Correo verificado',
    errors: { invalidCode: 'Código incorrecto o caducado', codeFormat: 'Introduce 6 dígitos', expired: 'Verificación caducada, reinicia', rateLimited: 'Demasiados intentos, espera', taken: 'Correo usado por otra cuenta', invalidEmail: 'Introduce un correo válido', mismatch: 'Verificación fallida, inicia sesión', unavailable: 'Servicio no disponible, reintenta' },
  },
  ar: {
    unverified: 'البريد غير مُوثّق', bind: 'إضافة بريد', back: 'رجوع', changeEmail: 'تغيير البريد',
    emailLabel: 'عنوان البريد الإلكتروني', emailPlaceholder: 'عنوان البريد الإلكتروني', codeLabel: 'رمز من 6 أرقام', codePlaceholder: 'رمز من 6 أرقام',
    getCode: 'إرسال الرمز', verify: 'تحقق', sending: 'جارٍ إرسال الرمز…', verifying: 'جارٍ التحقق…',
    sentTo: 'أُرسل إلى {email}', resendIn: 'إعادة الإرسال خلال {s}ث', resend: 'إعادة إرسال الرمز', resent: 'أُعيد إرسال الرمز', verified: 'تم توثيق البريد',
    errors: { invalidCode: 'رمز غير صحيح أو منتهي', codeFormat: 'أدخل 6 أرقام', expired: 'انتهى التحقق، ابدأ من جديد', rateLimited: 'محاولات كثيرة، حاول لاحقًا', taken: 'البريد مستخدم في حساب آخر', invalidEmail: 'أدخل بريدًا صالحًا', mismatch: 'فشل التحقق، سجّل الدخول مجددًا', unavailable: 'الخدمة غير متاحة، حاول مجددًا' },
  },
  fr: {
    unverified: 'E-mail non vérifié', bind: 'Ajouter un e-mail', back: 'Retour', changeEmail: 'Modifier l’e-mail',
    emailLabel: 'Adresse e-mail', emailPlaceholder: 'Adresse e-mail', codeLabel: 'Code à 6 chiffres', codePlaceholder: 'Code à 6 chiffres',
    getCode: 'Envoyer le code', verify: 'Vérifier', sending: 'Envoi du code…', verifying: 'Vérification…',
    sentTo: 'Envoyé à {email}', resendIn: 'Renvoi dans {s}s', resend: 'Renvoyer le code', resent: 'Code renvoyé', verified: 'E-mail vérifié',
    errors: { invalidCode: 'Code incorrect ou expiré', codeFormat: 'Saisissez 6 chiffres', expired: 'Vérification expirée, recommencez', rateLimited: 'Trop de tentatives, patientez', taken: 'E-mail déjà utilisé par un autre compte', invalidEmail: 'Saisissez un e-mail valide', mismatch: 'Échec, reconnectez-vous', unavailable: 'Service indisponible, réessayez' },
  },
  pt: {
    unverified: 'E-mail não verificado', bind: 'Adicionar e-mail', back: 'Voltar', changeEmail: 'Alterar e-mail',
    emailLabel: 'Endereço de e-mail', emailPlaceholder: 'Endereço de e-mail', codeLabel: 'Código de 6 dígitos', codePlaceholder: 'Código de 6 dígitos',
    getCode: 'Enviar código', verify: 'Verificar', sending: 'Enviando código…', verifying: 'Verificando…',
    sentTo: 'Enviado para {email}', resendIn: 'Reenviar em {s}s', resend: 'Reenviar código', resent: 'Código reenviado', verified: 'E-mail verificado',
    errors: { invalidCode: 'Código incorreto ou expirado', codeFormat: 'Digite 6 dígitos', expired: 'Verificação expirada, recomece', rateLimited: 'Muitas tentativas, aguarde', taken: 'E-mail usado por outra conta', invalidEmail: 'Digite um e-mail válido', mismatch: 'Falha, entre novamente', unavailable: 'Serviço indisponível, tente de novo' },
  },
}
