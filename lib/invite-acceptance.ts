import { acceptInvitation } from '@/lib/api/account'

const KEYS = ['rwa-last-attribution', 'rwa-first-attribution'] as const

const read = (key: string): Record<string, string> | null => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? 'null')
    return value && typeof value === 'object' ? value as Record<string, string> : null
  } catch { return null }
}

/** Removes only the invite token; utm attribution stays as captured. */
const forget = () => KEYS.forEach((key) => {
  const value = read(key)
  if (!value || !('invite_code' in value)) return
  delete value.invite_code
  window.localStorage.setItem(key, JSON.stringify(value))
})

let inFlight: Promise<void> | null = null

/**
 * Redeems an invite link captured on arrival (`?invite_code=`) once a signed-in session exists.
 * The server accepts and writes both rewards atomically and a retry by the same user replays the result,
 * so the token is kept after network or 5xx failures and dropped after any definitive answer (400/404/409).
 */
export function acceptPendingInvite(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (inFlight) return inFlight
  const token = KEYS.map((key) => read(key)?.invite_code).find((value): value is string => typeof value === 'string' && value.length > 0)
  if (!token) return Promise.resolve()
  inFlight = acceptInvitation(token).then((result) => {
    if (result.ok || (result.error.status >= 400 && result.error.status < 500 && result.error.status !== 401 && result.error.status !== 408 && result.error.status !== 429)) forget()
  }).finally(() => { inFlight = null })
  return inFlight
}
