import { ConflictException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityPasskeyChallenge } from '../../src/identity/identity-passkey-challenge.entity'
import { PasskeyCredential } from '../../src/security/passkey-credential.entity'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { OAuthProviderService } from '../../src/identity/oauth-provider.service'
import { REGISTRATION_CONSENT_REQUIREMENTS, type RegistrationConsentAcceptance } from '../../src/identity/consent-policy'

const acceptedConsents: RegistrationConsentAcceptance[] = REGISTRATION_CONSENT_REQUIREMENTS.map(({ documentType, version }) => ({
  documentType,
  version,
  accepted: true,
}))

function makeCrypto(): IdentityCrypto {
  const cfg: any = {
    getOrThrow: (k: string) =>
      k === 'IDENTITY_HMAC_KEY' || k === 'IDENTITY_ENC_KEY' ? 'a'.repeat(64) : '',
  }
  return new IdentityCrypto(cfg)
}

class Repo {
  data: any[] = []
  create(e: any) {
    return { ...e }
  }
  async save(e: any) {
    this.data.push(e)
    return e
  }
  async findOne(q: any) {
    return (
      this.data.find((d) =>
        Object.entries(q.where).every(([k, v]) => {
          if (v && typeof v === 'object' && (v as any).constructor?.name === 'FindOperator') return d[k] == null
          const dv = d[k]
          return dv && dv.equals ? dv.equals(v as any) : dv === v
        }),
      ) || null
    )
  }
  async update(where: any, patch: any) {
    const rows = this.data.filter((d) =>
      Object.entries(where).every(([key, value]) => {
        if (value && typeof value === 'object' && value.constructor?.name === 'FindOperator') return d[key] == null
        const current = d[key]
        return current && current.equals ? current.equals(value as any) : current === value
      }),
    )
    for (const row of rows) Object.assign(row, patch)
    return { affected: rows.length }
  }
}

function deriveAddress(priv: Uint8Array): string {
  const pub = secp256k1.getPublicKey(priv, false)
  return '0x' + Buffer.from(keccak_256(pub.subarray(1)).subarray(12)).toString('hex')
}

function signMessage(priv: Uint8Array, message: string): string {
  const prefix = `\x19Ethereum Signed Message:\n${Buffer.byteLength(message)}${message}`
  const msgHash = keccak_256(Buffer.from(prefix, 'utf8'))
  const sig = secp256k1.sign(msgHash, priv)
  const rBytes = Buffer.from(sig.r.toString(16).padStart(64, '0'), 'hex')
  const sBytes = Buffer.from(sig.s.toString(16).padStart(64, '0'), 'hex')
  const sigBytes = Buffer.concat([rBytes, sBytes, Buffer.from([sig.recovery! + 27])])
  return '0x' + sigBytes.toString('hex')
}

describe('IdentityService', () => {
  let svc: IdentityService
  let users: Repo
  let logins: Repo
  let devices: Repo
  let sessions: Repo
  let oneTimeTokens: Repo
  let passkeys: Repo
  let passkeyChallenges: Repo
  let delivery: { sendOneTimeLink: jest.Mock; lastDemoToken: jest.Mock }
  let oauthProvider: { begin: jest.Mock; exchange: jest.Mock }
  let crypto: IdentityCrypto
  let dataSource: { transaction: jest.Mock; query: jest.Mock; manager: unknown }
  let consentQueries: Array<{ sql: string; params: unknown[] }>
  let savedConsentRows: Array<{ user_id: string; document_type: string; document_version: string }>

  beforeEach(async () => {
    users = new Repo()
    logins = new Repo()
    devices = new Repo()
    sessions = new Repo()
    oneTimeTokens = new Repo()
    passkeys = new Repo()
    passkeyChallenges = new Repo()
    delivery = {
      sendOneTimeLink: jest.fn(),
      lastDemoToken: jest.fn(),
    }
    oauthProvider = {
      begin: jest.fn(),
      exchange: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    }
    consentQueries = []
    savedConsentRows = []
    const repositories = new Map<unknown, unknown>([[User, users], [LoginIdentity, logins]])
    const walletChallenges = new Map<string, { address: unknown; expiresAt: Date; consumed: boolean }>()
    const manager = {
      getRepository: (entity: unknown) => repositories.get(entity),
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        // Existing identity fixtures model accounts without passwords or TOTP.
        // Password registration and factor policy are covered against real SQL in password-auth.rollback.spec.ts.
        if (sql.includes('SELECT u.status,coalesce(c.version')) return [{ status: 'active', version: 0, password_required: false, password_hash: null }]
        if (sql.includes('FROM app.totp_factors')) return []
        if (sql.includes('INSERT INTO app.login_identities')) {
          const [id, userId, identifierHash, identifierCiphertext, encryptionKeyVersion] = params
          if (!logins.data.some(row => row.kind === 'email' && (row.userId === userId || row.identifierHash.equals(identifierHash)))) {
            logins.data.push({ id, userId, kind: 'email', state: 'verified', identifierHash, identifierCiphertext, encryptionKeyVersion, verifiedAt: new Date(), revokedAt: null })
          }
          return []
        }
        if (sql.includes('app.wallet_sign_in_challenges')) {
          const key = (params[0] as Buffer).toString('hex')
          if (sql.startsWith('INSERT')) { walletChallenges.set(key, { address: params[1], expiresAt: params[2] as Date, consumed: false }); return [] }
          const row = walletChallenges.get(key)
          if (!row || row.consumed || row.address !== params[1] || row.expiresAt.getTime() <= Date.now()) return []
          if (sql.startsWith('UPDATE')) row.consumed = true
          return [{ address: row.address }]
        }
        consentQueries.push({ sql, params })
        if (sql.trimStart().startsWith('SELECT')) {
          return savedConsentRows.filter((row) => row.user_id === params[0])
        }
        if (sql.includes('INSERT INTO app.consents')) {
          savedConsentRows.push({
            user_id: params[0] as string,
            document_type: params[1] as string,
            document_version: params[2] as string,
          })
        }
        return []
      }),
    }
    dataSource = { manager, query: manager.query, transaction: jest.fn(async (callback: (transactionManager: any) => unknown) => callback(manager)) }
    crypto = makeCrypto()
    const moduleRef = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(LoginIdentity), useValue: logins },
        { provide: getRepositoryToken(Device), useValue: devices },
        { provide: getRepositoryToken(Session), useValue: sessions },
        { provide: getRepositoryToken(IdentityOneTimeToken), useValue: oneTimeTokens },
        { provide: getRepositoryToken(PasskeyCredential), useValue: passkeys },
        { provide: getRepositoryToken(IdentityPasskeyChallenge), useValue: passkeyChallenges },
        { provide: IdentityCrypto, useValue: crypto },
        { provide: IdentityDeliveryService, useValue: delivery },
        { provide: OAuthProviderService, useValue: oauthProvider },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'PUBLIC_APP_URL' ? 'http://localhost:3030' : 'demo' } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()
    svc = moduleRef.get(IdentityService)
  })

  it('registerEmail creates a pending user + identity and sends a non-returned one-time token', async () => {
    const r = await svc.registerEmail('a@b.com', 'en', acceptedConsents)
    expect(r).toEqual({ accepted: true })
    expect(users.data).toHaveLength(1)
    expect(logins.data).toHaveLength(1)
    expect(logins.data[0].state).toBe('pending')
    const writes = consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))
    expect(writes).toHaveLength(2)
    expect(writes.map(({ params }) => params.slice(1, 3))).toEqual([
      ['terms', '2026-09-18'],
      ['privacy', '2026-09-18'],
    ])
    expect(writes.every(({ params }) => params[3] instanceof Date)).toBe(true)
    expect(oneTimeTokens.data).toHaveLength(1)
    expect(delivery.sendOneTimeLink).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'email_verification' }))
  })

  it('rejects email registration without both current consent grants before writing account data', async () => {
    await expect(svc.registerEmail('a@b.com')).rejects.toMatchObject({
      response: { code: 'AUTH_CONSENT_REQUIRED' },
    })
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(0)
    expect(logins.data).toHaveLength(0)
    expect(users.data).toHaveLength(0)
  })

  it('keeps a pending email signup retry idempotent for the same consent versions', async () => {
    await svc.registerEmail('a@b.com', 'en', acceptedConsents)
    await svc.registerEmail('a@b.com', 'en', acceptedConsents)

    expect(users.data).toHaveLength(1)
    expect(logins.data).toHaveLength(1)
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(2)
    expect(delivery.sendOneTimeLink).toHaveBeenCalledTimes(2)
  })

  it('rejects a stale consent version before creating an email account', async () => {
    const stale = acceptedConsents.map((consent) => ({ ...consent }))
    stale[0].version = '2026-01-01'

    await expect(svc.registerEmail('a@b.com', 'en', stale)).rejects.toMatchObject({
      response: { code: 'AUTH_CONSENT_VERSION_MISMATCH' },
    })
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(0)
    expect(logins.data).toHaveLength(0)
    expect(users.data).toHaveLength(0)
  })

  it('registerEmail conflicts when the email is already verified', async () => {
    await svc.registerEmail('a@b.com', 'en', acceptedConsents)
    logins.data[0].state = 'verified'
    await expect(svc.registerEmail('a@b.com', 'en', acceptedConsents)).rejects.toBeInstanceOf(ConflictException)
  })

  it('verifyEmail flips a pending identity to verified', async () => {
    await svc.registerEmail('a@b.com', 'en', acceptedConsents)
    const token = 'email-token'
    oneTimeTokens.data[0].tokenHash = crypto.hashToken(token)
    const v = await svc.verifyEmail(token)
    expect(v.verified).toBe(true)
    expect(v.token).toHaveLength(64)
    expect(logins.data[0].state).toBe('verified')
    await expect(svc.verifyEmail(token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('wallet challenge marks a new address as requiring registration without creating records', async () => {
    const address = '0x' + '2'.repeat(40)
    const challenge = await svc.createWalletChallenge(address)

    expect(challenge).toMatchObject({ address, registrationRequired: true })
    expect(users.data).toHaveLength(0)
    expect(logins.data).toHaveLength(0)
  })

  it('does not create a wallet account until current consent is supplied', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce, registrationRequired } = await svc.createWalletChallenge(address)
    const signature = signMessage(priv, nonce)

    expect(registrationRequired).toBe(true)
    await expect(svc.verifyWalletSignature(address, signature, nonce))
      .rejects.toMatchObject({ response: { code: 'AUTH_CONSENT_REQUIRED' } })

    expect(users.data).toHaveLength(0)
    expect(logins.data).toHaveLength(0)
    expect(sessions.data).toHaveLength(0)
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(0)
  })

  it('wallet registration creates the identity and current consent records atomically', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce } = await svc.createWalletChallenge(address)
    const signature = signMessage(priv, nonce)
    const r = await svc.verifyWalletSignature(address, signature, nonce, undefined, acceptedConsents)
    expect(r.token).toBeDefined()
    expect(users.data).toHaveLength(1)
    expect(sessions.data).toHaveLength(1)
    expect(logins.data[0]).toMatchObject({ kind: 'external_wallet', state: 'verified', userId: users.data[0].id })
    const writes = consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))
    expect(writes).toHaveLength(2)
    expect(writes.map(({ params }) => params.slice(1, 3))).toEqual([
      ['terms', '2026-09-18'],
      ['privacy', '2026-09-18'],
    ])
    expect(writes.every(({ params }) => params[3] instanceof Date)).toBe(true)
  })

  it('allows an existing wallet identity to sign in without registration consent', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const firstChallenge = await svc.createWalletChallenge(address)
    await svc.verifyWalletSignature(address, signMessage(priv, firstChallenge.nonce), firstChallenge.nonce, undefined, acceptedConsents)

    const nextChallenge = await svc.createWalletChallenge(address)
    expect(nextChallenge.registrationRequired).toBe(false)
    const result = await svc.verifyWalletSignature(address, signMessage(priv, nextChallenge.nonce), nextChallenge.nonce)

    expect(result.token).toBeDefined()
    expect(users.data).toHaveLength(1)
    expect(logins.data).toHaveLength(1)
    expect(sessions.data).toHaveLength(2)
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(2)
  })

  it('invalid signatures do not consume a valid challenge, but successful authentication prevents replay', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce } = await svc.createWalletChallenge(address, 137)
    expect(nonce).toContain('http://localhost:3030 wants you to sign in')
    expect(nonce).toContain('Chain ID: 137')
    expect(nonce).toContain('Expiration Time:')
    await expect(svc.verifyWalletSignature(address, '0x' + '0'.repeat(130), nonce)).rejects.toMatchObject({ response: { code: 'INVALID_WALLET_SIGNATURE' } })
    const signature = signMessage(priv, nonce)
    await svc.verifyWalletSignature(address, signature, nonce, undefined, acceptedConsents)
    await expect(svc.verifyWalletSignature(address, signature, nonce)).rejects.toMatchObject({ response: { code: 'WALLET_NONCE_MISMATCH' } })
  })

  it('wallet verify rejects a used/unknown nonce', async () => {
    const address = '0x' + '1'.repeat(40)
    await svc.createWalletChallenge(address)
    await expect(
      svc.verifyWalletSignature(address, '0x' + '0'.repeat(130), 'wrong-nonce'),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('never accepts a browser-declared OAuth subject when no verified provider adapter is configured', async () => {
    await expect(svc.exchangeOAuthCode('google', 'untrusted-code', 'state-value-with-minimum-length')).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('creates an OAuth identity only from the server-verified provider subject', async () => {
    oauthProvider.exchange.mockResolvedValue({
      subject: 'verified-google-subject',
      displayName: 'User',
      intent: 'register',
      registrationConsents: acceptedConsents,
      consentedAt: new Date('2026-09-20T12:00:00.000Z'),
    })

    const result = await svc.exchangeOAuthCode('google', 'provider-code', 'state-value-with-minimum-length')

    expect(result.token).toHaveLength(64)
    expect(logins.data[0]).toMatchObject({ kind: 'google', state: 'verified' })
    const writes = consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))
    expect(writes).toHaveLength(2)
    expect(writes.every(({ params }) => params[3] instanceof Date && params[3].toISOString() === '2026-09-20T12:00:00.000Z')).toBe(true)
    expect(oauthProvider.exchange).toHaveBeenCalledWith(
      'google', 'provider-code', 'state-value-with-minimum-length', undefined,
    )
  })

  it('does not create an account when an OAuth login identity is unknown', async () => {
    oauthProvider.exchange.mockResolvedValue({ subject: 'unknown-google-subject', intent: 'login' })

    await expect(svc.exchangeOAuthCode('google', 'provider-code', 'state-value-with-minimum-length'))
      .rejects.toMatchObject({ response: { code: 'AUTH_FLOW_REQUIRED', authFlow: { step: 'consent' } } })

    expect(users.data).toHaveLength(0)
    expect(logins.data).toHaveLength(0)
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(0)
  })

  it('does not require new consent to sign in with an existing OAuth identity', async () => {
    const userId = 'existing-user'
    logins.data.push({
      userId,
      kind: 'google',
      identifierHash: crypto.hashIdentifier('google:existing-google-subject'),
      state: 'verified',
    })
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', intent: 'login' })

    const result = await svc.exchangeOAuthCode('google', 'provider-code', 'state-value-with-minimum-length')

    expect(result.userId).toBe(userId)
    expect(users.data).toHaveLength(0)
    expect(consentQueries.filter(({ sql }) => sql.includes('INSERT INTO app.consents'))).toHaveLength(0)
  })

  function existingGoogle(subject = 'existing-google-subject') {
    const encrypted = crypto.encrypt(`google:${subject}`)
    const identity = { id: 'google-identity', userId: 'google-user', kind: 'google', state: 'verified',
      identifierHash: crypto.hashIdentifier(`google:${subject}`), identifierCiphertext: encrypted.ciphertext,
      encryptionKeyVersion: encrypted.keyVersion, verifiedAt: new Date(), revokedAt: null }
    logins.data.push(identity)
    return identity
  }

  function accountEmail(userId: string, email: string, state = 'verified') {
    const encrypted = crypto.encrypt(email)
    const identity = { id: 'email-identity', userId, kind: 'email', state,
      identifierHash: crypto.hashIdentifier(email), identifierCiphertext: encrypted.ciphertext,
      encryptionKeyVersion: encrypted.keyVersion, verifiedAt: state === 'pending' ? null : new Date(), revokedAt: null }
    logins.data.push(identity)
    return identity
  }

  it('creates a verified email and masked label from a new Google registration', async () => {
    oauthProvider.exchange.mockResolvedValue({ subject: 'new-google-subject', verifiedEmail: 'alice@example.com', intent: 'register',
      registrationConsents: acceptedConsents, consentedAt: new Date() })
    const result = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(result.emailVerified).toBe(true)
    const view = await svc.getSessionViewByToken(result.token)
    expect(view).toMatchObject({ userId: result.userId, emailVerified: true, accountLabel: 'a****@example.com' })
    expect(logins.data.find(row => row.kind === 'email')).toMatchObject({ userId: result.userId, state: 'verified' })
    expect(delivery.sendOneTimeLink).not.toHaveBeenCalled()
    expect(JSON.stringify(view)).not.toContain('alice')
  })

  it('repairs an existing Google account in place on its next verified provider login', async () => {
    existingGoogle()
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', intent: 'login' })
    const old = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(await svc.getSessionViewByToken(old.token)).toMatchObject({ userId: 'google-user', emailVerified: false, accountLabel: 'Google' })
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', verifiedEmail: 'alice@example.com', intent: 'login' })
    const repaired = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(repaired).toMatchObject({ userId: old.userId, emailVerified: true })
    expect(await svc.getSessionViewByToken(old.token)).toMatchObject({ emailVerified: true, accountLabel: 'a****@example.com' })
    expect(users.data).toHaveLength(0)
    expect(logins.data.filter(row => row.kind === 'google')).toHaveLength(1)
  })

  it('keeps a duplicate email account separate while recognizing the Google email proof', async () => {
    existingGoogle()
    const other = accountEmail('other-user', 'alice@example.com')
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', verifiedEmail: 'alice@example.com', intent: 'login' })
    const result = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(result).toMatchObject({ userId: 'google-user', emailVerified: true })
    expect(await svc.getSessionViewByToken(result.token)).toMatchObject({ accountLabel: 'a****@example.com', emailVerified: true })
    expect(logins.data.filter(row => row.kind === 'email')).toEqual([other])
    expect(other.userId).toBe('other-user')
  })

  it('verifies the same pending account email from Google proof without sending a new code', async () => {
    existingGoogle()
    const email = accountEmail('google-user', 'alice@example.com', 'pending')
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', verifiedEmail: 'alice@example.com', intent: 'login' })
    expect((await svc.exchangeOAuthCode('google', 'code', 'server-state')).emailVerified).toBe(true)
    expect(email.state).toBe('verified')
    expect(delivery.sendOneTimeLink).not.toHaveBeenCalled()
  })

  it('preserves an explicitly changed account email rather than replacing it with the Google email', async () => {
    existingGoogle()
    const email = accountEmail('google-user', 'changed@example.com')
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', verifiedEmail: 'alice@example.com', intent: 'login' })
    const result = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(await svc.getSessionViewByToken(result.token)).toMatchObject({ accountLabel: 'c******@example.com', emailVerified: true })
    expect(crypto.decrypt(email.identifierCiphertext, email.encryptionKeyVersion)).toBe('changed@example.com')
  })

  it('does not revive a revoked account email or Google sign-in method', async () => {
    const google = existingGoogle()
    const email = accountEmail('google-user', 'alice@example.com', 'revoked')
    email.revokedAt = new Date() as never
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', verifiedEmail: 'alice@example.com', intent: 'login' })
    expect((await svc.exchangeOAuthCode('google', 'code', 'server-state')).emailVerified).toBe(false)
    expect(email.state).toBe('revoked')
    google.state = 'revoked'; google.revokedAt = new Date() as never
    await expect(svc.exchangeOAuthCode('google', 'code', 'server-state')).rejects.toMatchObject({ response: { code: 'IDENTITY_NOT_FOUND' } })
  })

  it('does not invent verification for old Google rows without a verified provider email', async () => {
    existingGoogle()
    oauthProvider.exchange.mockResolvedValue({ subject: 'existing-google-subject', intent: 'login' })
    const result = await svc.exchangeOAuthCode('google', 'code', 'server-state')
    expect(result.emailVerified).toBe(false)
    expect(logins.data.filter(row => row.kind === 'email')).toHaveLength(0)
  })

  it('recover uses an indistinguishable response and only dispatches a token for a verified email', async () => {
    await svc.registerEmail('a@b.com', 'en', acceptedConsents)
    const token = 'verify-token'
    oneTimeTokens.data[0].tokenHash = crypto.hashToken(token)
    await svc.verifyEmail(token)
    const known = await svc.recover('a@b.com')
    expect(known).toEqual({ accepted: true })
    expect(delivery.sendOneTimeLink).toHaveBeenLastCalledWith(expect.objectContaining({ purpose: 'account_recovery' }))
    const unknown = await svc.recover('nobody@x.com')
    expect(unknown).toEqual({ accepted: true })
  })

  it('revokeSession revokes an active session', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce } = await svc.createWalletChallenge(address)
    const signature = signMessage(priv, nonce)
    const r = await svc.verifyWalletSignature(address, signature, nonce, undefined, acceptedConsents)
    await svc.revokeSession(r.sessionId, r.token)
    expect(sessions.data[0].state).toBe('revoked')
  })

  it('session view exposes only a masked email label', async () => {
    await svc.registerEmail('alice@example.com', 'en', acceptedConsents)
    oneTimeTokens.data[0].tokenHash = crypto.hashToken('email-token')
    const { token } = await svc.verifyEmail('email-token')
    const view = await svc.getSessionViewByToken(token)
    expect(view.emailVerified).toBe(true)
    expect(view.accountLabel).toBe('a****@example.com')
    expect(JSON.stringify(view)).not.toContain('alice')
  })

  it('session view shortens the wallet address when no email identity exists', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce } = await svc.createWalletChallenge(address)
    const r = await svc.verifyWalletSignature(address, signMessage(priv, nonce), nonce, undefined, acceptedConsents)
    const view = await svc.getSessionViewByToken(r.token)
    expect(view.emailVerified).toBe(false)
    expect(view.accountLabel).toBe(`${address.slice(0, 6)}…${address.slice(-4)}`)
  })

  it('revokeSession throws when the session is missing', async () => {
    await expect(svc.revokeSession('missing', 'tok')).rejects.toBeInstanceOf(NotFoundException)
  })
  describe('Android app sign-in handoff', () => {
    const { createHash } = require('node:crypto') as typeof import('node:crypto')
    const verifier = 'v'.repeat(43) + 'ABCdef0123456789_-'
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const browserToken = 'browser-session-token'

    beforeEach(() => {
      users.data.push({ id: 'u-handoff', status: 'active', locale: 'zh-CN' })
      sessions.data.push({ id: 's-browser', userId: 'u-handoff', deviceId: 'd-browser', tokenHash: crypto.hashToken(browserToken), state: 'active', expiresAt: new Date(Date.now() + 3600_000) })
    })

    it('a signed-in browser gets a two-minute code; the app redeems it with its verifier for a session of its own, once', async () => {
      const { code, expiresAt } = await svc.startAppHandoff(browserToken, challenge)
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(2 * 60 * 1000)
      expect(oneTimeTokens.data.filter(row => row.purpose === 'app_handoff')).toHaveLength(1)
      expect(oneTimeTokens.data[0].tokenHash.equals(crypto.hashToken(code))).toBe(false)

      const session = await svc.redeemAppHandoff(code, verifier)
      expect(session.userId).toBe('u-handoff')
      expect(session.token).not.toBe(browserToken)
      expect(new Set(sessions.data.map(row => row.id)).size).toBe(2)

      await expect(svc.redeemAppHandoff(code, verifier)).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('a code without the matching verifier is useless (another app catching the redirect cannot sign in)', async () => {
      const { code } = await svc.startAppHandoff(browserToken, challenge)
      await expect(svc.redeemAppHandoff(code, 'w'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException)
      expect(new Set(sessions.data.map(row => row.id)).size).toBe(1)
    })

    it('expired codes and suspended accounts are refused', async () => {
      const first = await svc.startAppHandoff(browserToken, challenge)
      oneTimeTokens.data.find(row => row.purpose === 'app_handoff' && row.consumedAt === null).expiresAt = new Date(Date.now() - 1)
      await expect(svc.redeemAppHandoff(first.code, verifier)).rejects.toBeInstanceOf(UnauthorizedException)

      const second = await svc.startAppHandoff(browserToken, challenge)
      users.data.find(row => row.id === 'u-handoff').status = 'suspended'
      await expect(svc.redeemAppHandoff(second.code, verifier)).rejects.toBeInstanceOf(UnauthorizedException)
      expect(new Set(sessions.data.map(row => row.id)).size).toBe(1)
    })

    it('a new code replaces the previous unused one, and a code needs a signed-in browser', async () => {
      const first = await svc.startAppHandoff(browserToken, challenge)
      await svc.startAppHandoff(browserToken, challenge)
      await expect(svc.redeemAppHandoff(first.code, verifier)).rejects.toBeInstanceOf(UnauthorizedException)
      await expect(svc.startAppHandoff('not-a-session', challenge)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })
})
