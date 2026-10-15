// Edge cache for the public market reads every home and markets screen makes. These endpoints carry no user
// context (no guard, no actor, no language variance), so one copy serves everyone.
//
// Stale-while-revalidate, not a plain cache: a hit is answered at once, and the same request still goes to the
// API in the background. That refreshes the copy and keeps every request in the API's visit log and daily
// activity, which a plain cache would silently drop for anonymous visitors.
// Order quotes (/catalog/products/:id/quote) are deliberately absent: they must always be live.
const PUBLIC_READS = new Set([
  '/v1/rwa/overview',
  '/v1/rwa/assets',
  '/v1/market-context',
  '/v1/polymarket/public-preview',
  '/v1/catalog/products',
  '/v1/basket/portfolios',
  '/v1/community/topics',
])

/** A copy older than this is not served; the visitor waits for the API as before. */
export const PUBLIC_READ_MAX_AGE = 60

export const isPublicRead = (method, pathname) => method === 'GET' && PUBLIC_READS.has(pathname)

/**
 * @param {Request} request the visitor's request
 * @param {{ cache?: Cache, waitUntil?: (task: Promise<unknown>) => void, forward: () => Promise<Response> }} deps
 */
export async function servePublicRead(request, { cache, waitUntil, forward }) {
  if (!cache || !waitUntil) return forward()
  const key = new Request(request.url, { method: 'GET' })
  const network = forward().then((response) => {
    if (response.ok && !response.headers.has('set-cookie')) {
      const headers = new Headers(response.headers)
      headers.set('cache-control', `public, max-age=${PUBLIC_READ_MAX_AGE}`)
      waitUntil(cache.put(key, new Response(response.clone().body, { status: response.status, headers })).catch(() => undefined))
    }
    return response
  })
  const cached = await cache.match(key).catch(() => undefined)
  if (!cached) return network
  waitUntil(network.catch(() => undefined))
  // The browser must not keep its own copy, or polling would read it instead of asking again.
  const headers = new Headers(cached.headers)
  headers.set('cache-control', 'no-cache')
  headers.set('x-edge-cache', 'hit')
  return new Response(cached.body, { status: cached.status, headers })
}
