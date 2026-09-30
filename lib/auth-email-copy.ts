import type { AppLocale } from './i18n'

type EmailCopy = {
  sendCode: string; sendLink: string; codeLabel: string; verify: string;
  verifying: string; resend: string; changeEmail: string; invalidCode: string;
  invalidOrExpired: string;
}
export const authEmailCopy: Record<AppLocale, EmailCopy> = {
  'zh-CN': { sendCode: '获取验证码', sendLink: '发送链接', codeLabel: '验证码', verify: '继续', verifying: '验证中', resend: '重新发送', changeEmail: '修改邮箱', invalidCode: '请输入 6 位验证码', invalidOrExpired: '验证码错误或失效' },
  en: { sendCode: 'Send code', sendLink: 'Send link', codeLabel: 'Code', verify: 'Continue', verifying: 'Verifying', resend: 'Resend', changeEmail: 'Change email', invalidCode: 'Enter a 6-digit code', invalidOrExpired: 'Incorrect or expired code' },
  es: { sendCode: 'Enviar código', sendLink: 'Enviar enlace', codeLabel: 'Código', verify: 'Continuar', verifying: 'Verificando', resend: 'Reenviar', changeEmail: 'Cambiar correo', invalidCode: 'Introduce 6 dígitos', invalidOrExpired: 'Código incorrecto o caducado' },
  fr: { sendCode: 'Envoyer un code', sendLink: 'Envoyer un lien', codeLabel: 'Code', verify: 'Continuer', verifying: 'Vérification', resend: 'Renvoyer', changeEmail: 'Modifier l’e-mail', invalidCode: 'Saisissez 6 chiffres', invalidOrExpired: 'Code incorrect ou expiré' },
  pt: { sendCode: 'Enviar código', sendLink: 'Enviar link', codeLabel: 'Código', verify: 'Continuar', verifying: 'Verificando', resend: 'Reenviar', changeEmail: 'Alterar e-mail', invalidCode: 'Digite 6 dígitos', invalidOrExpired: 'Código incorreto ou expirado' },
  hi: { sendCode: 'कोड भेजें', sendLink: 'लिंक भेजें', codeLabel: 'कोड', verify: 'जारी रखें', verifying: 'सत्यापन जारी', resend: 'फिर भेजें', changeEmail: 'ईमेल बदलें', invalidCode: '6 अंकों का कोड डालें', invalidOrExpired: 'कोड गलत या समाप्त है' },
  ar: { sendCode: 'إرسال الرمز', sendLink: 'إرسال الرابط', codeLabel: 'الرمز', verify: 'متابعة', verifying: 'جارٍ التحقق', resend: 'إعادة الإرسال', changeEmail: 'تغيير البريد', invalidCode: 'أدخل 6 أرقام', invalidOrExpired: 'رمز غير صحيح أو منتهي' },
}

/** Includes iPadOS Safari's desktop user agent without treating small desktop windows as phones. */
export function usesMobileEmailCode(userAgent: string, maxTouchPoints: number): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
}

export function normalizeEmailCode(value: string): string {
  return value.replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xff10)).replace(/[^0-9]/g, '').slice(0, 6)
}
