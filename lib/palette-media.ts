/**
 * Palette A preview artwork (cool white / graphite with a little brand green; art direction worked out with ChatGPT,
 * generated with gpt-6-astra). Old path → new path. Only components/palette-media.tsx reads this, and only on
 * devices that opted in with ?palette=a; the originals stay in place for everyone else.
 */
const HENGXU = ['chengyuan-reserve', 'hengcha-carry', 'liujin-gold', 'qiyuan-innovation', 'runheng-income', 'shiyuan-real-asset', 'tuojie-frontier', 'xinghe-digital', 'yuanjian-growth', 'zhongheng-balance']

export const PALETTE_A_MEDIA: Record<string, string> = {
  '/media/home/ai-basket-warm.webp': '/media/palette-a/ai-basket-light.webp',
  '/media/home/asset-treasury-paper.webp': '/media/palette-a/asset-treasury.webp',
  '/media/home/feed-treasury-concept.webp': '/media/palette-a/feed-treasury.webp',
  '/media/home/feed-solar-concept.webp': '/media/palette-a/feed-solar.webp',
  ...Object.fromEntries(HENGXU.flatMap(name => [720, 1440].map(width => [
    `/media/products/hengxu-v2/derived/${name}-${width}.webp`,
    `/media/palette-a/hengxu/${name}-${width}.webp`,
  ]))),
}
