/** Editorial illustrations, not issuer logos or photographs of the underlying asset. */
const featuredCovers: Record<string, string> = {
  gold: '/media/products/hengxu-v2/derived/liujin-gold-720.webp',
  nvidia: '/media/products/hengxu-v2/derived/qiyuan-innovation-720.webp',
  spacex: '/media/products/hengxu-v2/derived/tuojie-frontier-720.webp',
  'micron-technology': '/media/home/feed-compute-concept.webp',
  microstrategy: '/media/products/hengxu-v2/derived/xinghe-digital-720.webp',
  circle: '/media/products/hengxu-v2/derived/chengyuan-reserve-720.webp',
  // Generated 2026-10-14 in the same series (no logos or products): one picture per tokenised listing.
  silver: '/media/products/assets/silver-720.webp',
  spy: '/media/products/assets/sp500-720.webp',
  qqq: '/media/products/assets/nasdaq100-720.webp',
  google: '/media/products/assets/alphabet-720.webp',
  apple: '/media/products/assets/apple-720.webp',
}

/** The editorial cover for an asset when one exists, by directory slug or catalog ref (`rwa-asset:<slug>`). */
export function assetCover(ref: string | null | undefined): string | null {
  const slug = ref?.replace(/^rwa-asset:/, '')
  return slug && Object.hasOwn(featuredCovers, slug) ? featuredCovers[slug] : null
}

export const HOME_ASSET_FALLBACK = '/media/generated/project-assets/markets-collection-v1.png'

export function homeAssetImage(asset: { slug: string; assetClass?: string }, index: number): string {
  if (Object.hasOwn(featuredCovers, asset.slug)) return featuredCovers[asset.slug]
  switch ((asset.assetClass ?? '').toLowerCase()) {
    case 'treasury':
    case 'bond': return index % 2 ? '/media/home/asset-treasury-paper.webp' : '/media/generated/design-v2/treasury-architecture-v1.png'
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
