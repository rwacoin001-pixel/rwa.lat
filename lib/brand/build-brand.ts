import { resolveBrand, brandUiCopy } from './config.mjs'
export function getBuildBrand() { return resolveBrand(process.env.NEXT_PUBLIC_SITE_BRAND) }
export const BRAND = getBuildBrand()
export const IS_BRAND_PREVIEW = BRAND.id === 'kimeng' && process.env.NEXT_PUBLIC_BRAND_PREVIEW === '1'
export const brandText = (text: string, locale?: string) => brandUiCopy(text, BRAND, locale)
