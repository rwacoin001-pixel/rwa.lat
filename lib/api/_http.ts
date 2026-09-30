import { beginUiLoading } from '../ui-loading'
export type ApiError = { status: number; code: string; message: string; details?: Record<string, unknown>; retryAfter?: number; requestId?: string }
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
export const SESSION_KEY = 'rwa.session'
export const SESSION_EXPIRED = 'rwa:session-expired'
export const SESSION_CHANGED = 'rwa:session-changed'
// Refresh tiers: order book 8s · quotes/overview 30s · lists/catalogs 60s.
export const POLL = { unread: 60_000, pendingOrder: 10_000, kyc: 5_000, market: 30_000, book: 8_000, quote: 30_000, list: 60_000 } as const
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}

export function parseApiError(status: number, body: unknown, headers: Headers): ApiError {
  const outer = record(body)
  const inner = record(outer.error ?? outer)
  const retry = headers.get('Retry-After')
  const seconds = retry === null ? undefined : /^\d+$/.test(retry) ? Number(retry) : Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000))
  return { status, code: typeof inner.code === 'string' ? inner.code : `HTTP_${status}`,
    message: typeof inner.message === 'string' ? inner.message : Array.isArray(inner.message) ? inner.message.join('; ') : '请求失败，请重试',
    details: inner.details && typeof inner.details === 'object' && !Array.isArray(inner.details) ? inner.details as Record<string, unknown> : undefined,
    retryAfter: seconds !== undefined && Number.isFinite(seconds) ? seconds : undefined,
    requestId: typeof outer.requestId === 'string' ? outer.requestId : headers.get('x-request-id') ?? undefined }
}

export function apiUrl(path: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '')
  return baseUrl ? `${baseUrl}${path}` : path
}

/** 401s that reject a re-authentication factor, not the session itself; they must not sign the user out. */
const STEP_UP_CODES = new Set(['STEP_UP_REQUIRED', 'TOTP_INVALID', 'TOTP_NOT_CONFIGURED', 'PASSKEY_CHALLENGE_INVALID', 'PASSKEY_VERIFICATION_FAILED', 'PASSKEY_NOT_FOUND'])

export function shouldExpireSessionOn401(path: string | undefined, hasSessionToken: boolean, code?: string): boolean {
  if (!hasSessionToken || !path) return false
  if (code && STEP_UP_CODES.has(code)) return false
  let pathname = path.split('?')[0]
  try { pathname = new URL(path, 'http://rwa.local').pathname } catch { /* Keep the relative path. */ }
  if (!pathname.startsWith('/v1/auth/')) return true
  return pathname === '/v1/auth/session' || pathname === '/v1/auth/logout'
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) { const session = JSON.parse(raw); if (typeof session.sessionToken === 'string') return session.sessionToken }
    // Compatibility with existing screens until the S2 authentication migration.
    return localStorage.getItem('rwa-session-token') ?? localStorage.getItem('auth_token')
  } catch { return null }
}

export type StoredSession = { sessionToken: string; sessionId?: string; userId?: string; loggedInAt: string }

export function readSession(): StoredSession | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<StoredSession> | null
    return value && typeof value.sessionToken === 'string'
      ? { sessionToken: value.sessionToken, sessionId: value.sessionId, userId: value.userId, loggedInAt: value.loggedInAt ?? new Date(0).toISOString() }
      : null
  } catch { return null }
}

export function saveSession(sessionToken: string, details: Pick<StoredSession, 'sessionId' | 'userId'> = {}) {
  const session: StoredSession = { sessionToken, ...details, loggedInAt: new Date().toISOString() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // Session IDs now live inside the canonical session object.
  localStorage.removeItem('rwa-session-id')
  // Compatibility until all pre-S2 consumers use the shared HTTP client.
  localStorage.setItem('rwa-session-token', sessionToken)
  localStorage.setItem('auth_token', sessionToken)
  localStorage.setItem('rwa-session-mode', 'authenticated')
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  try { for (const key of [SESSION_KEY, 'rwa-session-token', 'rwa-session-id', 'auth_token', 'rwa-session-mode']) localStorage.removeItem(key) } catch { /* Storage can be disabled. */ }
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

export function handleSessionUnauthorized() {
  if (typeof window === 'undefined') return
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED))
  const target = window.location.pathname + window.location.search
  if (window.location.pathname !== '/login') window.location.assign(`/login?returnTo=${encodeURIComponent(target)}`)
}

export async function request<T>(path: string, options: RequestInit & { idempotencyKey?: string; token?: string | null; timeoutMs?: number; loading?: 'overlay' | 'silent' } = {}): Promise<ApiResult<T>> {
  if (!path.startsWith('/v1/') || /\/v1\/(?:demo-admin|admin|[^/?]*-internal)(?:[/?]|$)/.test(path) || path.includes('..') || path.includes('\\')) {
    return { ok: false, error: { status: 0, code: 'INVALID_API_PATH', message: '仅允许 C 端 /v1 接口' } }
  }
  const { idempotencyKey, token = getSessionToken(), timeoutMs = 20_000, loading, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('x-request-id', crypto.randomUUID())
  if (token) headers.set('Authorization', `Bearer ${token}`)
  // Carry the signed landing attribution across the app/API domains for registration and OAuth.
  if (/^\/v1\/auth\/(?:register\/email|wallet\/verify|oauth\/(?:google|x)(?:\/start)?)$/.test(path) && typeof window !== 'undefined') {
    try {
      const attribution = await fetch('/api/referral/attribution', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(3000) }).then(r => r.ok ? r.json() : null)
      if (typeof attribution?.token === 'string') headers.set('x-referral-attribution', attribution.token)
    } catch { /* Registration remains available without an invitation. */ }
  }
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  const abort = () => controller.abort()
  if (init.signal?.aborted) controller.abort()
  else init.signal?.addEventListener('abort', abort, { once: true })
  const show = loading === 'overlay' || (loading !== 'silent' && (init.method ?? 'GET') !== 'GET' && path !== '/v1/auth/passkey/challenge')
  const finish = show ? beginUiLoading() : () => {}
  try {
    const response = await fetch(apiUrl(path), { ...init, headers, signal: controller.signal, cache: 'no-store' })
    const text = await response.text()
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch {
      return { ok: false, error: { status: response.status, code: 'INVALID_JSON', message: '服务返回了无法解析的数据' } }
    }
    if (response.ok) return { ok: true, data: body as T }
    const error = parseApiError(response.status, body, response.headers)
    if (response.status === 401 && shouldExpireSessionOn401(path, Boolean(token), error.code)) handleSessionUnauthorized()
    if (isKycEligibilityError(error) && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rwa:kyc-required', { detail: error }))
    return { ok: false, error }
  } catch (error) {
    return { ok: false, error: { status: 0, code: timedOut ? 'REQUEST_TIMEOUT' : error instanceof Error && error.name === 'AbortError' ? 'ABORTED' : 'NETWORK_ERROR', message: timedOut ? '请求超时，请重试' : '网络不可用，请重试' } }
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', abort)
    finish()
  }
}

export function isKycEligibilityError(error: ApiError): boolean {
  const decision = error.details?.decision
  const reasonCodes = error.details?.reasonCodes
  return error.status === 403
    && (error.code === 'ORDER_NOT_ELIGIBLE' || error.code === 'INVESTMENT_NOT_ELIGIBLE')
    && decision === 'browse_only'
    && Array.isArray(reasonCodes)
    && reasonCodes.includes('kyc_not_approved')
}

export const newIdemKey = () => crypto.randomUUID()
