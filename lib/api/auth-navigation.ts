type StorageReader = Pick<Storage, 'getItem' | 'removeItem'>

/** Set when this tab starts creating an account; the first landing after sign-in is then the welcome step. */
export const NEW_ACCOUNT_KEY = 'rwa.auth-new-account'
export const WELCOME_PATH = '/auth/welcome'

export function markNewAccount(storage: Pick<Storage, 'setItem' | 'removeItem'>, isNew: boolean) {
  try { if (isNew) storage.setItem(NEW_ACCOUNT_KEY, '1'); else storage.removeItem(NEW_ACCOUNT_KEY) }
  catch { /* The welcome step is optional; sign-in never depends on it. */ }
}

/** After a sign-in without a passkey, one optional screen offers to add one for next time. */
export const PASSKEY_OFFER_PATH = '/auth/passkey'
// Tab-scoped: the offer was shown (or is not needed) for this sign-in. Cleared once the real destination is reached.
export const PASSKEY_OFFER_SEEN_KEY = 'rwa.passkey-offer-seen'
// Device-scoped: no offer before this timestamp (ms), after "later", a new passkey, or an unsupported device.
export const PASSKEY_OFFER_SNOOZE_KEY = 'rwa.passkey-offer-snooze'
const DAY_MS = 24 * 60 * 60 * 1000

export function markPasskeyOfferSeen(storage: Pick<Storage, 'setItem'>) {
  try { storage.setItem(PASSKEY_OFFER_SEEN_KEY, '1') } catch { /* The offer is optional. */ }
}

export function snoozePasskeyOffer(storage: Pick<Storage, 'setItem'>, days: number, now = Date.now()) {
  try { storage.setItem(PASSKEY_OFFER_SNOOZE_KEY, String(now + days * DAY_MS)) } catch { /* The offer is optional. */ }
}

function passkeyOfferDue(storage: StorageReader, now: number): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext || typeof window.PublicKeyCredential !== 'function') return false
  if (storage.getItem(PASSKEY_OFFER_SEEN_KEY) === '1') return false
  try { return !(Number(window.localStorage.getItem(PASSKEY_OFFER_SNOOZE_KEY) ?? 0) > now) }
  catch { return false }
}

/** Browser storage getters may throw before the storage helpers can catch anything. */
export function completePasskeyOffer(origin: string, days: number): string {
  try { snoozePasskeyOffer(window.localStorage, days) } catch { /* Optional device preference. */ }
  try {
    const storage = window.sessionStorage
    markPasskeyOfferSeen(storage)
    // Skip this offer even when setItem fails; otherwise leaving would navigate back into it.
    return consumeAuthDestination(storage, origin, false, true)
  } catch { return '/home' }
}

export function safeAuthReturnPath(value: string | null, origin: string): string | null {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value, origin)
    const pathname = decodeURIComponent(url.pathname)
    if (url.origin !== origin || pathname.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(pathname) || /^\/(?:login|register|welcome|onboarding|verify-email|recovery|auth)(?:\/|$)/.test(pathname) || pathname === '/') return null
    return url.pathname + url.search + url.hash
  } catch { return null }
}

// Every method resumes a valid protected page saved in this tab; otherwise Home.
// A new account first stops at the welcome step, which consumes the real destination later.
export function consumeAuthDestination(storage: StorageReader, origin: string, oauth = false, skipPasskeyOffer = false): string {
  let destination = '/home'
  try {
    const isNew = storage.getItem(NEW_ACCOUNT_KEY) === '1'
    if (isNew && oauth) storage.removeItem('rwa.return-to')
    // Order: passkey offer, then the new-account welcome, then the saved page. Each step calls back in here.
    if (!skipPasskeyOffer && passkeyOfferDue(storage, Date.now())) return PASSKEY_OFFER_PATH
    if (isNew) {
      storage.removeItem(NEW_ACCOUNT_KEY)
      return WELCOME_PATH
    }
    destination = safeAuthReturnPath(storage.getItem('rwa.return-to'), origin) ?? '/home'
    for (const key of ['rwa.return-to', 'rwa.pending-email', 'rwa.pending-email-mode', 'rwa.pending-consents', PASSKEY_OFFER_SEEN_KEY]) storage.removeItem(key)
  } catch { /* A successful sign-in never depends on optional browser storage. */ }
  return destination
}
