// Shared by route handlers and src/proxy.ts; keep free of Node-only imports.
const production = process.env.NODE_ENV === 'production'

// `__Host-` requires Secure, which local http://localhost cannot satisfy.
export const ADMIN_SESSION_COOKIE = production ? '__Host-rwa-admin-session' : 'rwa-admin-session'

export function adminSessionCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: production, sameSite: 'strict' as const, path: '/', maxAge }
}

export function adminApiBase(): string {
  const configured = process.env.ADMIN_API_URL?.trim()
  if (!configured) {
    if (production) throw new Error('ADMIN_API_URL must be set in production; refusing to fall back to localhost')
    return 'http://localhost:4100/v1'
  }
  return configured.replace(/\/$/, '')
}
