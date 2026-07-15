import { NextRequest, NextResponse } from 'next/server'

const adminApiBase = (process.env.ADMIN_API_URL ?? 'http://localhost:4100/v1').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload.email !== 'string' || typeof payload.password !== 'string' || (payload.mfaCode !== undefined && typeof payload.mfaCode !== 'string')) {
    return NextResponse.json({ message: 'Invalid login request' }, { status: 400 })
  }
  try {
    const response = await fetch(`${adminApiBase}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: payload.email, password: payload.password, ...(typeof payload.mfaCode === 'string' ? { mfaCode: payload.mfaCode } : {}) }),
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({ message: 'Authentication service unavailable' }))
    if (!response.ok || !body?.sessionToken) {
      const mfaRequired = body?.message === 'Additional administrator verification is required'
      return NextResponse.json({ message: mfaRequired ? 'Additional administrator verification is required' : 'Invalid administrator credentials' }, { status: 401 })
    }
    const result = NextResponse.json({ admin: body.admin, expiresAt: body.expiresAt })
    result.cookies.set('rwa-admin-session', body.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: Math.max(60, Math.floor((new Date(body.expiresAt).getTime() - Date.now()) / 1000)),
      path: '/',
    })
    return result
  } catch {
    return NextResponse.json({ message: 'Authentication service unavailable' }, { status: 503 })
  }
}
