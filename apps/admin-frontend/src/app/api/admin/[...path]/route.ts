import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, adminApiBase } from '@/lib/server/admin-session'
import { rejectCrossOrigin } from '@/lib/server/csrf'

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const forbidden = rejectCrossOrigin(request)
  if (forbidden) return forbidden
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ message: 'Admin session is required' }, { status: 401 })
  const { path } = await context.params
  if (path.some(segment => segment === '.' || segment === '..' || /[\\/]/.test(segment))) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 })
  }
  const target = new URL(`${adminApiBase()}/admin/${path.join('/')}`)
  target.search = request.nextUrl.search
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  const idempotencyKey=request.headers.get('idempotency-key')
  if(idempotencyKey && !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) {
    return NextResponse.json({message:'Invalid Idempotency-Key'},{status:400})
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(hasBody && idempotencyKey ? {'idempotency-key':idempotencyKey}:{}),
        ...(hasBody && request.headers.get('content-type') ? { 'content-type': request.headers.get('content-type')! } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(35_000),
    })
    const headers = new Headers()
    if (path[0] === 'users') headers.set('cache-control', 'private, no-store')
    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    return new NextResponse(await upstream.text(), { status: upstream.status, headers })
  } catch (error) {
    const timeout = error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)
    return NextResponse.json({ code: timeout ? 'ADMIN_API_TIMEOUT' : 'ADMIN_API_UNAVAILABLE', message: timeout ? '请求超时，请重试。' : '后台服务暂不可用，请稍后重试。' }, { status: timeout ? 504 : 503, headers: { 'cache-control': 'private, no-store' } })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
