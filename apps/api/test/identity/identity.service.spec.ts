import { ConflictException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { keccak_256 } from '@noble/hashes/sha3'
import { secp256k1 } from '@noble/curves/secp256k1'
import { IdentityService } from '../../src/identity/identity.service'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { User } from '../../src/identity/user.entity'
import { LoginIdentity } from '../../src/identity/login-identity.entity'
import { Device } from '../../src/identity/device.entity'
import { Session } from '../../src/identity/session.entity'
import { IdentityOneTimeToken } from '../../src/identity/identity-one-time-token.entity'
import { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'
import { OAuthProviderService } from '../../src/identity/oauth-provider.service'

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
  let delivery: { sendOneTimeLink: jest.Mock; lastDemoToken: jest.Mock }
  let oauthProvider: { begin: jest.Mock; exchange: jest.Mock }
  let crypto: IdentityCrypto

  beforeEach(async () => {
    users = new Repo()
    logins = new Repo()
    devices = new Repo()
    sessions = new Repo()
    oneTimeTokens = new Repo()
    delivery = {
      sendOneTimeLink: jest.fn(),
      lastDemoToken: jest.fn(),
    }
    oauthProvider = {
      begin: jest.fn(),
      exchange: jest.fn().mockRejectedValue(new ServiceUnavailableException()),
    }
    crypto = makeCrypto()
    const moduleRef = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(LoginIdentity), useValue: logins },
        { provide: getRepositoryToken(Device), useValue: devices },
        { provide: getRepositoryToken(Session), useValue: sessions },
        { provide: getRepositoryToken(IdentityOneTimeToken), useValue: oneTimeTokens },
        { provide: IdentityCrypto, useValue: crypto },
        { provide: IdentityDeliveryService, useValue: delivery },
        { provide: OAuthProviderService, useValue: oauthProvider },
        { provide: ConfigService, useValue: { get: () => 'demo' } },
      ],
    }).compile()
    svc = moduleRef.get(IdentityService)
  })

  it('registerEmail creates a pending user + identity and sends a non-returned one-time token', async () => {
    const r = await svc.registerEmail('a@b.com')
    expect(r).toEqual({ accepted: true })
    expect(logins.data).toHaveLength(1)
    expect(logins.data[0].state).toBe('pending')
    expect(oneTimeTokens.data).toHaveLength(1)
    expect(delivery.sendOneTimeLink).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'email_verification' }))
  })

  it('registerEmail conflicts when the email is already verified', async () => {
    await svc.registerEmail('a@b.com')
    logins.data[0].state = 'verified'
    await expect(svc.registerEmail('a@b.com')).rejects.toBeInstanceOf(ConflictException)
  })

  it('verifyEmail flips a pending identity to verified', async () => {
    await svc.registerEmail('a@b.com')
    const token = 'email-token'
    oneTimeTokens.data[0].tokenHash = crypto.hashToken(token)
    const v = await svc.verifyEmail(token)
    expect(v.verified).toBe(true)
    expect(v.token).toHaveLength(64)
    expect(logins.data[0].state).toBe('verified')
    await expect(svc.verifyEmail(token)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('wallet verify opens a session for a valid signature', async () => {
    const priv = secp256k1.utils.randomPrivateKey()
    const address = deriveAddress(priv)
    const { nonce } = await svc.createWalletChallenge(address)
    const signature = signMessage(priv, nonce)
    const r = await svc.verifyWalletSignature(address, signature, nonce)
    expect(r.token).toBeDefined()
    expect(sessions.data).toHaveLength(1)
    expect(logins.data[0].kind).toBe('external_wallet')
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
    oauthProvider.exchange.mockResolvedValue({ subject: 'verified-google-subject', displayName: 'User' })

    const result = await svc.exchangeOAuthCode('google', 'provider-code', 'state-value-with-minimum-length')

    expect(result.token).toHaveLength(64)
    expect(logins.data[0]).toMatchObject({ kind: 'google', state: 'verified' })
    expect(oauthProvider.exchange).toHaveBeenCalledWith(
      'google', 'provider-code', 'state-value-with-minimum-length', undefined,
    )
  })

  it('recover uses an indistinguishable response and only dispatches a token for a verified email', async () => {
    await svc.registerEmail('a@b.com')
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
    const r = await svc.verifyWalletSignature(address, signature, nonce)
    await svc.revokeSession(r.sessionId, r.token)
    expect(sessions.data[0].state).toBe('revoked')
  })

  it('revokeSession throws when the session is missing', async () => {
    await expect(svc.revokeSession('missing', 'tok')).rejects.toBeInstanceOf(NotFoundException)
  })
})
