import { isIP } from 'node:net'

/** Pure helpers for server-side activity recording: no I/O, so every rule is unit-testable. Ported from release-asr. */

export type VisitDevice = 'mobile' | 'desktop' | 'tablet' | 'bot' | 'other'

export const MAX_PATH_LENGTH = 200
export const MAX_USER_AGENT_LENGTH = 300
export const MAX_REFERRER_HOST_LENGTH = 253

type HeaderValue = string | string[] | undefined
export type IpSource = { ip?: string | null; headers: Record<string, HeaderValue> }

const BOT_PATTERN = /bot\b|bot\/|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|pingdom|uptime|monitor|statuscake|curl\/|wget\/|python-|aiohttp|httpx|axios\/|node-fetch|undici|node$|go-http-client|java\/|okhttp|libwww|httpclient|phantomjs|puppeteer|playwright|selenium|facebookexternalhit|embedly|preview|validator|feedfetcher|mediapartners|google-inspectiontool|bingpreview|yandex|baiduspider|bytespider|petalbot|semrush|ahrefs|mj12|dotbot|gptbot|claudebot|ccbot|perplexity|zgrab|masscan|nmap|nuclei|censys/i
const TABLET_PATTERN = /ipad|tablet|kindle|silk\/|playbook|nexus (7|9|10)|sm-[tx]\d|(android(?!.*mobile))/i
const MOBILE_PATTERN = /mobi|iphone|ipod|android|windows phone|blackberry|bb10|opera mini|iemobile|harmonyos|miuibrowser/i
const DESKTOP_PATTERN = /windows nt|macintosh|mac os x|x11|linux|cros/i

/**
 * Requests that are not end-user app usage: health probes, docs, the admin/analytics plane,
 * partner callbacks and webhooks. Matched against the pathname including the /v1 prefix.
 */
const SKIPPED_PATH = /^\/(?:v1\/(?:health|docs|analytics|admin|job-queue\/callbacks|compliance\/kyc\/webhooks|wallet\/callbacks|ledger\/callbacks|media\/email-)|robots\.txt$|favicon\.ico$)/i
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function firstHeader(value: HeaderValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : undefined
}

/** Strips the IPv4-mapped IPv6 prefix and brackets/ports; returns null when not an IP literal. */
export function normalizeIp(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  let candidate = value.trim()
  if (!candidate) return null
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate)
  if (bracketed) candidate = bracketed[1]
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(candidate)) candidate = candidate.slice(0, candidate.lastIndexOf(':'))
  if (/^::ffff:\d{1,3}(\.\d{1,3}){3}$/i.test(candidate)) candidate = candidate.slice(7)
  const zone = candidate.indexOf('%')
  if (zone > 0) candidate = candidate.slice(0, zone)
  return isIP(candidate) ? candidate.toLowerCase() : null
}

/** Loopback, RFC1918, CGNAT, link-local and ULA addresses: these are proxies, never the visitor. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
  }
  const lower = ip.toLowerCase()
  return lower === '::1' || lower === '::' || /^f[cd][0-9a-f]{2}:/.test(lower) || /^fe[89ab][0-9a-f]:/.test(lower)
}

/**
 * Headers the a-reit.com frontend Worker sets on the /v1 requests it proxies to this API. Browser traffic
 * reaches the API from the Worker, so Cloudflare's own CF-Connecting-IP / CF-IPCountry describe the Worker,
 * not the visitor. The Worker always overwrites these (clients cannot inject them through a-reit.com);
 * a caller hitting the API directly could forge them, which only skews analytics, never access control.
 */
export const EDGE_CLIENT_IP_HEADER = 'x-client-ip'
export const EDGE_CLIENT_COUNTRY_HEADER = 'x-client-country'

/**
 * Client IP in priority order: the frontend Worker's x-client-ip, CF-Connecting-IP (set by Cloudflare), then Express `request.ip`
 * (already resolved through TRUST_PROXY_HOPS; Caddy sets X-Forwarded-For to CF-Connecting-IP),
 * then the first X-Forwarded-For entry when request.ip is only a proxy address.
 */
export function extractClientIp(source: IpSource): string | null {
  const edge = normalizeIp(firstHeader(source.headers[EDGE_CLIENT_IP_HEADER]))
  if (edge) return edge
  const cf = normalizeIp(firstHeader(source.headers['cf-connecting-ip']))
  if (cf) return cf
  const resolved = normalizeIp(source.ip)
  if (resolved && !isPrivateIp(resolved)) return resolved
  const forwarded = firstHeader(source.headers['x-forwarded-for'])
  if (forwarded) {
    const first = normalizeIp(forwarded.split(',')[0])
    if (first) return first
  }
  return resolved
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim()
  return ua.length < 10 || BOT_PATTERN.test(ua)
}

export function classifyDevice(userAgent: string | null | undefined): VisitDevice {
  const ua = userAgent ?? ''
  if (isBotUserAgent(ua)) return 'bot'
  if (TABLET_PATTERN.test(ua)) return 'tablet'
  if (MOBILE_PATTERN.test(ua)) return 'mobile'
  if (DESKTOP_PATTERN.test(ua)) return 'desktop'
  return 'other'
}

/** Pathname of the request URL (query and hash removed), or null when unparsable. */
export function requestPathname(rawUrl: string | null | undefined): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl) return null
  const path = rawUrl.split(/[?#]/)[0]
  return path.startsWith('/') ? path : null
}

export function isTrackedRequest(method: string | undefined, pathname: string): boolean {
  const verb = (method ?? '').toUpperCase()
  if (verb === 'OPTIONS' || verb === 'HEAD') return false
  return !SKIPPED_PATH.test(pathname)
}

/**
 * Stored route: pathname without query, ids collapsed to `:id` so top-path stats aggregate
 * per endpoint (UUIDs, long numbers, long hex/base64url tokens), control chars removed, max 200 chars.
 */
export function normalizeRoutePath(pathname: string | null | undefined): string | null {
  const path = requestPathname(pathname)
  if (!path) return null
  const collapsed = path
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split('/')
    .map((segment) => UUID_SEGMENT.test(segment) || /^\d{4,}$/.test(segment) || /^(?=.*\d)[A-Za-z0-9_-]{24,}$/.test(segment) ? ':id' : segment)
    .join('/')
  return collapsed.slice(0, MAX_PATH_LENGTH) || '/'
}

/** Host of the calling site: Origin first (set on CORS/fetch), then Referer. Lower-cased, null if absent/invalid. */
export function sourceHost(origin: HeaderValue, referer: HeaderValue): string | null {
  for (const value of [firstHeader(origin), firstHeader(referer)]) {
    if (!value || value === 'null') continue
    try {
      const url = new URL(value.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      const host = url.hostname.toLowerCase().replace(/\.$/, '')
      if (host && host.length <= MAX_REFERRER_HOST_LENGTH) return host
    } catch { /* try the next header */ }
  }
  return null
}

/** Visitor country: the frontend Worker's x-client-country first, then Cloudflare's CF-IPCountry. */
export function clientCountry(headers: Record<string, HeaderValue>): string | null {
  return countryCode(headers[EDGE_CLIENT_COUNTRY_HEADER]) ?? countryCode(headers['cf-ipcountry'])
}

/** Cloudflare CF-IPCountry: two-letter code; XX (unknown) and T1 (Tor) are kept as-is. */
export function countryCode(value: HeaderValue): string | null {
  const raw = firstHeader(value)?.trim().toUpperCase()
  return raw && /^[A-Z][A-Z0-9]$/.test(raw) ? raw : null
}

export function truncateUserAgent(value: HeaderValue): string | null {
  const raw = firstHeader(value)?.trim()
  return raw ? raw.slice(0, MAX_USER_AGENT_LENGTH) : null
}

export function authenticatedUserId(value: unknown): string | null {
  return typeof value === 'string' && UUID_SEGMENT.test(value) ? value.toLowerCase() : null
}
