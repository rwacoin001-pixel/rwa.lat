import type { AppLocale } from './i18n'

/**
 * A first, client-side guard for community posts (2026-10-28): private contact details and promises of returns are the
 * usual start of a scam ("add me on WeChat", "I lead trades", "guaranteed 20%"). The post is not sent; the writer is told
 * why. Server review comes later; this only stops the obvious cases early.
 */
const PATTERNS: RegExp[] = [
  /(微信|威信|薇信|vx|v信|wechat|weixin|whatsapp|telegram|电报|飞机号|tg群|qq号|line\s*id|加我|私聊我|私信我联系)/i,
  /(t\.me\/|wa\.me\/|chat\.whatsapp\.com)/i,
  /(带单|喊单|拉群|进群|跟单群|内幕|稳赚|保本|保证收益|包赚|零风险|翻倍)/,
  /(guaranteed\s+(return|profit|income)|risk[-\s]?free\s+(return|profit)|join\s+my\s+(group|channel)|dm\s+me\s+for\s+signals)/i,
  // Phone numbers: international with "+", or a mainland mobile; dates and prices do not match.
  /(\+\d{8,15}\b|(?<!\d)1[3-9]\d{9}(?!\d))/,
]

export function riskyPost(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text))
}

export const riskyPostMessage: Record<AppLocale, string> = {
  en: 'For everyone’s safety, posts can’t include private contact details or promise returns. Please edit and try again.',
  'zh-CN': '为了大家的安全，帖子里不能留私人联系方式，也不能承诺收益或带单。请修改后再发。',
  hi: 'सबकी सुरक्षा के लिए पोस्ट में निजी संपर्क या रिटर्न का वादा नहीं हो सकता। बदलकर फिर भेजें।',
  es: 'Por seguridad, las publicaciones no pueden incluir contactos privados ni prometer rentabilidad. Edítala y vuelve a intentarlo.',
  ar: 'حفاظًا على سلامة الجميع، لا يمكن أن تتضمن المنشورات بيانات تواصل خاصة أو وعودًا بالعوائد. عدّل المنشور وأعد المحاولة.',
  fr: 'Pour la sécurité de tous, les publications ne peuvent pas contenir de coordonnées privées ni promettre de rendement. Modifiez puis réessayez.',
  pt: 'Pela segurança de todos, as publicações não podem ter contatos privados nem prometer retorno. Edite e tente de novo.',
}
