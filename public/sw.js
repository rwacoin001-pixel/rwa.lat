const CACHE_NAME = 'rwa-lat-offline-v11'
const OFFLINE_ASSETS = [
  '/offline',
  '/rwa-mark.svg',
  '/icons/rwa-pwa-v2-192.png',
  '/icons/rwa-pwa-v2-512.png',
  '/icons/rwa-pwa-v2-maskable-512.png',
  '/welcome',
  '/home',
  '/markets',
  '/trust',
  '/assets',
  '/community',
  '/media/generated/project-assets/home-asset-hero-v1.png',
  '/media/generated/project-assets/home-solar-cover-v2.webp',
  '/media/generated/project-assets/home-residential-cover-v2.webp',
  '/media/generated/project-assets/markets-collection-v1.png',
  '/media/generated/project-assets/rwa-collection-v1.png',
  '/media/ai-particle-icon/rwa-particle-alpha.webm',
  '/media/ai-particle-icon/rwa-particle-icon-alpha-512.png',
]

// Precache one URL at a time instead of a single atomic addAll().
// addAll() rejects if ANY entry is not 2xx, which is exactly how install broke:
// four URLs in the old list became redirects (/offline.html -> /offline, /invest -> /markets,
// /portfolio and /wallet -> /assets), so the whole install failed and installed PWAs were
// stuck on a stale shell forever. Per-URL caching makes a single bad entry harmless.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        OFFLINE_ASSETS.map((url) =>
          fetch(url, { redirect: 'follow', cache: 'reload' })
            .then((response) => (response && response.ok ? cache.put(url, response) : null))
            .catch(() => null),
        ),
      ),
    ),
  )
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
      event.respondWith(fetch(event.request).catch(() => caches.match('/offline')))
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
        .catch(async () => (await caches.match(event.request)) || (await caches.match('/home')) || caches.match('/offline')),
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
