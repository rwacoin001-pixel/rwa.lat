import type { AppLocale } from './i18n'

const copy: Record<AppLocale, { image: string; hint: string; unavailable: string; suggestions: string; prompts: string[] }> = {
  'zh-CN': { image: '图片识别', hint: '识别场景与软件界面 · 图片随消息发送', unavailable: '图片识别暂不可用，请稍后重试', suggestions: '常见问题', prompts: ['这个页面怎么操作？', '如何给账户充值？', '为什么无法购买？', '如何完成身份认证？'] },
  en: { image: 'Image understanding', hint: 'Scenes and app screens · Image sent with your message', unavailable: 'Image understanding is unavailable. Try again later.', suggestions: 'Common questions', prompts: ['How do I use this screen?', 'How do I add funds?', 'Why can’t I buy?', 'How do I verify my identity?'] },
  es: { image: 'Reconocimiento de imagen', hint: 'Escenas y pantallas · La imagen se envía con tu mensaje', unavailable: 'Las imágenes no están disponibles. Reintenta más tarde.', suggestions: 'Preguntas frecuentes', prompts: ['¿Cómo uso esta pantalla?', '¿Cómo añado fondos?', '¿Por qué no puedo comprar?', '¿Cómo verifico mi identidad?'] },
  fr: { image: 'Analyse d’image', hint: 'Scènes et interfaces · Image envoyée avec votre message', unavailable: 'L’analyse d’image est indisponible. Réessayez plus tard.', suggestions: 'Questions fréquentes', prompts: ['Comment utiliser cet écran ?', 'Comment ajouter des fonds ?', 'Pourquoi ne puis-je pas acheter ?', 'Comment vérifier mon identité ?'] },
  pt: { image: 'Análise de imagem', hint: 'Cenas e telas · A imagem é enviada com sua mensagem', unavailable: 'A análise de imagem está indisponível. Tente depois.', suggestions: 'Perguntas frequentes', prompts: ['Como uso esta tela?', 'Como adiciono fundos?', 'Por que não posso comprar?', 'Como verifico minha identidade?'] },
  ar: { image: 'فهم الصور', hint: 'المشاهد وواجهات التطبيق · تُرسل الصورة مع رسالتك', unavailable: 'فهم الصور غير متاح. حاول لاحقًا.', suggestions: 'أسئلة شائعة', prompts: ['كيف أستخدم هذه الشاشة؟', 'كيف أضيف أموالًا؟', 'لماذا لا أستطيع الشراء؟', 'كيف أتحقق من هويتي؟'] },
  hi: { image: 'चित्र पहचान', hint: 'दृश्य और ऐप स्क्रीन · चित्र संदेश के साथ भेजा जाता है', unavailable: 'चित्र पहचान उपलब्ध नहीं है। बाद में प्रयास करें।', suggestions: 'आम प्रश्न', prompts: ['इस स्क्रीन का उपयोग कैसे करूँ?', 'पैसे कैसे जमा करूँ?', 'मैं खरीद क्यों नहीं सकता?', 'पहचान कैसे सत्यापित करूँ?'] },
}
export function aiVisualCopy(locale: AppLocale) { return copy[locale] }
