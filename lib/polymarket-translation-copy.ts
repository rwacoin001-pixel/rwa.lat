import type { AppLocale } from '@/lib/app-locales'

type TranslationCopy = { translated: string; original: string; hideOriginal: string; loading: string; unavailable: string }

export const polymarketTranslationCopy: Record<AppLocale, TranslationCopy> = {
  en: { translated: 'Machine translation', original: 'View English original', hideOriginal: 'Hide original', loading: 'Translating', unavailable: 'Showing English original' },
  'zh-CN': { translated: '机器翻译', original: '查看英文原文', hideOriginal: '收起原文', loading: '翻译中', unavailable: '显示英文原文' },
  hi: { translated: 'मशीन अनुवाद', original: 'अंग्रेज़ी मूल देखें', hideOriginal: 'मूल छिपाएँ', loading: 'अनुवाद हो रहा है', unavailable: 'अंग्रेज़ी मूल दिखाया जा रहा है' },
  es: { translated: 'Traducción automática', original: 'Ver original en inglés', hideOriginal: 'Ocultar original', loading: 'Traduciendo', unavailable: 'Se muestra el original en inglés' },
  ar: { translated: 'ترجمة آلية', original: 'عرض النص الإنجليزي الأصلي', hideOriginal: 'إخفاء الأصل', loading: 'جارٍ الترجمة', unavailable: 'يُعرض الأصل الإنجليزي' },
  fr: { translated: 'Traduction automatique', original: 'Voir l’original anglais', hideOriginal: 'Masquer l’original', loading: 'Traduction en cours', unavailable: 'Original anglais affiché' },
  pt: { translated: 'Tradução automática', original: 'Ver original em inglês', hideOriginal: 'Ocultar original', loading: 'Traduzindo', unavailable: 'Original em inglês exibido' },
}
