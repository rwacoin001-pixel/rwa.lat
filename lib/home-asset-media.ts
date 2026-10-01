/** Editorial illustrations, not issuer logos or photographs of the underlying asset. */
const featuredCovers: Record<string, string> = {
  gold: '/media/products/hengxu-v2/derived/liujin-gold-720.webp',
  nvidia: '/media/products/hengxu-v2/derived/qiyuan-innovation-720.webp',
  spacex: '/media/products/hengxu-v2/derived/tuojie-frontier-720.webp',
  'micron-technology': '/media/home/feed-compute-concept.webp',
  microstrategy: '/media/products/hengxu-v2/derived/xinghe-digital-720.webp',
  circle: '/media/products/hengxu-v2/derived/chengyuan-reserve-720.webp',
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
