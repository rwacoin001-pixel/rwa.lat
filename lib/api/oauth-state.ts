type OAuthProvider = 'google' | 'x'
type StateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const key = (provider: OAuthProvider) => `rwa.oauth-state.${provider}`
const TTL = 10 * 60 * 1000

/** Bind a redirect to the browser tab that actually initiated it. */
export function rememberOAuthState(storage: StateStorage, provider: OAuthProvider, authorizationUrl: string, now = Date.now()): void {
  const params = new URL(authorizationUrl).searchParams
  const state = params.get(provider === 'x' ? 'oauth_token' : 'state')
  const valid = provider === 'x' ? /^[A-Za-z0-9_-]{16,512}$/.test(state ?? '') : /^[A-Za-z0-9_-]{43,128}$/.test(state ?? '')
  if (!state || !valid) throw new Error('Invalid OAuth state')
  storage.setItem(key(provider), JSON.stringify({ state, expiresAt: now + TTL }))
}

export function consumeOAuthState(storage: StateStorage, provider: OAuthProvider, state: string, now = Date.now()): boolean {
  try {
    const raw = storage.getItem(key(provider))
    if (!raw) return false
    const saved = JSON.parse(raw)
    // A foreign callback must not consume an unrelated legitimate attempt.
    if (saved.state !== state) return false
    storage.removeItem(key(provider))
    return typeof saved.expiresAt === 'number' && saved.expiresAt > now && saved.expiresAt <= now + TTL
  } catch { return false }
}
