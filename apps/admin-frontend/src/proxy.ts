import { NextRequest, NextResponse } from 'next/server'

/**
 * Two layers of protection for the admin console:
 *   1. HTTP Basic auth (fail closed when ADMIN_BASIC_AUTH is unset) so the console is never
 *      publicly reachable even if the session gate below is bypassed.
 *   2. The existing cookie-session gate that redirects anonymous visitors to /login.
 */
function basicAuthOk(request: NextRequest): boolean {
  const expected = process.env.ADMIN_BASIC_AUTH
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  try {
    const decoded = atob(encoded)
    if (decoded.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < decoded.length; i += 1) diff |= decoded.charCodeAt(i) ^ expected.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  // Render's health check must receive an unauthenticated 200 (all else sits behind Basic auth).
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.json({ ok: true })
  }
  if (!process.env.ADMIN_BASIC_AUTH) {
    return new NextResponse('Admin console is not configured.', {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    })
  }
  if (!basicAuthOk(request)) {
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="RWA admin", charset="UTF-8"', 'cache-control': 'no-store' },
    })
  }

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/') || pathname === '/login' || pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }
  if (!request.cookies.get('rwa-admin-session')?.value) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
