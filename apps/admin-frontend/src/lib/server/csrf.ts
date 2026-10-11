import { NextRequest, NextResponse } from 'next/server'

function originOf(value: string | null): string | null {
  if (!value || value === 'null') return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function allowedOrigins(request: NextRequest): Set<string> {
  const allowed = new Set<string>([request.nextUrl.origin])
  const host = request.headers.get('host')
  if (host) {
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':', '')
    allowed.add(`${protocol}://${host}`)
  }
  const configured = [process.env.PUBLIC_ADMIN_FRONTEND_ORIGIN, ...(process.env.ADMIN_ALLOWED_ORIGINS ?? '').split(',')]
  for (const entry of configured) {
    const origin = originOf(entry?.trim() ?? null)
    if (origin) allowed.add(origin)
  }
  return allowed
}

/** Returns a 403 response unless a state-changing request comes from the admin console's own origin. */
export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return null
  const origin = request.headers.get('origin')
  const source = origin !== null ? originOf(origin) : originOf(request.headers.get('referer'))
  if (source && allowedOrigins(request).has(source)) return null
  return NextResponse.json({ message: '请求来源不允许，请从管理后台提交操作。' }, { status: 403, headers: { 'cache-control': 'private, no-store' } })
}
