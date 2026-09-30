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
      if (response.status >= 500 || response.ok) return NextResponse.json({message:'后台认证服务暂时不可用，请稍后重试。'}, {status:503})
      if (response.status === 429) return NextResponse.json({message:'登录尝试过于频繁，请稍后重试。'}, {status:429})
      const mfaRequired = body?.message === 'Additional administrator verification is required'
      return NextResponse.json({ message: mfaRequired ? '密码已通过，请填写当前动态验证码；如未完成 MFA 设置，请联系管理员。' : '管理员邮箱或密码未通过校验；临时锁定也会显示此提示。请勿连续重复尝试。' }, { status: 401 })
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
