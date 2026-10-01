import type { AppLocale } from './app-locales'

type Copy = { title: string; change: string; newEmail: string; confirm: string; cancel: string; unavailable: string }
export const securityEmailCopy: Record<AppLocale, Copy> = {
  en: { title: 'Sign-in email', change: 'Change', newEmail: 'New email', confirm: 'Continue', cancel: 'Cancel', unavailable: 'Try again.' },
  'zh-CN': { title: '登录邮箱', change: '更换', newEmail: '新邮箱', confirm: '继续', cancel: '取消', unavailable: '请重试。' },
  hi: { title: 'लॉगिन ईमेल', change: 'बदलें', newEmail: 'नया ईमेल', confirm: 'जारी रखें', cancel: 'रद्द करें', unavailable: 'फिर कोशिश करें।' },
  es: { title: 'Correo de acceso', change: 'Cambiar', newEmail: 'Nuevo correo', confirm: 'Continuar', cancel: 'Cancelar', unavailable: 'Inténtalo de nuevo.' },
  ar: { title: 'بريد تسجيل الدخول', change: 'تغيير', newEmail: 'البريد الجديد', confirm: 'متابعة', cancel: 'إلغاء', unavailable: 'حاول مرة أخرى.' },
  fr: { title: 'E-mail de connexion', change: 'Modifier', newEmail: 'Nouvel e-mail', confirm: 'Continuer', cancel: 'Annuler', unavailable: 'Réessayez.' },
  pt: { title: 'E-mail de acesso', change: 'Alterar', newEmail: 'Novo e-mail', confirm: 'Continuar', cancel: 'Cancelar', unavailable: 'Tente novamente.' },
}
