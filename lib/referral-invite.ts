import { request, resetAuthAttribution } from './api/_http'

/** Same rules as the API: any case, spaces or dashes allowed; 6–16 letters or digits once cleaned. */
export function normalizeInviteCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase().slice(0, 16)
}
export const isInviteCodeShape = (code: string) => /^[A-Z0-9]{6,16}$/.test(code)
/** Short codes are 6 characters; grouping them 3+3 makes them easy to read back. */
export const displayInviteCode = (code: string) => /^[A-Za-z0-9]{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}`.toUpperCase() : code.toUpperCase()

export type InviteAttribution = { code: string; expiresAt: string }

/**
 * Share = invite (2026-10-28): a shared page goes out as /r/<code>?next=<path>, so whoever opens it is attributed to the
 * sharer and still lands on what was shared. Without a code the plain page link is used.
 */
export function inviteLinkFor(path: string, code?: string | null): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return code ? `${origin}/r/${encodeURIComponent(code.toUpperCase())}?next=${encodeURIComponent(path)}` : origin + path
}

export const lookupInviteCode = (code: string) =>
  request<{ valid: boolean; code?: string }>(`/v1/referral/public/codes/${encodeURIComponent(code)}`, { loading: 'silent', timeoutMs: 8_000 })

/** The invitation this browser already carries (from a /r/ link or an earlier entry), if still within its window. */
export async function currentInvite(): Promise<InviteAttribution | null> {
  try {
    const response = await fetch('/api/referral/invite', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const body = await response.json() as { attribution?: InviteAttribution | null }
    return body.attribution ?? null
  } catch { return null }
}

/**
 * Records a typed code as this browser's invitation before any registration request is sent.
 * First attribution wins: when one already exists the server keeps it and that one comes back.
 */
export async function applyInviteCode(code: string): Promise<InviteAttribution | null> {
  try {
    const response = await fetch('/api/referral/invite', {
      method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    })
    if (!response.ok) return null
    const body = await response.json() as { attribution?: InviteAttribution | null }
    resetAuthAttribution()
    return body.attribution ?? null
  } catch { return null }
}
