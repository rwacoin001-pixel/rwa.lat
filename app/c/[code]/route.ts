import { NextRequest, NextResponse } from 'next/server'

/** A circle's invite link (2026-11-01): /c/<code> opens Community with the circle's join sheet. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const target = /^[A-Za-z0-9_-]{6,32}$/.test(code) ? `/community?join=${encodeURIComponent(code)}` : '/community'
  const response = NextResponse.redirect(new URL(target, req.url), 303)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
