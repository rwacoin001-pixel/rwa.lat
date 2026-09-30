export const localeOptions = [
  { code: 'en', label: 'English', direction: 'ltr' },
  { code: 'zh-CN', label: '简体中文', direction: 'ltr' },
  { code: 'hi', label: 'हिन्दी', direction: 'ltr' },
  { code: 'es', label: 'Español', direction: 'ltr' },
  { code: 'ar', label: 'العربية', direction: 'rtl' },
  { code: 'fr', label: 'Français', direction: 'ltr' },
  { code: 'pt', label: 'Português', direction: 'ltr' },
] as const

export type AppLocale = (typeof localeOptions)[number]['code']
