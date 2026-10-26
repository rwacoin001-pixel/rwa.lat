/** Editorial illustrations, not issuer logos or photographs of the underlying asset. */
const featuredCovers: Record<string, string> = {
  gold: '/media/products/hengxu-v2/derived/liujin-gold-720.webp',
  nvidia: '/media/products/hengxu-v2/derived/qiyuan-innovation-720.webp',
  spacex: '/media/products/hengxu-v2/derived/tuojie-frontier-720.webp',
  'micron-technology': '/media/home/feed-compute-concept.webp',
  microstrategy: '/media/products/hengxu-v2/derived/xinghe-digital-720.webp',
  circle: '/media/products/hengxu-v2/derived/chengyuan-reserve-720.webp',
}

/** The curated cover for a directory asset, or null. Used by the asset hero so Home's thumbnail and the hero match. */
export function featuredCover(slug: string): string | null {
  return Object.hasOwn(featuredCovers, slug) ? featuredCovers[slug] : null
}

/**
 * Porcelain miniatures (public/media/porcelain, same world as the default avatars): one object per kind of asset.
 * -160 for 44px thumbnails, -480 for cards. docs/design-system.md §7.4.
 */
export type PorcelainArt = 'gold' | 'reit' | 'chip' | 'rocket' | 'treasury' | 'portfolio' | 'quant' | 'energy'
export const porcelainArt = (name: PorcelainArt, size: 160 | 480 = 160) => `/media/porcelain/${name}-${size}.webp`

const slugArt: Record<string, PorcelainArt> = { gold: 'gold', nvidia: 'chip', spacex: 'rocket', 'micron-technology': 'chip', microstrategy: 'chip', circle: 'treasury' }

function classArt(assetClass: string | undefined): PorcelainArt {
  switch ((assetClass ?? '').toLowerCase()) {
    case 'treasury': case 'bond': case 'stable_value': case 'private_credit': return 'treasury'
    case 'real_estate': return 'reit'
    case 'infrastructure': return 'energy'
    case 'commodity': return 'gold'
    default: return 'portfolio'
  }
}

/** The 44px thumbnail for an asset in a list: its porcelain miniature. */
export function homeAssetArt(asset: { slug: string; assetClass?: string }): string {
  return porcelainArt(Object.hasOwn(slugArt, asset.slug) ? slugArt[asset.slug] : classArt(asset.assetClass))
}

// Thumbnails render at 44px: small derived copies, not the 1.2-1.4k originals (1.8MB and 2.4MB as PNG).
export const HOME_ASSET_FALLBACK = '/media/home/derived/markets-collection-160.webp'

export function homeAssetImage(asset: { slug: string; assetClass?: string }, index: number): string {
  if (Object.hasOwn(featuredCovers, asset.slug)) return featuredCovers[asset.slug]
  switch ((asset.assetClass ?? '').toLowerCase()) {
    case 'treasury':
    case 'bond': return index % 2 ? '/media/home/asset-treasury-paper.webp' : '/media/home/derived/treasury-architecture-160.webp'
    case 'real_estate': return '/media/home/asset-real-estate.webp'
    case 'infrastructure': return '/media/home/asset-infrastructure.webp'
    case 'commodity': return '/media/products/hengxu-v2/derived/liujin-gold-720.webp'
    case 'equity':
    case 'fund': return '/media/products/hengxu-v2/derived/yuanjian-growth-720.webp'
    case 'stable_value': return '/media/products/hengxu-v2/derived/chengyuan-reserve-720.webp'
    case 'private_credit': return '/media/products/hengxu-v2/derived/runheng-income-720.webp'
    default: return HOME_ASSET_FALLBACK
  }
}
