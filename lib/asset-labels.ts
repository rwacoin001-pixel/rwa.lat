import type { AppLocale } from './i18n'

/**
 * Display labels for the raw asset-class and network ids the APIs send (`equity`, `fund`, `ethereum`).
 * Lists used to print those ids verbatim, so a Chinese page read "equity · ethereum". Classes are translated;
 * networks are proper nouns and only get their correct spelling. Unknown ids fall back to a tidied form.
 */
const CLASSES: Record<string, Record<AppLocale, string>> = {
  equity: { 'zh-CN': '股票', en: 'Equity', es: 'Acciones', fr: 'Actions', pt: 'Ações', ar: 'أسهم', hi: 'इक्विटी' },
  stocks: { 'zh-CN': '股票', en: 'Equities', es: 'Acciones', fr: 'Actions', pt: 'Ações', ar: 'أسهم', hi: 'इक्विटी' },
  fund: { 'zh-CN': '基金', en: 'Fund', es: 'Fondo', fr: 'Fonds', pt: 'Fundo', ar: 'صندوق', hi: 'फंड' },
  commodity: { 'zh-CN': '大宗商品', en: 'Commodity', es: 'Materia prima', fr: 'Matière première', pt: 'Commodity', ar: 'سلعة', hi: 'कमोडिटी' },
  treasury: { 'zh-CN': '国债', en: 'Treasury', es: 'Bonos del Tesoro', fr: 'Bons du Trésor', pt: 'Títulos do Tesouro', ar: 'سندات خزانة', hi: 'ट्रेज़री' },
  bond: { 'zh-CN': '债券', en: 'Bond', es: 'Bono', fr: 'Obligation', pt: 'Título de dívida', ar: 'سند', hi: 'बॉन्ड' },
  real_estate: { 'zh-CN': '房地产', en: 'Real estate', es: 'Inmobiliario', fr: 'Immobilier', pt: 'Imobiliário', ar: 'عقارات', hi: 'रियल एस्टेट' },
  private_credit: { 'zh-CN': '私募信贷', en: 'Private credit', es: 'Crédito privado', fr: 'Crédit privé', pt: 'Crédito privado', ar: 'ائتمان خاص', hi: 'प्राइवेट क्रेडिट' },
  stablecoin: { 'zh-CN': '稳定币', en: 'Stablecoin', es: 'Stablecoin', fr: 'Stablecoin', pt: 'Stablecoin', ar: 'عملة مستقرة', hi: 'स्टेबलकॉइन' },
  crypto: { 'zh-CN': '加密资产', en: 'Crypto', es: 'Cripto', fr: 'Crypto', pt: 'Cripto', ar: 'أصول مشفرة', hi: 'क्रिप्टो' },
  rwa: { 'zh-CN': '实物资产', en: 'Real assets', es: 'Activos reales', fr: 'Actifs réels', pt: 'Ativos reais', ar: 'أصول حقيقية', hi: 'वास्तविक संपत्ति' },
  compute: { 'zh-CN': '算力', en: 'Compute', es: 'Cómputo', fr: 'Calcul', pt: 'Computação', ar: 'قدرة حوسبة', hi: 'कंप्यूट' },
}

const NETWORKS: Record<string, string> = {
  ethereum: 'Ethereum', solana: 'Solana', tron: 'TRON', bsc: 'BNB Chain', bnb: 'BNB Chain', polygon: 'Polygon', arbitrum: 'Arbitrum',
  base: 'Base', optimism: 'Optimism', avalanche: 'Avalanche', stellar: 'Stellar', aptos: 'Aptos', sui: 'Sui', zksync: 'zkSync', near: 'NEAR',
}

const tidy = (id: string) => id.replace(/[_-]+/g, ' ').trim().replace(/^\w/, c => c.toUpperCase())

export function assetClassLabel(id: string | null | undefined, locale: AppLocale) {
  if (!id) return null
  const key = id.toLowerCase().replace(/[\s-]+/g, '_')
  return CLASSES[key]?.[locale] ?? CLASSES[key]?.en ?? tidy(id)
}

export function networkLabel(id: string | null | undefined) {
  if (!id) return null
  return NETWORKS[id.toLowerCase()] ?? tidy(id)
}
