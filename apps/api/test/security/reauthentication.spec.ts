import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { assertReauthentication } from '../../src/security/reauthentication'

describe('sensitive account changes', () => {
  const crypto = new IdentityCrypto({ getOrThrow: () => 'a'.repeat(64) } as any)
  const actor = { userId: 'user-1', sessionId: 'session-1' }
  const payload = { ...actor, audience: 'rwa-lat-security-step-up', method: 'passkey', expiresAt: Date.now() + 60_000 }
  const token = (changes = {}) => crypto.signState(JSON.stringify({ ...payload, ...changes }))
  it.each(['passkey', 'totp', 'recovery_code'])('accepts %s verification from the current account and session', method => {
    expect(() => assertReauthentication(crypto, actor, token({ method }))).not.toThrow()
  })
  it.each([{ userId: 'other' }, { sessionId: 'other' }, { expiresAt: 0 }, { audience: 'login' }, { method: 'password' }])('rejects invalid proof %j', changes => {
    expect(() => assertReauthentication(crypto, actor, token(changes))).toThrow()
  })
  it('rejects unsigned, tampered or malformed proof', () => {
    for (const value of ['', 'invalid', crypto.signState('null'), crypto.signState('{'), token().slice(0, -4)]) {
      expect(() => assertReauthentication(crypto, actor, value)).toThrow()
    }
  })
})
