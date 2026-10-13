import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, adminApiBase, adminSessionCookieOptions } from '@/lib/server/admin-session'
import { rejectCrossOrigin } from '@/lib/server/csrf'

export async function POST(request: NextRequest) {
  const forbidden = rejectCrossOrigin(request)
  if (forbidden) return forbidden
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (token) {
    await fetch(`${adminApiBase()}/admin/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined)
  }
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', adminSessionCookieOptions(0))
  return response
}
