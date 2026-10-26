export const IDLE_MS = 24 * 60 * 60 * 1000
/** The installed app with a passkey on this device locks like a banking app: on every cold start and after this long away. */
export const AWAY_MS = 5 * 60 * 1000
/** Set by the sign-in screen after a passkey sign-in on this device. */
export const PASSKEY_ACCOUNT_KEY = 'rwa.lastPasskeyAccount'

export function needsIdleVerification(lastActive: unknown, now = Date.now(), limit = IDLE_MS): boolean {
  return typeof lastActive !== 'number' || !Number.isFinite(lastActive) || lastActive <= 0 || lastActive > now || now - lastActive >= limit
}

/** "490***@qq.com": enough to recognise your own account on a lock screen, not enough to read it off over a shoulder. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!name || !domain) return ''
  return `${name.slice(0, Math.min(3, Math.max(1, name.length - 1)))}***@${domain}`
}
