import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE } from '@/lib/server/admin-session'

// Page redirects complement the administrator session and MFA checks in the API.
export function proxy(request: NextRequest) {
  // Health checks do not require an administrator session.
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.json({ ok: true })
  }
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/') || pathname === '/login' || pathname === '/recover' || pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }
  if (!request.cookies.get(ADMIN_SESSION_COOKIE)?.value) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] }
