import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
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
