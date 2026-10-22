/**
 * One source of truth for product imagery, so a card and its detail page always show the same picture
 * (and the list → detail shared-image transition has a real pair to fly between).
 * Editorial illustrations only — never presented as a photograph of the underlying asset.
 */
import { apiUrl } from './api/_http'

/** Local project imagery for catalog products, matched strictly by CatalogProduct.externalRef. */
const PRODUCT_IMAGES: Record<string, string> = {
  'h100-inference-pool': '/media/generated/project-assets/h100-inference-ops-v1.png',
  'solar-income-2027': '/media/generated/project-assets/solar-income-ops-v1.png',
  'tech-growth-etf': '/media/generated/project-assets/tech-growth-etf-ops-v1.png',
}

/** Class imagery for products and directory assets without their own picture. */
export function classCover(assetClass: string, name = ''): string | null {
  const kind = assetClass.toLowerCase()
  if (kind === 'treasury' || kind === 'bond' || /t-?bill|treasur/i.test(name)) return '/media/home/feed-treasury-concept.webp'
  if (/solar/i.test(name)) return '/media/home/feed-solar-concept.webp'
  if (kind === 'real_estate' || /multifamily|estate/i.test(name)) return '/media/home/asset-real-estate.webp'
  if (kind === 'compute') return '/media/home/feed-compute-concept.webp'
  if (kind === 'rwa' || kind === 'infrastructure') return '/media/home/asset-infrastructure.webp'
  if (kind === 'stocks') return '/media/home/asset-treasury-paper.webp'
  return null
}

type ProductLike = { imageUrl?: string | null; externalRef?: string | null; assetClassId: string; displayName: string }

/** Catalog product: its own upload, then the curated project image, then the class picture. */
export function productCover(product: ProductLike): { src: string; remote: boolean } | null {
  if (product.imageUrl) return { src: apiUrl(product.imageUrl), remote: true }
  if (product.externalRef && PRODUCT_IMAGES[product.externalRef]) return { src: PRODUCT_IMAGES[product.externalRef], remote: false }
  const fallback = classCover(product.assetClassId, product.displayName)
  return fallback ? { src: fallback, remote: false } : null
}

/** Live basket portfolio: covers ship per strategy slug in /public/baskets (cover for heroes, thumb for rows). */
export function basketCover(basket: { strategySlug?: string | null }, size: 'cover' | 'thumb' = 'cover'): string | null {
  return basket.strategySlug ? `/baskets/${encodeURIComponent(basket.strategySlug)}_${size}.webp` : null
}

/** Shared-element keys. Both the list item and the detail page must use the same key for the same entity. */
export const sharedKeys = {
  asset: (slug: string, part: 'image' | 'title') => `asset:${slug}:${part}`,
  basket: (id: string, part: 'image' | 'title') => `basket:${id}:${part}`,
  strategy: (id: string, part: 'image' | 'title') => `strategy:${id}:${part}`,
}
