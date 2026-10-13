/**
 * The a-reit.com Worker proxies /v1 to the API, so the API would otherwise see the Worker as the visitor.
 * Overwrites (never trusts) x-client-ip / x-client-country with what Cloudflare saw for this request;
 * the API reads them for privacy-preserving activity statistics only (never for access control).
 */
export function withClientHeaders(request) {
  const headers = new Headers(request.headers)
  headers.delete('x-client-ip')
  headers.delete('x-client-country')
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) headers.set('x-client-ip', ip)
  const country = request.cf?.country
  if (typeof country === 'string' && /^[A-Z][A-Z0-9]$/.test(country)) headers.set('x-client-country', country)
  return new Request(request, { headers })
}
