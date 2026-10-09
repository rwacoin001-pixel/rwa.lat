import { request, type ApiError } from './_http'

/** `GET /v1/security/transaction-password`; times are ISO or null and are compared only against `serverTime`. */
export type TransactionPinStatus = {
  available: boolean; configured: boolean; remainingAttempts: number
  lockedUntil: string | null; withdrawalBlockedUntil: string | null; serverTime: string
}
export type TransactionPinGate = 'unavailable' | 'unset' | 'locked' | 'cooldown' | 'ready'

export const PIN_LENGTH = 6
/** Exactly six ASCII digits; leading zeros are significant, so it always stays a string. */
export const isPin = (value: string) => /^[0-9]{6}$/.test(value)

const PATH = '/v1/security/transaction-password'
// request() already fetches with cache: 'no-store'; nothing here is persisted client-side.
export const getTransactionPinStatus = () => request<TransactionPinStatus>(PATH)
export const setupTransactionPin = (body: { pin: string; confirmation: string; reauthentication: string }) =>
  request<TransactionPinStatus>(`${PATH}/setup`, { method: 'POST', body: JSON.stringify(body) })
export const changeTransactionPin = (body: { currentPin: string; pin: string; confirmation: string; reauthentication: string }) =>
  request<TransactionPinStatus>(`${PATH}/change`, { method: 'POST', body: JSON.stringify(body) })
export const resetTransactionPin = (body: { pin: string; confirmation: string; reauthentication: string }) =>
  request<TransactionPinStatus>(`${PATH}/reset`, { method: 'POST', body: JSON.stringify(body) })

const after = (until: string | null, now: string) => {
  if (!until) return false
  const a = Date.parse(until), b = Date.parse(now)
  return Number.isFinite(a) && Number.isFinite(b) && a > b
}

/** Lock and cooldown are read against the server clock only; the device clock never unlocks anything. */
export function pinGate(status: TransactionPinStatus): TransactionPinGate {
  if (!status.available) return 'unavailable'
  if (!status.configured) return 'unset'
  if (after(status.lockedUntil, status.serverTime)) return 'locked'
  if (after(status.withdrawalBlockedUntil, status.serverTime)) return 'cooldown'
  return 'ready'
}

/** Milliseconds until the active lock/cooldown ends, by server time; used only to schedule a status refetch. */
export function pinWaitMs(status: TransactionPinStatus): number | null {
  const gate = pinGate(status)
  const until = gate === 'locked' ? status.lockedUntil : gate === 'cooldown' ? status.withdrawalBlockedUntil : null
  if (!until) return null
  return Math.max(0, Date.parse(until) - Date.parse(status.serverTime))
}

/** Safe subset of `error.details` for TRANSACTION_PIN_* errors; anything malformed is dropped. */
export function pinErrorDetails(error: ApiError): { remainingAttempts?: number; lockedUntil?: string; withdrawalBlockedUntil?: string } {
  const d = error.details ?? {}
  const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined
  const n = d.remainingAttempts
  return {
    remainingAttempts: typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : undefined,
    lockedUntil: iso(d.lockedUntil), withdrawalBlockedUntil: iso(d.withdrawalBlockedUntil),
  }
}

export const isPinError = (code: string) => code.startsWith('TRANSACTION_PIN_')
