import type { AppLocale } from './i18n'

type VoiceCopy = { title: string; back: string; hold: string; keyboard: string; release: string; cancel: string; transcribing: string }
const copy: Record<AppLocale, VoiceCopy> = {
  'zh-CN': { title: 'AI 客服', back: '返回', hold: '按住说话', keyboard: '键盘输入', release: '松开发送，上滑取消', cancel: '松开取消', transcribing: '正在识别…' },
  en: { title: 'AI Support', back: 'Back', hold: 'Hold to speak', keyboard: 'Use keyboard', release: 'Release to send, slide up to cancel', cancel: 'Release to cancel', transcribing: 'Transcribing…' },
  es: { title: 'Soporte IA', back: 'Volver', hold: 'Mantén para hablar', keyboard: 'Usar teclado', release: 'Suelta para enviar, desliza arriba para cancelar', cancel: 'Suelta para cancelar', transcribing: 'Transcribiendo…' },
  fr: { title: 'Assistance IA', back: 'Retour', hold: 'Maintenir pour parler', keyboard: 'Saisie au clavier', release: 'Relâcher pour envoyer, glisser vers le haut pour annuler', cancel: 'Relâcher pour annuler', transcribing: 'Transcription…' },
  pt: { title: 'Suporte IA', back: 'Voltar', hold: 'Segure para falar', keyboard: 'Usar teclado', release: 'Solte para enviar, deslize para cima para cancelar', cancel: 'Solte para cancelar', transcribing: 'Transcrevendo…' },
  ar: { title: 'دعم الذكاء الاصطناعي', back: 'رجوع', hold: 'اضغط مطولاً للتحدث', keyboard: 'استخدم لوحة المفاتيح', release: 'اترك للإرسال، اسحب للأعلى للإلغاء', cancel: 'اترك للإلغاء', transcribing: 'جارٍ تحويل الصوت…' },
  hi: { title: 'AI सहायता', back: 'वापस', hold: 'बोलने के लिए दबाए रखें', keyboard: 'कीबोर्ड इस्तेमाल करें', release: 'भेजने के लिए छोड़ें, रद्द करने के लिए ऊपर खिसकाएँ', cancel: 'रद्द करने के लिए छोड़ें', transcribing: 'आवाज़ पहचान रहा है…' },
}
export const aiVoiceCopy = (locale: AppLocale) => copy[locale]
