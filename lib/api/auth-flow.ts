import { request, type ApiError } from './_http'

export type AuthFlow = { continuationToken: string; step: 'email' | 'totp' | 'password' | 'consent'; expiresIn: number; retryAfter?: number }
const KEY = 'rwa.auth-flow'
export function readAuthFlow(): AuthFlow | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (!value || value.expiresAt <= Date.now() || !/^[a-f0-9]{64}$/.test(value.continuationToken) || !['email', 'totp', 'password', 'consent'].includes(value.step)) return null
    return value
  } catch { return null }
}
export function clearAuthFlow() { try { sessionStorage.removeItem(KEY) } catch { /* Optional browser storage. */ } }
export function continueAuth(error: ApiError): boolean {
  if (error.code !== 'AUTH_FLOW_REQUIRED') return false
  const flow = error.details?.authFlow as AuthFlow | undefined
  if (!flow || !/^[a-f0-9]{64}$/.test(flow.continuationToken) || !['email', 'totp', 'password', 'consent'].includes(flow.step)) return false
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...flow, expiresAt: Date.now() + flow.expiresIn * 1000 })) }
  catch { return false }
  window.location.assign('/auth/continue')
  return true
}

/** Stable per-browser identifier, used only for device grouping, never as authentication proof. */
export function authDevice() {
  let fingerprint: string
  try {
    fingerprint = localStorage.getItem('rwa.device-id') ?? ''
    if (!/^[a-f0-9-]{36}$/.test(fingerprint)) {
      fingerprint = crypto.randomUUID()
      localStorage.setItem('rwa.device-id', fingerprint)
    }
  } catch { fingerprint = crypto.randomUUID() }
  const ua = navigator.userAgent
  return { fingerprint, name: /iPhone|iPad/.test(ua) ? 'iOS browser' : /Android/.test(ua) ? 'Android browser' : 'Web browser' }
}
export const managePassword = (email?: string, reauthentication?: string) => request('/v1/auth/password/manage', { method: 'POST', body: JSON.stringify({ device: authDevice(), ...(email ? { email } : {}), ...(reauthentication ? { reauthentication } : {}) }) })
export const changeAccountEmail = (email: string, reauthentication: string) => request('/v1/auth/email/change', { method: 'POST', body: JSON.stringify({ email, reauthentication }) })
export const completeAuthFlow = (flow: AuthFlow, input: { code?: string; password?: string; consents?: unknown[] }) =>
  request<{ token?: string; userId?: string; sessionId?: string; requiresLogin?: boolean }>('/v1/auth/flow/complete', { method: 'POST', body: JSON.stringify({ continuationToken: flow.continuationToken, ...input }) })
export const resendAuthFlow = (flow: AuthFlow) => request<{ retryAfter: number }>('/v1/auth/flow/resend', { method: 'POST', body: JSON.stringify({ continuationToken: flow.continuationToken }) })
