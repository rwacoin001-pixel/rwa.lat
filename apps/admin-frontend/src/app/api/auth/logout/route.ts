import { NextRequest, NextResponse } from 'next/server'

const adminApiBase = (process.env.ADMIN_API_URL ?? 'http://localhost:4100/v1').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  const token = request.cookies.get('rwa-admin-session')?.value
  if (token) {
    await fetch(`${adminApiBase}/admin/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    }).catch(() => undefined)
  }
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  response.cookies.set('rwa-admin-session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
  return response
}
