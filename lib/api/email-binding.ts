import { request, readSession, type ApiError, type ApiResult } from './_http'
import { normalizeEmailCode } from '../auth-email-copy'

export type BindStart = { verified: true } | { verified: false; continuationToken: string; expiresIn: number }
export type BindSent = { continuationToken: string; emailMasked: string; expiresIn: number; retryAfter: number }
export type BindErrorKind = 'invalidCode' | 'expired' | 'rateLimited' | 'taken' | 'invalidEmail' | 'mismatch' | 'unavailable'

const DEFAULT_RETRY_SECONDS = 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const fail = (code: string, message: string): { ok: false; error: ApiError } => ({ ok: false, error: { status: 0, code, message } })
const badResponse = () => fail('BIND_BAD_RESPONSE', 'Unexpected response')
const mismatch = () => fail('BIND_USER_MISMATCH', 'Verified account differs from the signed-in account')
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}
const seconds = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
const post = (path: string, body: Record<string, unknown>, userId: string): Promise<ApiResult<unknown>> => {
  const session = readSession()
  if (!session || (session.userId && session.userId !== userId)) return Promise.resolve(mismatch())
  return request<unknown>(path, { method: 'POST', token: session.sessionToken, body: JSON.stringify({ ...body, userId }), loading: 'silent' })
}

export function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value)
}

export async function startEmailBind(userId: string): Promise<ApiResult<BindStart>> {
  const result = await post('/v1/auth/email/bind/start', {}, userId)
  if (!result.ok) return result
  const data = record(result.data)
  if (typeof data.userId !== 'string') return badResponse()
  if (data.userId !== userId) return mismatch()
  if (data.emailVerified === true) return data.userId === userId ? { ok: true, data: { verified: true } } : mismatch()
  const expiresIn = seconds(data.expiresIn)
  if (typeof data.continuationToken !== 'string' || !data.continuationToken || expiresIn === null) return badResponse()
  return { ok: true, data: { verified: false, continuationToken: data.continuationToken, expiresIn } }
}

export async function sendEmailBindCode(continuationToken: string, email: string, userId: string): Promise<ApiResult<BindSent>> {
  const result = await post('/v1/auth/email/bind/send', { continuationToken, email: email.trim() }, userId)
  if (!result.ok) return result
  const data = record(result.data)
  const expiresIn = seconds(data.expiresIn)
  if (typeof data.continuationToken !== 'string' || !data.continuationToken || typeof data.email !== 'string' || !data.email || expiresIn === null) return badResponse()
  return { ok: true, data: { continuationToken: data.continuationToken, emailMasked: data.email, expiresIn, retryAfter: seconds(data.retryAfter) ?? DEFAULT_RETRY_SECONDS } }
}

export async function resendEmailBindCode(continuationToken: string, userId: string): Promise<ApiResult<{ retryAfter: number }>> {
  const result = await post('/v1/auth/email/bind/resend', { continuationToken }, userId)
  if (!result.ok) return result
  return { ok: true, data: { retryAfter: seconds(record(result.data).retryAfter) ?? DEFAULT_RETRY_SECONDS } }
}

/** Resolves only when the server confirms the same user; the returned body is never treated as a login. */
export async function completeEmailBind(continuationToken: string, code: string, userId: string): Promise<ApiResult<{ userId: string }>> {
  const normalized = normalizeEmailCode(code)
  if (normalized.length !== 6) return fail('AUTH_CODE_INVALID', 'Enter a 6-digit code')
  const result = await post('/v1/auth/email/bind/complete', { continuationToken, code: normalized }, userId)
  if (!result.ok) return result
  const data = record(result.data)
  if (data.emailVerified !== true || typeof data.userId !== 'string') return badResponse()
  return data.userId === userId ? { ok: true, data: { userId } } : mismatch()
}

export function classifyBindError(error: Pick<ApiError, 'status' | 'code'>): BindErrorKind {
  const code = error.code.toUpperCase()
  if (code === 'BIND_USER_MISMATCH' || code === 'AUTH_ACCOUNT_CHANGED') return 'mismatch'
  if (code === 'AUTH_CODE_INVALID') return 'invalidCode'
  if (error.status === 410 || /EXPIRED|CONTINUATION|FLOW_(?:INVALID|NOT_FOUND|REQUIRED)/.test(code)) return 'expired'
  if (error.status === 429 || /RATE|THROTTL|TOO_MANY|COOLDOWN/.test(code)) return 'rateLimited'
  if (error.status === 409 || /TAKEN|IN_USE|ALREADY|EXISTS|CONFLICT/.test(code)) return 'taken'
  if (/INVALID_EMAIL|EMAIL_INVALID/.test(code)) return 'invalidEmail'
  return 'unavailable'
}

// Persisted per user in sessionStorage: never the full email and never the code.
export type StoredBinding = { continuationToken: string; sent: boolean; emailMasked: string | null; expiresAt: number; resendAt: number }

const STORAGE_PREFIX = 'rwa.home-email-binding.v1:'
export const bindingKey = (userId: string) => STORAGE_PREFIX + encodeURIComponent(userId)

export function bindingAfterStart(start: { continuationToken: string; expiresIn: number }, now: number): StoredBinding {
  return { continuationToken: start.continuationToken, sent: false, emailMasked: null, expiresAt: now + start.expiresIn * 1000, resendAt: 0 }
}

export function bindingAfterSend(sent: BindSent, now: number): StoredBinding {
  return { continuationToken: sent.continuationToken, sent: true, emailMasked: sent.emailMasked, expiresAt: now + sent.expiresIn * 1000, resendAt: now + sent.retryAfter * 1000 }
}

export function resendWait(binding: Pick<StoredBinding, 'resendAt'> | null, now: number): number {
  return binding ? Math.max(0, Math.ceil((binding.resendAt - now) / 1000)) : 0
}

export function clearBinding(userId: string) {
  try { sessionStorage.removeItem(bindingKey(userId)) } catch { /* Storage can be disabled. */ }
}

export function saveBinding(userId: string, binding: StoredBinding) {
  const { continuationToken, sent, emailMasked, expiresAt, resendAt } = binding
  try { sessionStorage.setItem(bindingKey(userId), JSON.stringify({ continuationToken, sent, emailMasked, expiresAt, resendAt })) } catch { /* The flow just won't survive a reload. */ }
}

export function loadBinding(userId: string, now = Date.now()): StoredBinding | null {
  try {
    const raw = sessionStorage.getItem(bindingKey(userId))
    if (raw === null) return null
    const value = record(JSON.parse(raw))
    const valid = typeof value.continuationToken === 'string' && value.continuationToken !== '' && typeof value.sent === 'boolean'
      && (value.emailMasked === null || typeof value.emailMasked === 'string')
      && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt) && value.expiresAt > now
      && typeof value.resendAt === 'number' && Number.isFinite(value.resendAt)
    if (!valid) { clearBinding(userId); return null }
    return { continuationToken: value.continuationToken as string, sent: value.sent as boolean, emailMasked: value.emailMasked as string | null, expiresAt: value.expiresAt as number, resendAt: value.resendAt as number }
  } catch { clearBinding(userId); return null }
}

export function clearOtherBindings(userId: string) {
  try {
    const keep = bindingKey(userId)
    const stale: string[] = []
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index)
      if (key && key.startsWith(STORAGE_PREFIX) && key !== keep) stale.push(key)
    }
    for (const key of stale) sessionStorage.removeItem(key)
  } catch { /* Storage can be disabled. */ }
}
