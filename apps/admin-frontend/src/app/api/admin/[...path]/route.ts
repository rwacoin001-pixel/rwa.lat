import { NextRequest, NextResponse } from 'next/server'

const adminApiBase = (process.env.ADMIN_API_URL ?? 'http://localhost:4100/v1').replace(/\/$/, '')

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = request.cookies.get('rwa-admin-session')?.value
  if (!token) return NextResponse.json({ message: 'Admin session is required' }, { status: 401 })
  const { path } = await context.params
  const target = new URL(`${adminApiBase}/admin/${path.join('/')}`)
  target.search = request.nextUrl.search
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  if (hasBody && path[0] === 'users') {
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? request.nextUrl.protocol.replace(':', '')
    const publicOrigin = `${protocol}://${request.headers.get('host') ?? request.nextUrl.host}`
    const allowedOrigin = (process.env.PUBLIC_ADMIN_FRONTEND_ORIGIN ?? publicOrigin).replace(/\/$/, '')
    if (request.headers.get('origin') !== allowedOrigin) {
      return NextResponse.json({ message: '请从管理后台提交操作。' }, { status: 403 })
    }
  }
  const upstream = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody && request.headers.get('content-type') ? { 'content-type': request.headers.get('content-type')! } : {}),
    },
    body: hasBody ? await request.text() : undefined,
    cache: 'no-store',
  })
  const headers = new Headers()
  if (path[0] === 'users') headers.set('cache-control', 'private, no-store')
  const contentType = upstream.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  return new NextResponse(await upstream.text(), { status: upstream.status, headers })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
