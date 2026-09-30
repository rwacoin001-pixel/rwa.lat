import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'

describe('passkey login account binding (real WebAuthn signatures)', () => {
  function fixture() {
    const config = new ConfigService({ IDENTITY_HMAC_KEY: 'a'.repeat(64), IDENTITY_ENC_KEY: 'b'.repeat(64),
      PASSKEY_RP_ID: 'localhost', PASSKEY_ORIGIN: 'http://localhost:3030' })
    const crypto = new IdentityCrypto(config)
    const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const jwk = keys.publicKey.export({ format: 'jwk' })
    const publicKey = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x!, 'base64url'),
      Buffer.from('225820', 'hex'), Buffer.from(jwk.y!, 'base64url')])
    const credentials = ['A', 'B'].map(userId => ({ userId, credentialId: randomBytes(32).toString('base64url'),
      publicKey, counter: 0, transports: ['internal'], state: 'active' }))
    let challenge: any
    const passkeys = { find: jest.fn(async () => [credentials[0]]),
      findOne: jest.fn(async ({ where }) => credentials.find(row => row.credentialId === where.credentialId)),
      save: jest.fn(async row => row) }
    const challenges = { create: (row: any) => row, save: jest.fn(async row => (challenge = row)),
      findOne: jest.fn(async () => challenge?.consumedAt ? null : challenge),
      update: jest.fn(async () => { challenge.consumedAt = new Date(); return { affected: 1 } }) }
    // Exercise the real methods with an in-memory persistence boundary; no database is required.
    const issueSession = jest.fn(async userId => ({ userId, token: randomUUID() }))
    const service = Object.assign(Object.create(IdentityService.prototype), {
      config, crypto, passkeys, passkeyChallenges: challenges,
      loginIdentities: { findOne: jest.fn(async () => ({ userId: 'A' })) },
      issueSession,
    }) as IdentityService
    function assertion(options: Record<string, unknown>, index: number, origin = 'http://localhost:3030', verified = true) {
      const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin, crossOrigin: false }))
      const counter = Buffer.alloc(4); counter.writeUInt32BE(1)
      const auth = Buffer.concat([createHash('sha256').update('localhost').digest(), Buffer.from([verified ? 5 : 1]), counter])
      const id = credentials[index].credentialId
      return { id, rawId: id, type: 'public-key', response: { clientDataJSON: client.toString('base64url'),
        authenticatorData: auth.toString('base64url'),
        signature: sign('sha256', Buffer.concat([auth, createHash('sha256').update(client).digest()]), keys.privateKey).toString('base64url') },
        clientExtensionResults: {} }
    }
    return { service, issueSession, crypto, passkeys, challenges, credentials, assertion, challenge: () => challenge }
  }

  it('rejects a valid signature from B for an email-scoped challenge issued to A', async () => {
    const f = fixture(), start = await f.service.beginPasskeyLogin('a@example.test')
    expect((start.options.allowCredentials as { id: string }[]).map(row => row.id)).toEqual([f.credentials[0].credentialId])
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 1))).rejects.toThrow()
    expect(f.issueSession).not.toHaveBeenCalled()
    expect(f.challenges.update).not.toHaveBeenCalled()
    const result = await f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0))
    expect(result.userId).toBe('A')
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0))).rejects.toThrow()
  })

  it('continues to support discoverable login without an email', async () => {
    const f = fixture(), start = await f.service.beginPasskeyLogin()
    expect((await f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 1))).userId).toBe('B')
  })

  it('still rejects wrong origin, missing user verification, revoked credentials and expired challenges', async () => {
    const f = fixture(), start = await f.service.beginPasskeyLogin('a@example.test')
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0, 'https://wrong.test'))).rejects.toThrow()
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0, undefined, false))).rejects.toThrow()
    f.passkeys.findOne.mockResolvedValueOnce(undefined)
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0))).rejects.toThrow()
    f.challenge().expiresAt = new Date(0)
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 0))).rejects.toThrow()
    expect(f.issueSession).not.toHaveBeenCalled()
  })

  it('rejects outstanding legacy challenges whose account scope cannot be established', async () => {
    const f = fixture(), start = await f.service.beginPasskeyLogin('a@example.test')
    const encrypted = f.crypto.encrypt(String(start.options.challenge))
    Object.assign(f.challenge(), { challengeCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion })
    await expect(f.service.finishPasskeyLogin(start.challengeId, f.assertion(start.options, 1))).rejects.toThrow()
    expect(f.issueSession).not.toHaveBeenCalled()
  })
})
