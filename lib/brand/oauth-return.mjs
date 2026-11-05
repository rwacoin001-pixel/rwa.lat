import { resolveBrand } from './config.mjs'

/** Keep the registered provider callbacks. Only a matching, unconsumed Kimeng flow can return there. */
export async function kimengOAuthReturn(url, apiOrigin, fetcher) {
  const provider = /^\/auth\/callback\/(google|github)$/.exec(url.pathname)?.[1]
  const state = url.searchParams.get('state')
  if (!provider || !state?.startsWith('km_') || !/^km_[A-Za-z0-9_-]{43}$/.test(state)) return null
  const headers = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }
  try {
    const response = await fetcher(new URL(`/v1/auth/oauth/${provider}/kimeng-return`, apiOrigin), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state }), redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    if (!response.ok || (await response.json()).kimeng !== true) return new Response('Invalid or expired sign-in. Start again from Kimeng.', { status: 400, headers })
    const destination = new URL(url.pathname, resolveBrand('kimeng').origin)
    for (const name of ['code', 'state', 'error']) {
      const value = url.searchParams.get(name)
      if (value) destination.searchParams.set(name, value)
    }
    return new Response(null, { status: 303, headers: { ...headers, location: destination.href } })
  } catch {
    return new Response('Sign-in is temporarily unavailable. Start again from Kimeng.', { status: 503, headers })
  }
}
