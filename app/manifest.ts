import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'A-REIT — AI Investment OS',
    short_name: 'A-REIT',
    description: 'One USDT wallet. Global opportunities. AI-guided decisions.',
    // Home is public and already restores the session. The legacy root Boot
    // route waits for account summary before navigating and adds a second page.
    start_url: '/home',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'portrait',
    background_color: '#F4F1EA',
    theme_color: '#F4F1EA',
    categories: ['finance', 'productivity'],
    shortcuts: [
      { name: 'Home', short_name: 'Home', url: '/home', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
      { name: 'Invest', short_name: 'Invest', url: '/invest', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
      { name: 'Portfolio', short_name: 'Portfolio', url: '/portfolio', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icons/a-reit-v1-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/a-reit-v1-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/a-reit-v1-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/a-reit/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
