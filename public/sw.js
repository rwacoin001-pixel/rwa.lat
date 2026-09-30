const CACHE_NAME = 'rwa-lat-offline-v10'
const OFFLINE_ASSETS = [
  '/offline.html',
  '/rwa-mark.svg',
  '/icons/rwa-pwa-v2-192.png',
  '/icons/rwa-pwa-v2-512.png',
  '/icons/rwa-pwa-v2-maskable-512.png',
  '/welcome',
  '/home',
  '/invest',
  '/trust',
  '/portfolio',
  '/community',
  '/wallet',
  '/media/generated/project-assets/home-asset-hero-v1.png',
  '/media/generated/project-assets/home-solar-cover-v2.webp',
  '/media/generated/project-assets/home-residential-cover-v2.webp',
  '/media/generated/project-assets/markets-collection-v1.png',
  '/media/generated/project-assets/rwa-collection-v1.png',
  '/media/ai-particle-icon/rwa-particle-alpha.webm',
  '/media/ai-particle-icon/rwa-particle-icon-alpha-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
    event.respondWith(fetch(event.request))
    return
  }

  if (event.request.mode === 'navigate') {
    // Never replay a cached authentication page or one-time callback URL.
    if (/^\/(?:auth|login|register|verify-email|recovery)(?:\/|$)/.test(url.pathname)) {
      event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')))
      return
    }
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)))
          }
          return response
        })
        .catch(async () => (await caches.match(event.request)) || (await caches.match('/home')) || caches.match('/offline.html')),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)))
      }
      return response
    })),
  )
})
