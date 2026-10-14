import type { AppLocale } from './i18n'

/**
 * Copy around the assistant's pearl. The welcome says one short line, like the chat apps people already know;
 * suggestions sit as chips above the composer, and voice instructions live on the hold bar, not under the pearl.
 */
type PearlCopy = { morning: string; afternoon: string; evening: string; ask: string; busy: string; listening: string; suggestions: string }

const copy: Record<AppLocale, PearlCopy> = {
  'zh-CN': { morning: '早上好', afternoon: '下午好', evening: '晚上好', ask: '{g}，有什么可以帮你？', busy: '正在回答，可随时停止', listening: '请说…', suggestions: '你可以问' },
  en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', ask: '{g}. How can I help?', busy: 'Answering. You can stop anytime', listening: 'Listening…', suggestions: 'Try asking' },
  es: { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches', ask: '{g}. ¿En qué te ayudo?', busy: 'Respondiendo. Puedes detenerlo cuando quieras', listening: 'Te escucho…', suggestions: 'Puedes preguntar' },
  fr: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir', ask: '{g}. Comment puis-je vous aider ?', busy: 'Réponse en cours. Vous pouvez l’arrêter à tout moment', listening: 'Je vous écoute…', suggestions: 'Vous pouvez demander' },
  pt: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite', ask: '{g}. Como posso ajudar?', busy: 'Respondendo. Você pode parar a qualquer momento', listening: 'Estou ouvindo…', suggestions: 'Você pode perguntar' },
  ar: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير', ask: '{g}، كيف يمكنني مساعدتك؟', busy: 'جارٍ الرد. يمكنك الإيقاف في أي وقت', listening: 'أنا أستمع…', suggestions: 'يمكنك أن تسأل' },
  hi: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्या', ask: '{g}, मैं कैसे मदद करूँ?', busy: 'जवाब दिया जा रहा है। आप कभी भी रोक सकते हैं', listening: 'सुन रहा हूँ…', suggestions: 'आप पूछ सकते हैं' },
}

export const aiPearlCopy = (locale: AppLocale) => copy[locale] ?? copy.en

/** One welcome line by the reader's local hour: before 12 morning, before 18 afternoon, otherwise evening. */
export function pearlGreeting(locale: AppLocale, hour = new Date().getHours()) {
  const c = aiPearlCopy(locale)
  const g = hour < 5 ? c.evening : hour < 12 ? c.morning : hour < 18 ? c.afternoon : c.evening
  return c.ask.replace('{g}', g)
}
