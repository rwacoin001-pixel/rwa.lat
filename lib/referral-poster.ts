import type { AppLocale } from './app-locales'
import { posterCopy } from './referral-poster-copy'
import { ART_STYLES, artHeadlines, artStyleNames } from './referral-poster-art'
import { ART_STYLES_2, artHeadlines2, artStyleNames2 } from './referral-poster-art-2'
import { artLayouts } from './referral-poster-layouts'
import { artLayouts2 } from './referral-poster-layouts-2'
import { ART_STYLES_3, artHeadlines3, artStyleNames3 } from './referral-poster-art-3'
import { artLayouts3 } from './referral-poster-layouts-3'
import { ART_STYLES_4, artHeadlines4, artStyleNames4 } from './referral-poster-art-4'
import { artLayouts4 } from './referral-poster-layouts-4'
import { ART_STYLES_5, artHeadlines5, artStyleNames5 } from './referral-poster-art-5'
import { artLayouts5 } from './referral-poster-layouts-5'

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
export type ArtStyle = typeof ART_STYLES[number] | typeof ART_STYLES_2[number] | typeof ART_STYLES_3[number] | typeof ART_STYLES_4[number] | typeof ART_STYLES_5[number]
export type PosterStyle = 'portal' | 'statement' | 'connection' | 'skyline' | 'orbit' | 'terrace' | ArtStyle
// Style families (2026-11-04 round 2): the chips group 39 posters by family; 'random' is a UI mode, not a family.
export type PosterCategory = 'minimal' | 'ink' | 'painting' | 'anime' | 'modern' | 'future' | 'dream' | 'graphic'
export const POSTER_CATEGORIES: PosterCategory[] = ['minimal', 'ink', 'painting', 'anime', 'modern', 'future', 'dream', 'graphic']
export const posterCategoryNames: Record<AppLocale, Record<PosterCategory | 'random' | 'another', string>> = {
  'zh-CN': { random: '随机', another: '换一张', minimal: '简约', ink: '东方', painting: '绘画', anime: '动画', modern: '现代', future: '未来', dream: '梦境', graphic: '图形' },
  en: { random: 'Random', another: 'Another', minimal: 'Minimal', ink: 'Eastern', painting: 'Painting', anime: 'Anime', modern: 'Modern', future: 'Future', dream: 'Dream', graphic: 'Graphic' },
  hi: { random: 'रैंडम', another: 'दूसरा', minimal: 'सादगी', ink: 'पूर्वी', painting: 'चित्रकला', anime: 'एनीमे', modern: 'आधुनिक', future: 'भविष्य', dream: 'सपना', graphic: 'ग्राफ़िक' },
  es: { random: 'Al azar', another: 'Otra', minimal: 'Minimal', ink: 'Oriental', painting: 'Pintura', anime: 'Anime', modern: 'Moderno', future: 'Futuro', dream: 'Sueño', graphic: 'Gráfico' },
  ar: { random: 'عشوائي', another: 'أخرى', minimal: 'بسيط', ink: 'شرقي', painting: 'رسم', anime: 'أنمي', modern: 'حداثة', future: 'مستقبل', dream: 'حلم', graphic: 'جرافيك' },
  fr: { random: 'Au hasard', another: 'Une autre', minimal: 'Épuré', ink: 'Orient', painting: 'Peinture', anime: 'Anime', modern: 'Moderne', future: 'Futur', dream: 'Rêve', graphic: 'Graphique' },
  pt: { random: 'Aleatório', another: 'Outra', minimal: 'Minimal', ink: 'Oriental', painting: 'Pintura', anime: 'Anime', modern: 'Moderno', future: 'Futuro', dream: 'Sonho', graphic: 'Gráfico' },
}
/** Where the headline sits on an art-style poster, designed per artwork (fractions of the 3:4 artwork). */
export type PosterBox = { x: number; y: number; w: number; h: number }
export type PosterLayout = { text: PosterBox; subject: PosterBox; align: 'start' | 'center' | 'end'; vertical: boolean; ink: 'ink' | 'paper' | 'teal'; font: 'serif' | 'sans'; scrim: 'none' | 'soft' | 'strong'; footer: 'light' | 'dark'; top: 'light' | 'dark' }
export type PosterTemplate = {
  id: string; platform: PosterPlatform['id']; kind: PosterKind; dark: boolean; art: string; style: PosterStyle; category: PosterCategory
  /** Minimal posters: share of the artwork kept empty above the sculpture for the copy. */
  empty?: number; centered?: boolean; reverse?: boolean
  layout?: PosterLayout
}
type MinimalStyle = Exclude<PosterStyle, ArtStyle>
const minimalStyleNames: Record<AppLocale, Record<MinimalStyle, string>> = {
  'zh-CN': { portal: '光影之门', statement: '墨色宣言', connection: '绿色连接', skyline: '静夜之门', orbit: '斜面留白', terrace: '空间序列' },
  en: { portal: 'Light & space', statement: 'The statement', connection: 'Connections', skyline: 'After dark', orbit: 'Plane studies', terrace: 'Spatial sequence' },
  hi: { portal: 'रोशनी और स्थान', statement: 'अंकों की बात', connection: 'नए संबंध', skyline: 'रात का द्वार', orbit: 'ज्यामितीय रूप', terrace: 'स्थान का क्रम' },
  es: { portal: 'Luz y espacio', statement: 'En cifras', connection: 'Conexiones', skyline: 'Puerta nocturna', orbit: 'Planos y luz', terrace: 'Secuencia espacial' },
  ar: { portal: 'ضوء ومساحة', statement: 'لغة الأرقام', connection: 'روابط جديدة', skyline: 'باب الليل', orbit: 'سطوح وضوء', terrace: 'تسلسل المساحات' },
  fr: { portal: 'Lumière et espace', statement: 'En chiffres', connection: 'Connexions', skyline: 'Porte nocturne', orbit: 'Plans et lumière', terrace: 'Séquence spatiale' },
  pt: { portal: 'Luz e espaço', statement: 'Em números', connection: 'Conexões', skyline: 'Porta noturna', orbit: 'Planos e luz', terrace: 'Sequência espacial' },
}
const minimalHeadlines: Record<AppLocale, Record<MinimalStyle, string>> = {
  'zh-CN': { portal: '与好友，\n分享更多可能。', statement: '每次连接，\n都有回响。', connection: '下一程，\n一起向前。', skyline: '打开一扇门，\n连接更多可能。', orbit: '好的连接，\n值得分享。', terrace: '从一次分享，\n开始。' },
  en: { portal: 'Open a door.\nShare a possibility.', statement: 'Connections\nthat resonate.', connection: 'The next chapter.\nTogether.', skyline: 'A wider horizon.\nA shared future.', orbit: 'Good connections.\nLasting resonance.', terrace: 'Start here.\nLook further.' },
  hi: { portal: 'नए दरवाज़े।\nनई संभावनाएँ।', statement: 'हर संबंध\nकी एक गूँज।', connection: 'अगला सफ़र।\nसाथ मिलकर।', skyline: 'नए क्षितिज।\nसाझी संभावनाएँ।', orbit: 'अच्छे संबंध।\nगहरी गूँज।', terrace: 'यहीं से शुरू करें।\nआगे देखें।' },
  es: { portal: 'Abre una puerta.\nComparte posibilidades.', statement: 'Conexiones\nque resuenan.', connection: 'El próximo capítulo.\nJuntos.', skyline: 'Nuevos horizontes.\nMás posibilidades.', orbit: 'Buenas conexiones.\nUna huella duradera.', terrace: 'Empieza aquí.\nMira más lejos.' },
  ar: { portal: 'افتح باباً.\nوشارك الإمكانات.', statement: 'روابط\nيتردد صداها.', connection: 'الفصل القادم.\nمعاً.', skyline: 'آفاق أوسع.\nوإمكانات مشتركة.', orbit: 'روابط طيبة.\nوصدى يدوم.', terrace: 'ابدأ من هنا.\nوانظر أبعد.' },
  fr: { portal: 'Ouvrez une porte.\nPartagez les possibles.', statement: 'Des liens\nqui résonnent.', connection: 'Le prochain chapitre.\nEnsemble.', skyline: 'De nouveaux horizons.\nDes possibles partagés.', orbit: 'De belles connexions.\nUn écho durable.', terrace: 'Commencez ici.\nVoyez plus loin.' },
  pt: { portal: 'Abra uma porta.\nCompartilhe possibilidades.', statement: 'Conexões\nque ressoam.', connection: 'O próximo capítulo.\nJuntos.', skyline: 'Novos horizontes.\nPossibilidades partilhadas.', orbit: 'Boas conexões.\nEcos duradouros.', terrace: 'Comece aqui.\nOlhe mais longe.' },
}
const merge = (minimal: Record<AppLocale, Record<MinimalStyle, string>>, art: Record<AppLocale, Record<ArtStyle, string>>) =>
  Object.fromEntries(Object.keys(minimal).map(locale => [locale, { ...minimal[locale as AppLocale], ...art[locale as AppLocale] }])) as Record<AppLocale, Record<PosterStyle, string>>
const both = (a: Record<AppLocale, Record<string, string>>, b: Record<AppLocale, Record<string, string>>) =>
  Object.fromEntries(Object.keys(a).map(locale => [locale, { ...a[locale as AppLocale], ...b[locale as AppLocale] }])) as Record<AppLocale, Record<ArtStyle, string>>
export const posterStyleNames = merge(minimalStyleNames, both(both(both(both(artStyleNames, artStyleNames2), artStyleNames3), artStyleNames4), artStyleNames5))
const posterHeadlines = merge(minimalHeadlines, both(both(both(both(artHeadlines, artHeadlines2), artHeadlines3), artHeadlines4), artHeadlines5))
const templates: PosterTemplate[] = POSTER_PLATFORMS.flatMap(platform => {
  const third: PosterKind = ['xiaohongshu', 'linkedin', 'tiktok'].includes(platform.id) ? 'guide' : 'fee'
  const styles: Array<Omit<PosterTemplate, 'id' | 'platform'>> = [
    { style: 'portal', kind: 'brand', dark: false, art: 'portal', category: 'minimal', empty: .40 },
    { style: 'statement', kind: 'purchase', dark: true, art: 'graphite', category: 'minimal', empty: .50 },
    { style: 'connection', kind: third, dark: false, art: 'connection', category: 'minimal', empty: .34, reverse: true },
    { style: 'skyline', kind: 'brand', dark: true, art: 'night-v2', category: 'minimal', empty: .38, centered: true },
    { style: 'orbit', kind: 'brand', dark: false, art: 'fold', category: 'minimal', empty: .32, centered: true },
    { style: 'terrace', kind: 'guide', dark: false, art: 'planes', category: 'minimal', empty: .36, reverse: true },
  ]
  // Full-bleed trial for the original six (user, 11-04): the copy sits on the photograph's own sky/wall above the sculpture.
  const minimalLayout = (style: Omit<PosterTemplate, 'id' | 'platform'>): PosterLayout => {
    // Reward posters carry a figure, a sentence and three levels: they get at least 40% of the height.
    const empty = Math.max(style.empty ?? .38, style.kind === 'fee' || style.kind === 'purchase' ? .4 : 0)
    return { text: { x: .07, y: .08, w: .86, h: empty - .1 }, subject: { x: .06, y: empty, w: .88, h: .9 - empty }, align: style.centered ? 'center' : 'start', vertical: false, ink: style.dark ? 'paper' : 'ink', font: 'sans', scrim: 'soft', footer: style.dark ? 'dark' : 'light', top: style.dark ? 'dark' : 'light' }
  }
  const minimal = styles.map((style, index) => ({ ...style, layout: minimalLayout(style), id: `${platform.id}-${index < 3 ? style.kind : style.style}`, platform: platform.id }))
  // Art styles are always the brand poster: no reward figures, so they never depend on a reward switch.
  const layouts = { ...artLayouts, ...artLayouts2, ...artLayouts3, ...artLayouts4, ...artLayouts5 } as Record<ArtStyle, typeof artLayouts[keyof typeof artLayouts]>
  // Film one-sheets first; the round-1 originals stay at the end of their families.
  const art = [...ART_STYLES_2, ...ART_STYLES_3.filter(style => artLayouts3[style]), ...ART_STYLES_4.filter(style => artLayouts4[style]), ...ART_STYLES_5.filter(style => artLayouts5[style]), ...ART_STYLES].map((style): PosterTemplate => {
    const { file, category, layout } = layouts[style]
    return { id: `${platform.id}-${style}`, platform: platform.id, style, kind: 'brand', dark: layout.footer === 'dark', art: file, category, layout }
  })
  return [...minimal, ...art]
})
export function posterTemplates(platform: string, category?: PosterCategory): PosterTemplate[] { return templates.filter(template => template.platform === platform && (!category || template.category === category)) }
/** With the poster's language, so the page behind the QR code reads the same language as the poster. */
export function invitationUrl(code: string, locale?: AppLocale): string {
  if (!/^[a-zA-Z0-9]{6,16}$/.test(code)) throw new Error('Invalid invitation code')
  return `https://a-reit.com/r/${code}${locale ? `?lang=${encodeURIComponent(locale)}` : ''}`
}
type Rules = { version: number; holdingRatesBps: number[]; feeRatesBps: number[] }
export type PosterInput = { code: string; locale: AppLocale; template: PosterTemplate; rules: Rules | null; purchaseRewardsEnabled?: boolean; feeRewardsEnabled?: boolean }
export function buildPosterModel(input: PosterInput) {
  const link = invitationUrl(input.code, input.locale)
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
    background: `/media/referral/posters/${template.art}.webp`,
    logo: `/brand/a-reit/logo-${(template.layout ? template.layout.top === 'dark' : template.dark) ? 'dark' : 'light'}.svg`,
    filename: `A-REIT-${platform.id}-${template.style}-${input.locale}-v${input.rules.version}.png`,
  }
}
export type PosterModel = ReturnType<typeof buildPosterModel>
