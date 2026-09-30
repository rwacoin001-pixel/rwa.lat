import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RWA.LAT — AI Investment OS',
    short_name: 'RWA.LAT',
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'portrait',
    background_color: '#F5F4F2',
    theme_color: '#F5F4F2',
    categories: ['finance', 'productivity'],
    shortcuts: [
      { name: 'Home', short_name: 'Home', url: '/home', icons: [{ src: '/icons/rwa-pwa-v2-192.png', sizes: '192x192' }] },
      { name: 'Invest', short_name: 'Invest', url: '/invest', icons: [{ src: '/icons/rwa-pwa-v2-192.png', sizes: '192x192' }] },
      { name: 'Portfolio', short_name: 'Portfolio', url: '/portfolio', icons: [{ src: '/icons/rwa-pwa-v2-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icons/rwa-pwa-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/rwa-pwa-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/rwa-pwa-v2-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/rwa-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
