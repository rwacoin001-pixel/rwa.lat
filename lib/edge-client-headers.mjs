/**
 * The a-reit.com Worker proxies /v1 to the API, so the API would otherwise see the Worker as the visitor.
 * Overwrites (never trusts) x-client-ip / x-client-country with what Cloudflare saw for this request and,
 * when EDGE_CLIENT_SIGNING_SECRET is set, signs them so the API can rate-limit by the real visitor:
 *
 *   x-client-sig: v1.<unix seconds>.<base64url HMAC-SHA256(secret, "v1|<seconds>|<ip>|<country>")>
 *
 * Verified by apps/api/src/common/edge-client.ts; unsigned values are only ever used for statistics.
 */
const encoder = new TextEncoder()
const keys = new Map()

function hmacKey(secret) {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    keys.set(secret, key)
  }
  return key
}

function base64url(buffer) {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function edgeClientSignature(secret, seconds, ip, country) {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`v1|${seconds}|${ip}|${country}`))
  return base64url(mac)
}

export async function withClientHeaders(request, secret, now = Date.now()) {
  const headers = new Headers(request.headers)
  headers.delete('x-client-ip')
  headers.delete('x-client-country')
  headers.delete('x-client-sig')
  const ip = request.headers.get('cf-connecting-ip')
  const raw = request.cf?.country
  const country = typeof raw === 'string' && /^[A-Z][A-Z0-9]$/.test(raw) ? raw : ''
  if (ip) {
    headers.set('x-client-ip', ip)
    if (country) headers.set('x-client-country', country)
    if (secret) {
      const seconds = Math.floor(now / 1000)
      headers.set('x-client-sig', `v1.${seconds}.${await edgeClientSignature(secret, seconds, ip, country)}`)
    }
  }
  return new Request(request, { headers })
}
