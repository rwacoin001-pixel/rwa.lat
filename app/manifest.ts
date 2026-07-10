import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RWA.LAT — AI Investment OS',
    short_name: 'RWA.LAT',
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/rwa-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/rwa-mark-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }
}
