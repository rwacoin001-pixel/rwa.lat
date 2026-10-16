import type { AppLocale } from './app-locales'
import { posterCopy } from './referral-poster-copy'

export const POSTER_PLATFORMS = [
  { id: 'wechat', label: '微信', width: 1440, height: 1440, format: '1:1', layout: 'community' },
  { id: 'xiaohongshu', label: '小红书', width: 1440, height: 1920, format: '3:4', layout: 'editorial' },
  { id: 'douyin', label: '抖音', width: 1080, height: 1920, format: '9:16', layout: 'story' },
  { id: 'instagram', label: 'Instagram', width: 1440, height: 1800, format: '4:5', layout: 'editorial' },
  { id: 'facebook', label: 'Facebook', width: 1440, height: 1800, format: '4:5', layout: 'feed' },
  { id: 'x', label: 'X', width: 1920, height: 1080, format: '16:9', layout: 'landscape' },
  { id: 'linkedin', label: 'LinkedIn', width: 1910, height: 1000, format: '1.91:1', layout: 'landscape' },
  { id: 'telegram', label: 'Telegram', width: 1440, height: 1440, format: '1:1', layout: 'community' },
  { id: 'whatsapp', label: 'WhatsApp', width: 1080, height: 1920, format: '9:16', layout: 'story' },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920, format: '9:16', layout: 'story' },
] as const
export type PosterPlatform = typeof POSTER_PLATFORMS[number]
export function posterPlatformName(platform: PosterPlatform, locale: AppLocale): string {
  if (locale === 'zh-CN') return platform.label
  return ({ wechat: 'WeChat', xiaohongshu: 'RedNote', douyin: 'Douyin' } as Record<string, string>)[platform.id] ?? platform.label
}
export type PosterKind = 'brand' | 'purchase' | 'fee' | 'guide'
export type PosterStyle = 'portal' | 'statement' | 'connection' | 'skyline' | 'orbit' | 'terrace'
export type PosterTemplate = { id: string; platform: PosterPlatform['id']; kind: PosterKind; dark: boolean; art: 'portal' | 'graphite' | 'connection' | 'night' | 'fold' | 'planes'; style: PosterStyle }
export const posterStyleNames: Record<AppLocale, Record<PosterStyle, string>> = {
  'zh-CN': { portal: '光影之门', statement: '墨色宣言', connection: '绿色连接', skyline: '静夜之门', orbit: '斜面留白', terrace: '空间序列' },
  en: { portal: 'Light & space', statement: 'The statement', connection: 'Connections', skyline: 'After dark', orbit: 'Plane studies', terrace: 'Spatial sequence' },
  hi: { portal: 'रोशनी और स्थान', statement: 'अंकों की बात', connection: 'नए संबंध', skyline: 'रात का द्वार', orbit: 'ज्यामितीय रूप', terrace: 'स्थान का क्रम' },
  es: { portal: 'Luz y espacio', statement: 'En cifras', connection: 'Conexiones', skyline: 'Puerta nocturna', orbit: 'Planos y luz', terrace: 'Secuencia espacial' },
  ar: { portal: 'ضوء ومساحة', statement: 'لغة الأرقام', connection: 'روابط جديدة', skyline: 'باب الليل', orbit: 'سطوح وضوء', terrace: 'تسلسل المساحات' },
  fr: { portal: 'Lumière et espace', statement: 'En chiffres', connection: 'Connexions', skyline: 'Porte nocturne', orbit: 'Plans et lumière', terrace: 'Séquence spatiale' },
  pt: { portal: 'Luz e espaço', statement: 'Em números', connection: 'Conexões', skyline: 'Porta noturna', orbit: 'Planos e luz', terrace: 'Sequência espacial' },
}
const posterHeadlines: Record<AppLocale, Record<PosterStyle, string>> = {
  'zh-CN': { portal: '与好友，\n分享更多可能。', statement: '每次连接，\n都有回响。', connection: '下一程，\n一起向前。', skyline: '打开一扇门，\n连接更多可能。', orbit: '好的连接，\n值得分享。', terrace: '从一次分享，\n开始。' },
  en: { portal: 'Open a door.\nShare a possibility.', statement: 'Connections\nthat resonate.', connection: 'The next chapter.\nTogether.', skyline: 'A wider horizon.\nA shared future.', orbit: 'Good connections.\nLasting resonance.', terrace: 'Start here.\nLook further.' },
  hi: { portal: 'नए दरवाज़े।\nनई संभावनाएँ।', statement: 'हर संबंध\nकी एक गूँज।', connection: 'अगला सफ़र।\nसाथ मिलकर।', skyline: 'नए क्षितिज।\nसाझी संभावनाएँ।', orbit: 'अच्छे संबंध।\nगहरी गूँज।', terrace: 'यहीं से शुरू करें।\nआगे देखें।' },
  es: { portal: 'Abre una puerta.\nComparte posibilidades.', statement: 'Conexiones\nque resuenan.', connection: 'El próximo capítulo.\nJuntos.', skyline: 'Nuevos horizontes.\nMás posibilidades.', orbit: 'Buenas conexiones.\nUna huella duradera.', terrace: 'Empieza aquí.\nMira más lejos.' },
  ar: { portal: 'افتح باباً.\nوشارك الإمكانات.', statement: 'روابط\nيتردد صداها.', connection: 'الفصل القادم.\nمعاً.', skyline: 'آفاق أوسع.\nوإمكانات مشتركة.', orbit: 'روابط طيبة.\nوصدى يدوم.', terrace: 'ابدأ من هنا.\nوانظر أبعد.' },
  fr: { portal: 'Ouvrez une porte.\nPartagez les possibles.', statement: 'Des liens\nqui résonnent.', connection: 'Le prochain chapitre.\nEnsemble.', skyline: 'De nouveaux horizons.\nDes possibles partagés.', orbit: 'De belles connexions.\nUn écho durable.', terrace: 'Commencez ici.\nVoyez plus loin.' },
  pt: { portal: 'Abra uma porta.\nCompartilhe possibilidades.', statement: 'Conexões\nque ressoam.', connection: 'O próximo capítulo.\nJuntos.', skyline: 'Novos horizontes.\nPossibilidades partilhadas.', orbit: 'Boas conexões.\nEcos duradouros.', terrace: 'Comece aqui.\nOlhe mais longe.' },
}
const templates: PosterTemplate[] = POSTER_PLATFORMS.flatMap(platform => {
  const third: PosterKind = ['xiaohongshu', 'linkedin', 'tiktok'].includes(platform.id) ? 'guide' : 'fee'
  const styles: Array<Omit<PosterTemplate, 'id' | 'platform'>> = [
    { style: 'portal', kind: 'brand', dark: false, art: 'portal' },
    { style: 'statement', kind: 'purchase', dark: true, art: 'graphite' },
    { style: 'connection', kind: third, dark: false, art: 'connection' },
    { style: 'skyline', kind: 'brand', dark: true, art: 'night' },
    { style: 'orbit', kind: 'brand', dark: false, art: 'fold' },
    { style: 'terrace', kind: 'guide', dark: false, art: 'planes' },
  ]
  return styles.map((style, index) => ({ ...style, id: `${platform.id}-${index < 3 ? style.kind : style.style}`, platform: platform.id }))
})
export function posterTemplates(platform: string): PosterTemplate[] { return templates.filter(template => template.platform === platform) }
export function invitationUrl(code: string): string {
  if (!/^[a-zA-Z0-9]{6,16}$/.test(code)) throw new Error('Invalid invitation code')
  return `https://a-reit.com/r/${code}`
}
type Rules = { version: number; holdingRatesBps: number[]; feeRatesBps: number[] }
export type PosterInput = { code: string; locale: AppLocale; template: PosterTemplate; rules: Rules | null; purchaseRewardsEnabled?: boolean; feeRewardsEnabled?: boolean }
export function buildPosterModel(input: PosterInput) {
  const link = invitationUrl(input.code)
  const template = templates.find(item => item.id === input.template.id)
  const copy = posterCopy[input.locale]
  if (!template || !copy || !input.rules || !Number.isSafeInteger(input.rules.version) || input.rules.version < 1) throw new Error('Poster rules unavailable')
  const platform = POSTER_PLATFORMS.find(item => item.id === template.platform)!
  const numeric = template.kind === 'purchase' || template.kind === 'fee'
  const rates = template.kind === 'purchase' ? input.rules.holdingRatesBps : input.rules.feeRatesBps
  if (numeric && ((template.kind === 'purchase' ? input.purchaseRewardsEnabled : input.feeRewardsEnabled) !== true || !Array.isArray(rates) || rates.length !== 3 || rates.some(rate => !Number.isInteger(rate) || rate < 0 || rate > 10000) || rates[0] === 0)) throw new Error('Reward unavailable')
  const pct = (bps: number) => `${bps / 100}%`
  const rate = numeric ? pct(rates[0]) : ''
  return {
    template, platform, locale: input.locale, dir: input.locale === 'ar' ? 'rtl' as const : 'ltr' as const,
    styleName: posterStyleNames[input.locale][template.style],
    code: input.code, link, version: input.rules.version,
    headline: posterHeadlines[input.locale][template.style], label: copy[template.kind],
    description: (template.kind === 'purchase' ? copy.purchaseText : template.kind === 'fee' ? copy.feeText : copy.brandText).replace('{rate}', rate),
    rate, levels: numeric ? rates.map((value, index) => `${copy.level} ${index + 1}: ${pct(value)}`).join('   /   ') : '',
    disclaimer: copy.disclaimer, scanLabel: copy.scan, codeLabel: copy.code, steps: copy.steps,
    background: `/media/referral/posters/${template.art === 'night' ? 'night-v2' : template.art}.webp`,
    logo: `/brand/a-reit/logo-${template.dark ? 'dark' : 'light'}.svg`,
    filename: `A-REIT-${platform.id}-${template.style}-${input.locale}-v${input.rules.version}.png`,
  }
}
export type PosterModel = ReturnType<typeof buildPosterModel>
