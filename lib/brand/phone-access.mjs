export const PHONE_GUIDE_PATH = '/open-on-phone'

const DESKTOP_PATHS = /^\/(?:login|register|verify-email|recovery|auth|terms|privacy|invite|r|app-login|app-handoff|__native|open-on-phone)(?:\/|$)/
const INFRASTRUCTURE = /^\/(?:_next|api|v1|\.well-known|media)(?:\/|$)/

/** @param {string} userAgent @param {boolean} mobileHint */
export function isKimengPhone(userAgent, mobileHint = false) {
  if (/iPad|Tablet/i.test(userAgent)) return false
  return /iPhone|iPod|RwaLatAndroidTrial\//i.test(userAgent) ||
    (/Android/i.test(userAgent) && (mobileHint || /\bMobile\b/i.test(userAgent)))
}

/** @param {string} pathname */
export function kimengDesktopDestination(pathname) {
  if (pathname === '/' || pathname === '/welcome' || pathname === '/welcome/') return '/login'
  return DESKTOP_PATHS.test(pathname) || INFRASTRUCTURE.test(pathname) ? null : PHONE_GUIDE_PATH
}

/** Apply after looking up static assets. @param {Request} request */
export function kimengPhoneRedirect(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const url = new URL(request.url)
  const destination = kimengDesktopDestination(url.pathname)
  if (!destination || isKimengPhone(request.headers.get('user-agent') ?? '', request.headers.get('sec-ch-ua-mobile') === '?1')) return null
  return new Response(null, {
    status: 307,
    headers: {
      location: new URL(destination, url).href,
      'cache-control': 'private, no-store',
      vary: 'User-Agent, Sec-CH-UA-Mobile',
    },
  })
}
