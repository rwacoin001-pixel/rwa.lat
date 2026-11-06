// Bump this release cache when shipping app changes so installed PWAs cannot replay an old page shell with mismatched assets.
const KIMENG = self.location.origin === 'https://kimengresearch.com'
const CACHE_NAME = KIMENG ? 'a-reit-offline-kimeng-v6' : 'a-reit-offline-v4'
const OFFLINE_PAGE = KIMENG ? '/offline-kimeng' : '/offline'
const SHELL_WAIT_MS = 1500
// Installed app (Home Screen web app, Android client): the page says so once (lib/document-preferences-bootstrap.ts)
// and the worker keeps the answer here, because the launch navigation arrives before any page code can run.
const INSTALLED_KEY = '/__rwa/installed-app'
// A launch shell older than this is not shown instantly; it waits for the network like any other navigation.
const LAUNCH_SHELL_MAX_AGE_MS = 3 * 24 * 3600 * 1000
const OFFLINE_ASSETS = KIMENG ? [OFFLINE_PAGE, '/brand/kimeng/mark-light.svg', '/home'] : [
  OFFLINE_PAGE,
  '/brand/a-reit/app-icon.svg',
  '/icons/a-reit-v1-192.png',
  '/icons/a-reit-v1-512.png',
  '/icons/a-reit-v1-maskable-512.png',
  '/home',
]
// No photos here: the first launch of the installed app used to download ~5MB of artwork (three files no page
// used any more) while the app itself was loading. Images are cached as pages actually show them.

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
    caches.keys().then((keys) => Promise.all(keys.filter((key) => (key.startsWith('rwa-lat-offline-') || key.startsWith('a-reit-offline-')) && key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

// The iPhone Home Screen app's own pack (2026-11-04, user: keep more of the app on the phone, like the Android
// client). After launch the page asks once; the worker reads the build's /app-pack/manifest.json (the list the Android
// APK ships) and, one file at a time, keeps all code plus every image and font up to 400 KB (about 25 MB; big
// originals, invite posters and OCR data stay on the network). Files a newer build no longer lists are dropped.
// The cache-first branch below serves them (caches.match searches every cache). Safe to stop and resume.
const PACK_CACHE = 'a-reit-pack'
const PACK_MAX_BYTES = 400 * 1024
let packRun = null
function packWanted(file) {
  if (KIMENG) return file.p !== '/offline-kimeng.html' // The public URL is already precached.
  return file.p.startsWith('/_next/static/') || (file.s <= PACK_MAX_BYTES && !/^\/(?:ai-ocr|vendor|media\/referral)\//.test(file.p))
}
async function warmPack() {
  const response = await fetch('/app-pack/manifest.json', { cache: 'no-cache' })
  if (!response.ok) return
  const manifest = await response.json()
  const want = (manifest.files || []).filter(packWanted)
  const wanted = new Set(want.map((file) => file.p))
  const cache = await caches.open(PACK_CACHE)
  const have = new Set((await cache.keys()).map((request) => new URL(request.url).pathname))
  const save = async (file) => {
    if (have.has(file.p)) return
    try {
      const body = await fetch(file.p, { cache: 'no-cache' })
      if (body.ok && !(body.headers.get('content-type') || '').includes('text/html')) await cache.put(file.p, body)
    } catch { /* offline or evicted: the next launch resumes */ }
  }
  const concurrency = KIMENG ? 4 : 1
  for (let i = 0; i < want.length; i += concurrency) await Promise.all(want.slice(i, i + concurrency).map(save))
  await Promise.all([...have].filter((path) => !wanted.has(path)).map((path) => cache.delete(path)))
}

self.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data.type === 'WARM_PACK') {
    packRun ??= warmPack().catch(() => null).finally(() => { packRun = null })
    event.waitUntil(packRun)
    return
  }
  if (event.data.type !== 'INSTALLED_APP') return
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(INSTALLED_KEY, new Response('1'))))
})

// The installed app's launch: no window of this site is open yet, so nothing on screen can mix an older page with
// newer code. Later full navigations inside a running app stay network-first.
async function instantLaunchShell(request) {
  const [installed, windows] = await Promise.all([caches.match(INSTALLED_KEY), self.clients.matchAll({ type: 'window', includeUncontrolled: true })])
  if (!installed || windows.length) return null
  const cached = await caches.match(request)
  const date = cached && Date.parse(cached.headers.get('date') || '')
  return cached && date && Date.now() - date < LAUNCH_SHELL_MAX_AGE_MS ? cached : null
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/')) {
    event.respondWith(fetch(event.request))
    return
  }

  // Installed Android apps need the current start URL and brand colors. Never
  // pin an old manifest behind the generic static-asset cache-first strategy.
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request,response.clone())))
      return response
    }).catch(() => caches.match(event.request)))
    return
  }

  if (event.request.mode === 'navigate') {
    // Never replay a cached authentication page or one-time callback URL.
    if (/^\/(?:auth|login|register|verify-email|recovery)(?:\/|$)/.test(url.pathname)) {
      event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)))
      return
    }
    // Kimeng only saves anonymous route shells. Account pages and query-bearing links stay live.
    if (KIMENG && (url.search || !['/', '/home', '/markets', '/community', '/quant', '/predictions'].includes(url.pathname))) {
      event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)))
      return
    }
    // Network first, as before, but a launch never waits on a slow network for longer than SHELL_WAIT_MS when
    // the last shell is cached: that one shows, and the network answer still refreshes the cache for next time.
    // The installed app's launch shows the last shell at once (instantLaunchShell) and refreshes it the same way.
    // A shell from an older build is safe: app/error.tsx reloads once on a missing chunk.
    const network = fetch(event.request)
      .then(async (response) => {
        // A redirected answer is another page (signed-out /home ends on /login): never keep it under this URL.
        if (response.ok && !response.redirected) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)))
        }
        // Cloudflare failures are HTTP responses, not network exceptions.
        // Keep the installed app usable with its last valid shell on a 5xx.
        if (response.status >= 500) return (await caches.match(event.request)) || (await caches.match(OFFLINE_PAGE)) || response
        return response
      })
      .catch(async () => (await caches.match(event.request)) || (await caches.match('/home')) || caches.match(OFFLINE_PAGE))
    event.waitUntil(network.catch(() => null))
    event.respondWith(instantLaunchShell(event.request).catch(() => null).then((shell) => shell || Promise.race([
      network,
      new Promise((resolve) => setTimeout(resolve, SHELL_WAIT_MS)).then(async () => (await caches.match(event.request)) || network),
    ])))
    return
  }

  // Only immutable files are cache-first. Everything else (RSC payloads, route data) goes to the
  // network so an old build's payload can never be replayed against a newer set of chunks.
  const immutable = url.pathname.startsWith('/_next/static/') || /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|mp4)$/.test(url.pathname)
  if (!immutable) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
    return
  }

  // A missing build chunk used to come back as a 200 HTML page; caching that under a .js URL
  // broke the page on every visit. Only cache real assets (v2 also drops the poisoned v1 cache).
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && !(response.headers.get('content-type') || '').includes('text/html')) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)))
      }
      return response
    })),
  )
})
