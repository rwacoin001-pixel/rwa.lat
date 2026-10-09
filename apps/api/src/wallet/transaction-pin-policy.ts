export const PIN_ATTEMPTS = 5
export const PIN_LOCK_MS = 15 * 60 * 1000
export const PIN_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000
export type PinAttempts = { failedAttempts: number; lockedUntil: Date | null }
export type PinGate = { credentialVersion: number; lockedUntil: Date | null; withdrawalBlockedUntil: Date | null }

export function pinAttempt(state: PinAttempts, correct: boolean, now: Date): PinAttempts & { allowed: boolean } {
  if (state.lockedUntil && state.lockedUntil > now) return { ...state, allowed: false }
  if (correct) return { failedAttempts: 0, lockedUntil: null, allowed: true }
  const failedAttempts = (state.lockedUntil ? 0 : state.failedAttempts) + 1
  return { failedAttempts, lockedUntil: failedAttempts >= PIN_ATTEMPTS ? new Date(now.getTime() + PIN_LOCK_MS) : null, allowed: false }
}
export function pinWithdrawalGate(state: PinGate | null, version: number, now: Date): string | null {
  if (!state || !Number.isSafeInteger(version) || version < 1) return 'TRANSACTION_PIN_REQUIRED'
  if (state.credentialVersion !== version) return 'TRANSACTION_PIN_CONFLICT'
  if (state.lockedUntil && state.lockedUntil > now) return 'TRANSACTION_PIN_LOCKED'
  if (state.withdrawalBlockedUntil && state.withdrawalBlockedUntil > now) return 'TRANSACTION_PIN_COOLDOWN'
  return null
}
