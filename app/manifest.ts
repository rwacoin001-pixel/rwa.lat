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
    background_color: '#F5F6F8',
    theme_color: '#F5F6F8',
    categories: ['finance', 'productivity'],
    shortcuts: [
      { name: 'Home', short_name: 'Home', url: '/home', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
      { name: 'Markets', short_name: 'Markets', url: '/markets', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
      { name: 'Assets', short_name: 'Assets', url: '/assets', icons: [{ src: '/icons/a-reit-v1-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icons/a-reit-v1-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/a-reit-v1-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/a-reit-v1-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/a-reit/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
