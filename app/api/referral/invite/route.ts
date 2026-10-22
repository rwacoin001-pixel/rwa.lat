import { NextRequest, NextResponse } from 'next/server'

const NO_STORE = { 'Cache-Control': 'no-store' }
const api = () => (process.env.API_INTERNAL_URL || 'https://api.a-reit.com').replace(/\/$/, '')
const withCookie = (token?: string): HeadersInit => token ? { cookie: `rwa_referral=${encodeURIComponent(token)}` } : {}

/** Which invitation code the signed cookie carries. The token itself never reaches page scripts. */
async function describe(token?: string) {
  if (!token) return null
  try {
    const upstream = await fetch(`${api()}/v1/referral/public/attribution`, { headers: withCookie(token), cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!upstream.ok) return null
    return ((await upstream.json()) as { attribution?: { code: string; expiresAt: string } | null }).attribution ?? null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ attribution: await describe(req.cookies.get('rwa_referral')?.value) }, { headers: NO_STORE })
}

/** Same landing as /r/<code>, for a code typed at signup. An earlier valid attribution is kept (first click wins). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.replace(/[\s-]/g, '') : ''
  if (!/^[a-zA-Z0-9]{6,16}$/.test(code)) return NextResponse.json({ message: 'Invalid invitation code' }, { status: 400, headers: NO_STORE })
  const old = req.cookies.get('rwa_referral')?.value
  try {
    const upstream = await fetch(`${api()}/r/${encodeURIComponent(code)}`, { headers: withCookie(old), cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!upstream.ok) return NextResponse.json({ message: 'Invitation code is unavailable' }, { status: upstream.status, headers: NO_STORE })
    const data = await upstream.json() as { attributionToken: string; expiresAt: string }
    const response = NextResponse.json({ attribution: await describe(data.attributionToken) }, { headers: NO_STORE })
    response.cookies.set('rwa_referral', data.attributionToken, { httpOnly: true, secure: req.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', expires: new Date(data.expiresAt) })
    return response
  } catch { return NextResponse.json({ message: 'Invitation service is temporarily unavailable' }, { status: 503, headers: NO_STORE }) }
}
