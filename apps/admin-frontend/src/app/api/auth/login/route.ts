import { NextRequest, NextResponse } from 'next/server'

const adminApiBase = (process.env.ADMIN_API_URL ?? 'http://localhost:4100/v1').replace(/\/$/, '')

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload.email !== 'string' || typeof payload.mfaCode !== 'string' || !/^\d{6}$/.test(payload.mfaCode)) {
    return NextResponse.json({ message: 'Invalid login request' }, { status: 400 })
  }
  try {
    const response = await fetch(`${adminApiBase}/admin/auth/totp-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: payload.email, code: payload.mfaCode }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.json().catch(() => ({ message: 'Authentication service unavailable' }))
    if (!response.ok || !body?.sessionToken) {
      if (response.status >= 500 || response.ok) return NextResponse.json({message:'后台认证服务暂时不可用，请稍后重试。'}, {status:503})
      if (response.status === 429) return NextResponse.json({message:'登录尝试过于频繁，请稍后重试。'}, {status:429})
      return NextResponse.json({ message: '邮箱或动态验证码无效，请使用未用过的当前验证码；连续失败会暂时锁定账户。' }, { status: 401 })
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
