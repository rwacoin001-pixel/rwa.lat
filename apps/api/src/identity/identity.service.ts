import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { IsNull, Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { IDENTITY_ERROR_CODES } from './identity.errors'
import { IdentityCrypto } from './identity-crypto.service'
import { Device } from './device.entity'
import { LoginIdentity } from './login-identity.entity'
import { Session } from './session.entity'
import { User } from './user.entity'
import { IdentityOneTimeToken, type IdentityOneTimeTokenPurpose } from './identity-one-time-token.entity'
import { IdentityDeliveryService } from './identity-delivery.service'
import { OAuthProviderService, type OAuthProviderName } from './oauth-provider.service'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ONE_TIME_TOKEN_TTL_MS = 15 * 60 * 1000

export interface AuthResult {
  userId: string
  sessionId: string
  token: string
}

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginIdentity) private readonly loginIdentities: Repository<LoginIdentity>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(IdentityOneTimeToken) private readonly oneTimeTokens: Repository<IdentityOneTimeToken>,
    private readonly crypto: IdentityCrypto,
    private readonly delivery: IdentityDeliveryService,
    private readonly oauthProvider: OAuthProviderService,
    private readonly config: ConfigService,
  ) {}

  async registerEmail(email: string, locale = 'en'): Promise<{ accepted: true }> {
    const normalized = email.toLowerCase().trim()
    const hash = this.crypto.hashIdentifier(normalized)
    const existing = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash },
    })
    if (existing && existing.state === 'verified') {
      throw new ConflictException({
        code: IDENTITY_ERROR_CODES.EMAIL_TAKEN,
        message: 'An account with this email already exists.',
      })
    }

    const userId = existing?.userId ?? randomUUID()
    if (!existing) {
      await this.users.save(
        this.users.create({ id: userId, status: 'active', locale }),
      )
      const { ciphertext, keyVersion } = this.crypto.encrypt(normalized)
      await this.loginIdentities.save(
        this.loginIdentities.create({
          id: randomUUID(),
          userId,
          kind: 'email',
          state: 'pending',
          identifierHash: hash,
          identifierCiphertext: ciphertext,
          encryptionKeyVersion: keyVersion,
        }),
      )
    }
    const token = await this.issueOneTimeToken(userId, 'email_verification')
    await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'email_verification', token })
    return { accepted: true }
  }

  async verifyEmail(token: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult & { verified: true }> {
    const userId = await this.consumeOneTimeToken(token, 'email_verification', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    const identity = await this.loginIdentities.findOne({
      where: { kind: 'email', userId },
    })
    if (!identity) {
      throw new NotFoundException({
        code: IDENTITY_ERROR_CODES.IDENTITY_NOT_FOUND,
        message: 'Email identity not found.',
      })
    }
    if (identity.state !== 'verified') {
      identity.state = 'verified'
      identity.verifiedAt = new Date()
      await this.loginIdentities.save(identity)
    }
    return { ...(await this.issueSession(userId, device)), verified: true }
  }

  async createWalletChallenge(address: string): Promise<{ address: string; nonce: string }> {
    const normalized = address.toLowerCase()
    return { address: normalized, nonce: this.crypto.issueWalletChallenge(normalized) }
  }

  async verifyWalletSignature(
    address: string,
    signature: string,
    nonce: string,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const normalized = address.toLowerCase()
    this.crypto.consumeWalletChallenge(normalized, nonce)
    if (!this.crypto.verifyWalletSignature(normalized, nonce, signature)) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.INVALID_SIGNATURE,
        message: 'Wallet signature does not recover to the claimed address.',
      })
    }
    return this.upsertExternalWallet(normalized, device)
  }

  private async upsertExternalWallet(
    address: string,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const hash = this.crypto.hashIdentifier(address)
    const identity = await this.loginIdentities.findOne({
      where: { kind: 'external_wallet', identifierHash: hash },
    })
    if (identity) {
      if (identity.state !== 'verified') {
        identity.state = 'verified'
        identity.verifiedAt = new Date()
        await this.loginIdentities.save(identity)
      }
      return this.issueSession(identity.userId, device)
    }
    const userId = randomUUID()
    await this.users.save(this.users.create({ id: userId, status: 'active', locale: 'en' }))
    const { ciphertext, keyVersion } = this.crypto.encrypt(address)
    await this.loginIdentities.save(
      this.loginIdentities.create({
        id: randomUUID(),
        userId,
        kind: 'external_wallet',
        state: 'verified',
        identifierHash: hash,
        identifierCiphertext: ciphertext,
        encryptionKeyVersion: keyVersion,
        verifiedAt: new Date(),
      }),
    )
    return this.issueSession(userId, device)
  }

  private async upsertVerifiedOAuthSubject(
    provider: 'google' | 'x',
    subject: string,
    meta?: { displayName?: string; locale?: string; device?: { fingerprint?: string; name?: string } },
  ): Promise<AuthResult> {
    const key = `${provider}:${subject}`
    const hash = this.crypto.hashIdentifier(key)
    const identity = await this.loginIdentities.findOne({
      where: { kind: provider, identifierHash: hash },
    })
    if (identity) {
      return this.issueSession(identity.userId, meta?.device)
    }
    const userId = randomUUID()
    await this.users.save(
      this.users.create({ id: userId, status: 'active', locale: meta?.locale ?? 'en' }),
    )
    const { ciphertext, keyVersion } = this.crypto.encrypt(key)
    await this.loginIdentities.save(
      this.loginIdentities.create({
        id: randomUUID(),
        userId,
        kind: provider,
        state: 'verified',
        identifierHash: hash,
        identifierCiphertext: ciphertext,
        encryptionKeyVersion: keyVersion,
        verifiedAt: new Date(),
      }),
    )
    return this.issueSession(userId, meta?.device)
  }

  beginOAuth(provider: OAuthProviderName) {
    return this.oauthProvider.begin(provider)
  }

  async exchangeOAuthCode(
    provider: OAuthProviderName,
    code: string,
    state: string,
    redirectUri?: string,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const verified = await this.oauthProvider.exchange(provider, code, state, redirectUri)
    return this.upsertVerifiedOAuthSubject(provider, verified.subject, {
      displayName: verified.displayName,
      locale: verified.locale,
      device,
    })
  }

  async recover(email: string): Promise<{ accepted: true }> {
    const normalized = email.toLowerCase().trim()
    const hash = this.crypto.hashIdentifier(normalized)
    const identity = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash, state: 'verified' },
    })
    if (!identity) {
      return { accepted: true }
    }
    const token = await this.issueOneTimeToken(identity.userId, 'account_recovery')
    await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'account_recovery', token })
    return { accepted: true }
  }

  async confirmRecovery(token: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult> {
    const userId = await this.consumeOneTimeToken(token, 'account_recovery', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    return this.issueSession(userId, device)
  }

  async revokeSession(sessionId: string, token: string): Promise<{ revoked: true }> {
    const tokenHash = this.crypto.hashToken(token)
    const session = await this.sessions.findOne({
      where: { id: sessionId, tokenHash, state: 'active' },
    })
    if (!session) {
      throw new NotFoundException({
        code: IDENTITY_ERROR_CODES.SESSION_NOT_FOUND,
        message: 'Active session not found.',
      })
    }
    session.state = 'revoked'
    session.revokedAt = new Date()
    session.revokeReason = 'user_logout'
    await this.sessions.save(session)
    return { revoked: true }
  }

  // ─── Demo Auth ───

  /**
   * Demo login: bypass email verification, create or restore user session.
   * Fixed demo user: demo@user.rwa.lat → userId 22222222-2222-2222-2222-222222222222
   */
  async demoLogin(
    email: string,
    type: 'user' | 'admin' = 'user',
  ): Promise<AuthResult> {
    this.assertDemoAdapter()
    const normalized = email.toLowerCase().trim()

    if (type === 'admin' || normalized === 'demo@admin.rwa.lat') {
      throw new BadRequestException({
        code: 'ADMIN_LOGIN_NOT_SUPPORTED',
        message: 'Demo admin login requires a separate admin auth flow.',
      })
    }

    const hash = this.crypto.hashIdentifier(normalized)
    let identity = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash },
    })

    // Registered Demo accounts must keep their own user ID after sign-out.
    // The fixed seeded account remains available only for the documented
    // demo@user.rwa.lat quick-preview path.
    const userId = identity?.userId
      ?? (normalized === 'demo@user.rwa.lat'
        ? '22222222-2222-2222-2222-222222222222'
        : randomUUID())

    let user = await this.users.findOne({ where: { id: userId } })
    if (!user) {
      user = await this.users.save(
        this.users.create({ id: userId, status: 'active', locale: 'en' }),
      )
    }

    if (!identity) {
      const { ciphertext, keyVersion } = this.crypto.encrypt(normalized)
      identity = await this.loginIdentities.save(
        this.loginIdentities.create({
          id: randomUUID(),
          userId,
          kind: 'email',
          state: 'verified',
          identifierHash: hash,
          identifierCiphertext: ciphertext,
          encryptionKeyVersion: keyVersion,
          verifiedAt: new Date(),
        }),
      )
    } else if (identity.state !== 'verified') {
      identity.state = 'verified'
      identity.verifiedAt = new Date()
      await this.loginIdentities.save(identity)
    }

    return this.issueSession(userId, { name: 'demo-device' })
  }

  /**
   * Demo register: create a new user with auto-verified email.
   * The explicit demo adapter auto-verifies the identity. No verification token
   * is returned from this API path.
   */
  async demoRegister(
    email: string,
    locale = 'en',
  ): Promise<{ userId: string; verified: true }> {
    this.assertDemoAdapter()
    const normalized = email.toLowerCase().trim()
    const hash = this.crypto.hashIdentifier(normalized)

    // Check if already registered
    const existing = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash },
    })
    if (existing && existing.state === 'verified') {
      // Already registered — return existing userId
      return { userId: existing.userId, verified: true }
    }

    const userId = existing ? existing.userId : randomUUID()

    // Create user if new
    if (!existing) {
      await this.users.save(
        this.users.create({ id: userId, status: 'active', locale }),
      )
    }

    // Create or update identity as verified
    if (!existing) {
      const { ciphertext, keyVersion } = this.crypto.encrypt(normalized)
      await this.loginIdentities.save(
        this.loginIdentities.create({
          id: randomUUID(),
          userId,
          kind: 'email',
          state: 'verified',
          identifierHash: hash,
          identifierCiphertext: ciphertext,
          encryptionKeyVersion: keyVersion,
          verifiedAt: new Date(),
        }),
      )
    } else {
      existing.state = 'verified'
      existing.verifiedAt = new Date()
      await this.loginIdentities.save(existing)
    }

    return { userId, verified: true }
  }

  private async issueSession(
    userId: string,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const fingerprint = device?.fingerprint ?? 'anonymous'
    const fingerprintHash = this.crypto.hashIdentifier(`${userId}:${fingerprint}`)
    let deviceRow = await this.devices.findOne({
      where: { userId, fingerprintHash },
    })
    if (!deviceRow) {
      deviceRow = await this.devices.save(
        this.devices.create({
          id: randomUUID(),
          userId,
          fingerprintHash,
          trustState: 'untrusted',
          displayName: device?.name ?? null,
        }),
      )
    }

    const token = this.crypto.generateSessionToken()
    const session = await this.sessions.save(
      this.sessions.create({
        id: randomUUID(),
        userId,
        deviceId: deviceRow.id,
        tokenHash: this.crypto.hashToken(token),
        state: 'active',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      }),
    )
    return { userId, sessionId: session.id, token }
  }

  private async issueOneTimeToken(userId: string, purpose: IdentityOneTimeTokenPurpose): Promise<string> {
    await this.oneTimeTokens.update(
      { userId, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    )
    const token = this.crypto.generateSessionToken()
    await this.oneTimeTokens.save(this.oneTimeTokens.create({
      id: randomUUID(),
      userId,
      purpose,
      tokenHash: this.crypto.hashToken(token),
      expiresAt: new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS),
      consumedAt: null,
    }))
    return token
  }

  private async consumeOneTimeToken(
    token: string,
    purpose: IdentityOneTimeTokenPurpose,
    errorCode: string,
  ): Promise<string> {
    const record = await this.oneTimeTokens.findOne({
      where: { tokenHash: this.crypto.hashToken(token), purpose },
    })
    if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({ code: errorCode, message: 'Verification token is invalid or expired.' })
    }
    const consumed = await this.oneTimeTokens.update(
      { id: record.id, consumedAt: IsNull() },
      { consumedAt: new Date() },
    )
    if (consumed.affected !== 1) {
      throw new UnauthorizedException({ code: errorCode, message: 'Verification token is invalid or expired.' })
    }
    return record.userId
  }

  private assertDemoAdapter(): void {
    if (this.config.get<string>('AUTH_ADAPTER') !== 'demo') {
      throw new ServiceUnavailableException({
        code: 'DEMO_AUTH_DISABLED',
        message: 'Demo authentication is disabled in this environment.',
      })
    }
  }
}
