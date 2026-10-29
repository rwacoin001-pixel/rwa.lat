import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { walletSignInMessage } from './wallet-sign-in-message'
import { maskEmail } from '../data-governance/data-masking.util'
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { IDENTITY_ERROR_CODES } from './identity.errors'
import { IdentityCrypto } from './identity-crypto.service'
import { Device } from './device.entity'
import { LoginIdentity } from './login-identity.entity'
import { PasskeyCredential } from '../security/passkey-credential.entity'
import { IdentityPasskeyChallenge } from './identity-passkey-challenge.entity'
import { Session } from './session.entity'
import { User } from './user.entity'
import { IdentityOneTimeToken, type IdentityOneTimeTokenPurpose } from './identity-one-time-token.entity'
import { IdentityDeliveryService } from './identity-delivery.service'
import { OAuthProviderService, type OAuthProviderName } from './oauth-provider.service'
import { persistProviderEmail, verifiedGoogleEmail } from './google-email'
import { AuthFlowService, type AuthProof, type AuthDevice } from './auth-flow.service'
import { assertReauthentication } from '../security/reauthentication'
import { ReferralBindingService } from '../referral/referral-binding.service'
import {
  validateRegistrationConsents,
  loadRegistrationConsents,
  type RegistrationConsentAcceptance,
} from './consent-policy'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const ONE_TIME_TOKEN_TTL_MS = 60 * 60 * 1000
// The browser hands the code straight to the app, so it only has to outlive one app switch.
const APP_HANDOFF_TTL_MS = 2 * 60 * 1000
const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000

export interface AuthResult {
  userId: string
  sessionId: string
  token: string
  /** True when an account email or the server-verified Google email is available. */
  emailVerified: boolean
}

/** Session-level auth state view (S1: GET /auth/session). */
export interface SessionView {
  userId: string
  sessionId: string
  emailVerified: boolean
  authAdapter: string
  expiresAt: string
  /** Masked sign-in label for account chrome, e.g. a***@example.com or 0x12…abcd. */
  accountLabel: string | null
}

@Injectable()
export class IdentityService {
  private readonly authFlows: AuthFlowService
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(LoginIdentity) private readonly loginIdentities: Repository<LoginIdentity>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(IdentityOneTimeToken) private readonly oneTimeTokens: Repository<IdentityOneTimeToken>,
    @InjectRepository(PasskeyCredential) private readonly passkeys: Repository<PasskeyCredential>,
    @InjectRepository(IdentityPasskeyChallenge) private readonly passkeyChallenges: Repository<IdentityPasskeyChallenge>,
    private readonly crypto: IdentityCrypto,
    private readonly delivery: IdentityDeliveryService,
    private readonly oauthProvider: OAuthProviderService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @Optional() private readonly referral?: ReferralBindingService,
  ) { this.authFlows = new AuthFlowService(dataSource, crypto, delivery) }

  async loginPassword(email: string, password: string, device?: AuthDevice) {
    const verified = await this.authFlows.checkPassword(email, password)
    await this.authFlows.authorize(verified.userId, 'password', device, verified.version)
    throw new UnauthorizedException({ code: 'AUTH_FLOW_REQUIRED', message: 'Second factor is required.' })
  }

  /** Minimal read-only account state; no login identities or credentials leave this service. */
  async accountStatus(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Account not found')
    return { status: user.status }
  }

  async managePassword(rawToken: string, device?: AuthDevice, email?: string, reauthentication?: string) {
    const session = await this.getSessionViewByToken(rawToken)
    if (reauthentication) assertReauthentication(this.crypto, session, reauthentication)
    return this.authFlows.beginPasswordManagement(session.userId, device, email, Boolean(reauthentication))
  }

  async changeEmail(rawToken: string, email: string, reauthentication: string) {
    const session = await this.getSessionViewByToken(rawToken)
    assertReauthentication(this.crypto, session, reauthentication)
    return this.authFlows.beginEmailChange(session.userId, email)
  }

  resendAuthFlow(token: string) { return this.authFlows.resend(token) }

  /** POST /v1/auth/flow/email — supply the address for an email-binding flow and send its code. */
  bindAuthFlowEmail(continuationToken: string, email: string) {
    return this.authFlows.bindEmail(continuationToken, email)
  }

  private assertBindingUser(actualUserId: string, expectedUserId?: string) {
    if (expectedUserId && actualUserId !== expectedUserId) throw new UnauthorizedException({ code: 'AUTH_ACCOUNT_CHANGED', message: 'Account changed. Return to the current account.' })
  }

  async startEmailBinding(rawToken: string, expectedUserId?: string) {
    const session = await this.getSessionViewByToken(rawToken)
    this.assertBindingUser(session.userId, expectedUserId)
    if (session.emailVerified) return { userId: session.userId, emailVerified: true as const }
    return { ...await this.authFlows.startEmailBinding(session.userId), userId: session.userId }
  }

  async sendEmailBinding(rawToken: string, continuationToken: string, email: string, expectedUserId?: string) {
    const session = await this.getSessionViewByToken(rawToken)
    this.assertBindingUser(session.userId, expectedUserId)
    return this.authFlows.bindEmail(continuationToken, email, { userId: session.userId, purpose: 'email_bind' })
  }

  async resendEmailBinding(rawToken: string, continuationToken: string, expectedUserId?: string) {
    const session = await this.getSessionViewByToken(rawToken)
    this.assertBindingUser(session.userId, expectedUserId)
    return this.authFlows.resend(continuationToken, { userId: session.userId, purpose: 'email_bind' })
  }

  async completeEmailBinding(rawToken: string, continuationToken: string, code: string, expectedUserId?: string) {
    const session = await this.getSessionViewByToken(rawToken)
    this.assertBindingUser(session.userId, expectedUserId)
    return this.authFlows.complete({ continuationToken, code }, async () => ({ userId: session.userId, emailVerified: true as const }),
      { userId: session.userId, purpose: 'email_bind' })
  }

  async completeAuthFlow(input: Parameters<AuthFlowService['complete']>[0]) {
    return this.authFlows.complete(input, async (payload, manager) => {
      if (payload.oauth) {
        const consents = validateRegistrationConsents(input.consents, await loadRegistrationConsents(manager, this.config, true))
        const { provider, subject, locale, verifiedEmail, referralAttribution } = payload.oauth
        const key = `${provider}:${subject}`
        const hash = this.crypto.hashIdentifier(key)
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`oauth:${hash.toString('hex')}`])
        const identities = manager.getRepository(LoginIdentity)
        const existing = await identities.findOne({ where: { kind: provider, identifierHash: hash } })
        if (existing) throw new ConflictException({ code: 'AUTH_RESTART_LOGIN', message: 'Account already exists. Sign in again.' })
        // An email account may have been created while the consent screen was open.
        // Restart through normal login so its existing second-factor policy still runs.
        if (await this.googleEmailAccount(manager, provider, verifiedEmail)) {
          throw new ConflictException({ code: 'AUTH_RESTART_LOGIN', message: 'An account with this email already exists. Sign in again.' })
        }
        const userId = randomUUID()
        await manager.getRepository(User).save({ id: userId, status: 'active', locale: locale ?? 'en' })
        await this.referral?.bindNewUser(manager,userId,referralAttribution)
        const encrypted = this.crypto.encrypt(key)
        const identity = await identities.save({ id: randomUUID(), userId, kind: provider, state: 'verified', identifierHash: hash,
          identifierCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion, verifiedAt: new Date() })
        await persistProviderEmail(manager, this.crypto, identity, verifiedEmail)
        await this.persistRegistrationConsents(manager, userId, consents, new Date(), randomUUID())
        return this.createSession(userId, payload.device, manager)
      }
      return this.createSession(payload.userId!, payload.device, manager)
    })
  }

  async consentRequirements() { return { required: await loadRegistrationConsents(this.dataSource, this.config) } }

  async registerEmail(email: string, locale = 'en', consentInput?: unknown): Promise<{ accepted: true }> {
    const userId = await this.prepareEmailRegistration(email, locale, consentInput)
    const normalized = email.toLowerCase().trim()
    const issued = await this.issueOneTimeToken(userId, 'email_verification')
    await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'email_verification', ...issued, locale })
    return { accepted: true }
  }

  /** Internal registration shared by email links and mobile verification codes. */
  async prepareEmailRegistration(email: string, locale = 'en', consentInput?: unknown, transactionManager?: EntityManager): Promise<string> {
    const normalized = email.toLowerCase().trim()
    const hash = this.crypto.hashIdentifier(normalized)
    const prepare = async (manager: EntityManager) => {
      const consents = validateRegistrationConsents(consentInput, await loadRegistrationConsents(manager, this.config, true))
      const loginIdentities = manager.getRepository(LoginIdentity)
      const users = manager.getRepository(User)
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`account-email:${hash.toString('hex')}`])
      const existing = await loginIdentities.findOne({
        where: { kind: 'email', identifierHash: hash },
      })
      if (existing?.state === 'verified') {
        throw new ConflictException({
          code: IDENTITY_ERROR_CODES.EMAIL_TAKEN,
          message: 'An account with this email already exists.',
        })
      }
      if (existing?.state === 'revoked' || existing?.revokedAt) {
        throw new UnauthorizedException({ code: 'IDENTITY_NOT_FOUND', message: 'This sign-in method is unavailable.' })
      }

      const userId = existing?.userId ?? randomUUID()
      if (!existing) {
        await users.save(users.create({ id: userId, status: 'active', locale }))
        await this.referral?.bindNewUser(manager,userId)
        const { ciphertext, keyVersion } = this.crypto.encrypt(normalized)
        await loginIdentities.save(loginIdentities.create({
          id: randomUUID(),
          userId,
          kind: 'email',
          state: 'pending',
          identifierHash: hash,
          identifierCiphertext: ciphertext,
          encryptionKeyVersion: keyVersion,
        }))
      }

      await this.authFlows.requireRegistrationPassword(manager, userId)
      // Retries for pending signups add only a consent version not yet on file.
      const acceptedRows = existing
        ? await manager.query(
          'SELECT document_type, document_version FROM app.consents WHERE user_id = $1 AND granted = true',
          [userId],
        ) as Array<{ document_type: string; document_version: string }>
        : []
      const alreadyAccepted = new Set(acceptedRows.map((row) => `${row.document_type}:${row.document_version}`))
      const missingConsents = consents.filter((consent) => !alreadyAccepted.has(`${consent.documentType}:${consent.version}`))
      if (missingConsents.length) {
        await this.persistRegistrationConsents(manager, userId, missingConsents, new Date(), randomUUID())
      }
      return userId
    }
    return transactionManager ? prepare(transactionManager) : this.dataSource.transaction(prepare)
  }

  /** Called only after the code service has atomically consumed a valid challenge. */
  async completeEmailCode(userId: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { id: userId } })
    const identity = await this.loginIdentities.findOne({ where: { userId, kind: 'email', revokedAt: IsNull() } })
    if (!user || user.status === 'closed' || user.status === 'suspended' || !identity || identity.state === 'revoked') {
      throw new UnauthorizedException({ code: 'AUTH_EMAIL_CODE_INVALID', message: 'The verification code is invalid or expired.' })
    }
    if (identity.state !== 'verified') {
      identity.state = 'verified'
      identity.verifiedAt = new Date()
      await this.loginIdentities.save(identity)
    }
    return this.issueSession(userId, device)
  }

  async verifyEmail(token: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult & { verified: true }> {
    const userId = await this.consumeOneTimeToken(token, 'email_verification', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    const identity = await this.loginIdentities.findOne({
      where: { kind: 'email', userId },
    })
    if (!identity || identity.state === 'revoked' || identity.revokedAt) {
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

  async createWalletChallenge(address: string, chainId = 1): Promise<{ address: string; nonce: string; registrationRequired: boolean }> {
    const normalized = address.toLowerCase()
    const identifierHash = this.crypto.hashIdentifier(normalized)
    const existingIdentity = await this.loginIdentities.findOne({
      where: { kind: 'external_wallet', identifierHash },
    })
    const origin = this.config.get<string>('PUBLIC_APP_URL')
    if (!origin) throw new ServiceUnavailableException({ code: 'WALLET_ORIGIN_UNAVAILABLE', message: 'Wallet sign-in is not configured.' })
    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000)
    const nonce = walletSignInMessage(origin, normalized, chainId, randomBytes(24).toString('hex'), issuedAt, expiresAt)
    await this.dataSource.query('INSERT INTO app.wallet_sign_in_challenges (message_hash, address, expires_at) VALUES ($1, $2, $3)', [this.crypto.hashToken(nonce), normalized, expiresAt])
    // nonce retains its wire field name; its value is now the full domain-bound sign-in message.
    return {
      address: normalized,
      nonce,
      registrationRequired: !existingIdentity,
    }
  }

  async verifyWalletSignature(
    address: string,
    signature: string,
    nonce: string,
    device?: { fingerprint?: string; name?: string },
    consentInput?: unknown,
  ): Promise<AuthResult> {
    const normalized = address.toLowerCase()
    const [challenge] = await this.dataSource.query('SELECT address FROM app.wallet_sign_in_challenges WHERE message_hash = $1 AND address = $2 AND consumed_at IS NULL AND expires_at > now()', [this.crypto.hashToken(nonce), normalized])
    if (!challenge) throw new UnauthorizedException({ code: IDENTITY_ERROR_CODES.NONCE_MISMATCH, message: 'Wallet challenge is invalid or expired.' })
    if (!this.crypto.verifyWalletSignature(normalized, nonce, signature)) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.INVALID_SIGNATURE,
        message: 'Wallet signature does not recover to the claimed address.',
      })
    }
    return this.upsertExternalWallet(normalized, device, consentInput, this.crypto.hashToken(nonce))
  }

  private async upsertExternalWallet(
    address: string,
    device?: { fingerprint?: string; name?: string },
    consentInput?: unknown,
    challengeHash?: Buffer,
  ): Promise<AuthResult> {
    const hash = this.crypto.hashIdentifier(address)
    const userId = await this.dataSource.transaction(async (manager) => {
      const consumed = await manager.query('UPDATE app.wallet_sign_in_challenges SET consumed_at = now() WHERE message_hash = $1 AND address = $2 AND consumed_at IS NULL AND expires_at > now() RETURNING address', [challengeHash, address])
      if (!consumed.length) throw new UnauthorizedException({ code: IDENTITY_ERROR_CODES.NONCE_MISMATCH, message: 'Wallet challenge has already been used or expired.' })
      const loginIdentities = manager.getRepository(LoginIdentity)
      const identity = await loginIdentities.findOne({ where: { kind: 'external_wallet', identifierHash: hash } })
      if (identity) {
        if (identity.state === 'revoked' || identity.revokedAt) throw new UnauthorizedException({ code: 'IDENTITY_NOT_FOUND', message: 'This sign-in method is unavailable.' })
        if (identity.state !== 'verified') {
          identity.state = 'verified'
          identity.verifiedAt = new Date()
          await loginIdentities.save(identity)
        }
        return identity.userId
      }

      const consents = validateRegistrationConsents(consentInput, await loadRegistrationConsents(manager, this.config, true))
      const userId = randomUUID()
      const users = manager.getRepository(User)
      await users.save(users.create({ id: userId, status: 'active', locale: 'en' }))
      await this.referral?.bindNewUser(manager,userId)
      const { ciphertext, keyVersion } = this.crypto.encrypt(address)
      await loginIdentities.save(loginIdentities.create({
        id: randomUUID(),
        userId,
        kind: 'external_wallet',
        state: 'verified',
        identifierHash: hash,
        identifierCiphertext: ciphertext,
        encryptionKeyVersion: keyVersion,
        verifiedAt: new Date(),
      }))
      await this.persistRegistrationConsents(manager, userId, consents, new Date(), randomUUID())
      return userId
    })

    // Sign-in never waits on an email; money-moving actions ask for one (requireVerifiedEmail).
    return this.issueSession(userId, device)
  }

  private async upsertVerifiedOAuthSubject(
    provider: 'google' | 'github' | 'x',
    subject: string,
    meta: {
      displayName?: string
      locale?: string
      verifiedEmail?: string
      device?: { fingerprint?: string; name?: string }
      intent: 'login' | 'register'
      registrationConsents?: RegistrationConsentAcceptance[]
      consentedAt?: Date
      referralAttribution?: string
    },
  ): Promise<AuthResult> {
    const key = `${provider}:${subject}`
    const hash = this.crypto.hashIdentifier(key)
    const userId = await this.dataSource.transaction(async (manager) => {
      const loginIdentities = manager.getRepository(LoginIdentity)
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`oauth:${hash.toString('hex')}`])
      const identity = await loginIdentities.findOne({ where: { kind: provider, identifierHash: hash } })
      if (identity) {
        if (identity.state !== 'verified' || identity.revokedAt) throw new UnauthorizedException({ code: 'IDENTITY_NOT_FOUND', message: 'This sign-in method is unavailable.' })
        await persistProviderEmail(manager, this.crypto, identity, meta.verifiedEmail)
        return identity.userId
      }

      // Google proof attaches a new sign-in method to an existing verified Gmail
      // account. It never relocates an already-linked Google identity or its assets.
      const emailAccount = await this.googleEmailAccount(manager, provider, meta.verifiedEmail)
      if (emailAccount) {
        const encrypted = this.crypto.encrypt(key)
        const linked = await loginIdentities.save(loginIdentities.create({
          id: randomUUID(), userId: emailAccount, kind: provider, state: 'verified',
          identifierHash: hash, identifierCiphertext: encrypted.ciphertext,
          encryptionKeyVersion: encrypted.keyVersion, verifiedAt: new Date(),
        }))
        await persistProviderEmail(manager, this.crypto, linked, meta.verifiedEmail)
        return emailAccount
      }

      if (meta.intent !== 'register') {
        throw new ConflictException({
          code: IDENTITY_ERROR_CODES.REGISTRATION_REQUIRED,
          message: 'No account is linked to this provider. Create an account and accept the current terms first.',
          provider,
        })
      }

      const consents = validateRegistrationConsents(meta.registrationConsents, await loadRegistrationConsents(manager, this.config, true))
      if (!(meta.consentedAt instanceof Date) || !Number.isFinite(meta.consentedAt.getTime())) {
        throw new BadRequestException({
          code: IDENTITY_ERROR_CODES.CONSENT_REQUIRED,
          message: 'The registration consent snapshot is missing or invalid.',
        })
      }

      const userId = randomUUID()
      const users = manager.getRepository(User)
      await users.save(users.create({ id: userId, status: 'active', locale: meta.locale ?? 'en' }))
      await this.referral?.bindNewUser(manager,userId,meta.referralAttribution)
      const { ciphertext, keyVersion } = this.crypto.encrypt(key)
      const savedIdentity = await loginIdentities.save(loginIdentities.create({
        id: randomUUID(),
        userId,
        kind: provider,
        state: 'verified',
        identifierHash: hash,
        identifierCiphertext: ciphertext,
        encryptionKeyVersion: keyVersion,
        verifiedAt: new Date(),
      }))
      await persistProviderEmail(manager, this.crypto, savedIdentity, meta.verifiedEmail)
      await this.persistRegistrationConsents(manager, userId, consents, meta.consentedAt, randomUUID())
      return userId
    })
    return this.issueSession(userId, meta.device)
  }

  /** Only server-verified Gmail ownership can automatically link existing accounts. */
  private async googleEmailAccount(manager: EntityManager, provider: OAuthProviderName, verifiedEmail?: string): Promise<string | null> {
    if (provider !== 'google' || !verifiedEmail) return null
    const normalized = verifiedEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
    const hash = this.crypto.hashIdentifier(normalized)
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`account-email:${hash.toString('hex')}`])
    const identities = manager.getRepository(LoginIdentity)
    const email = await identities.findOne({ where: { kind: 'email', identifierHash: hash } })
    if (!email) return null
    if (email.state === 'revoked' || email.revokedAt) {
      throw new UnauthorizedException({ code: 'IDENTITY_NOT_FOUND', message: 'This sign-in method is unavailable.' })
    }
    // A third-party address may have changed owners since Google verified it.
    // A pending email signup may contain credentials set by somebody else.
    if (!normalized.endsWith('@gmail.com') || email.state !== 'verified') {
      throw new ConflictException({ code: 'AUTH_ACCOUNT_LINK_REQUIRED', message: 'Sign in to the existing email account to link this Google account.' })
    }
    const owner = await manager.getRepository(User).findOne({ where: { id: email.userId } })
    if (!owner || owner.status === 'closed' || owner.status === 'suspended') {
      throw new UnauthorizedException({ code: 'IDENTITY_NOT_FOUND', message: 'This sign-in method is unavailable.' })
    }
    if (await identities.findOne({ where: { userId: email.userId, kind: 'google' } })) {
      throw new ConflictException({ code: 'AUTH_ACCOUNT_LINK_REQUIRED', message: 'This email account already has a Google sign-in method.' })
    }
    return email.userId
  }

  async beginOAuth(provider: OAuthProviderName, intent: 'login' | 'register' = 'login', consentInput?: unknown) {
    const consents = intent === 'register' ? validateRegistrationConsents(consentInput, await loadRegistrationConsents(this.dataSource, this.config)) : undefined
    const flow=await this.oauthProvider.begin(provider, intent, consents)
    const url=new URL(flow.authorizationUrl)
    const state=url.searchParams.get(provider==='x' ? 'oauth_token' : 'state')
    if (state) await this.referral?.rememberOAuth(this.crypto.hashToken(state))
    return flow
  }

  async exchangeOAuthCode(
    provider: OAuthProviderName,
    code: string,
    state: string,
    redirectUri?: string,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const verified = await this.oauthProvider.exchange(provider, code, state, redirectUri)
    const referralAttribution=await this.referral?.oauthAttribution(this.crypto.hashToken(state))
    try {
      return await this.upsertVerifiedOAuthSubject(provider, verified.subject, {
        displayName: verified.displayName,
        locale: verified.locale,
        verifiedEmail: verified.verifiedEmail,
        device,
        intent: verified.intent,
        referralAttribution,
        registrationConsents: verified.registrationConsents,
        consentedAt: verified.consentedAt,
      })
    } catch (error) {
      if (verified.intent === 'login' && error instanceof ConflictException
        && (error.getResponse() as { code?: string }).code === IDENTITY_ERROR_CODES.REGISTRATION_REQUIRED) {
        return this.authFlows.beginOAuth({
          provider,
          subject: verified.subject,
          locale: verified.locale,
          verifiedEmail: verified.verifiedEmail,
          referralAttribution,
        }, device)
      }
      throw error
    }
  }

  private async persistRegistrationConsents(
    manager: EntityManager,
    userId: string,
    consents: RegistrationConsentAcceptance[],
    recordedAt: Date,
    requestId: string,
  ): Promise<void> {
    for (const consent of consents) {
      await manager.query(
        `INSERT INTO app.consents
          (user_id, document_type, document_version, granted, recorded_at, request_id)
         VALUES ($1, $2, $3, true, $4, $5)`,
        [userId, consent.documentType, consent.version, recordedAt, requestId],
      )
    }
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
    const issued = await this.issueOneTimeToken(identity.userId, 'account_recovery')
    const user = await this.users.findOne({ where: { id: identity.userId } })
    await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'account_recovery', ...issued, locale: user?.locale })
    return { accepted: true }
  }

  /**
   * Email magic-link login: for a registered address, send a single-use sign-in link.
   * Anti-enumeration: unregistered addresses receive the same `{ accepted: true }` response.
   * Pending (unverified) addresses receive a fresh verification link instead.
   */
  async requestEmailLogin(email: string): Promise<{ accepted: true }> {
    const normalized = email.toLowerCase().trim()
    const hash = this.crypto.hashIdentifier(normalized)
    const identity = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash },
    })
    if (!identity || identity.state === 'revoked' || identity.revokedAt) {
      return { accepted: true }
    }
    const user = await this.users.findOne({ where: { id: identity.userId } })
    if (identity.state === 'verified') {
      const issued = await this.issueOneTimeToken(identity.userId, 'email_login')
      await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'email_login', ...issued, locale: user?.locale })
    } else {
      const issued = await this.issueOneTimeToken(identity.userId, 'email_verification')
      await this.delivery.sendOneTimeLink({ email: normalized, purpose: 'email_verification', ...issued, locale: user?.locale })
    }
    return { accepted: true }
  }

  async confirmEmailLogin(token: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult> {
    const userId = await this.consumeOneTimeToken(token, 'email_login', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    return this.issueSession(userId, device)
  }

  /**
   * Passkey login — step 1: issue a WebAuthn authentication challenge.
   * With `email`, the prompt is scoped to that account's registered passkeys;
   * without it, discoverable credentials (usernameless) are offered.
   */
  async beginPasskeyLogin(email?: string): Promise<{ challengeId: string; options: Record<string, unknown> }> {
    const rpId = this.config.get<string>('PASSKEY_RP_ID') ?? 'localhost'
    let allowCredentials: { id: string; transports: never }[] | undefined
    let scopedUserId: string | null = null
    if (email) {
      const normalized = email.toLowerCase().trim()
      const hash = this.crypto.hashIdentifier(normalized)
      const identity = await this.loginIdentities.findOne({
        where: { kind: 'email', identifierHash: hash, state: 'verified', revokedAt: IsNull() },
      })
      if (!identity) {
        throw new UnauthorizedException({
          code: IDENTITY_ERROR_CODES.IDENTITY_NOT_FOUND,
          message: 'No passkey is registered for this account.',
        })
      }
      const credentials = await this.passkeys.find({ where: { userId: identity.userId, state: 'active' } })
      if (!credentials.length) {
        throw new UnauthorizedException({
          code: IDENTITY_ERROR_CODES.IDENTITY_NOT_FOUND,
          message: 'No passkey is registered for this account.',
        })
      }
      allowCredentials = credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as never,
      }))
      scopedUserId = identity.userId
    }
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'required',
      allowCredentials: allowCredentials as never,
    })
    // Keep the account scope authenticated alongside the challenge; allowCredentials only constrains browser UI.
    const encrypted = this.crypto.encrypt(JSON.stringify({ version: 1, challenge: options.challenge, userId: scopedUserId }))
    const row = await this.passkeyChallenges.save(
      this.passkeyChallenges.create({
        id: randomUUID(),
        kind: 'passkey_login',
        challengeHash: this.crypto.hashToken(options.challenge),
        challengeCiphertext: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
        expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
        consumedAt: null,
      }),
    )
    return { challengeId: row.id, options: options as unknown as Record<string, unknown> }
  }

  /** Passkey login — step 2: verify the assertion and open a session. */
  async finishPasskeyLogin(
    challengeId: string,
    response: Record<string, unknown>,
    device?: { fingerprint?: string; name?: string },
  ): Promise<AuthResult> {
    const challenge = await this.passkeyChallenges.findOne({
      where: { id: challengeId, kind: 'passkey_login', consumedAt: IsNull() },
    })
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION,
        message: 'The passkey challenge is invalid or expired.',
      })
    }
    let binding: { version: number; challenge: string; userId: string | null }
    try {
      binding = JSON.parse(this.crypto.decrypt(challenge.challengeCiphertext, challenge.encryptionKeyVersion))
      if (!binding || binding.version !== 1 || typeof binding.challenge !== 'string' ||
          !(binding.userId === null || (typeof binding.userId === 'string' && binding.userId.length > 0))) throw new Error('Invalid binding')
    } catch {
      // Legacy challenges did not persist scope. Fail closed and require a fresh challenge.
      throw new UnauthorizedException({ code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION, message: 'The passkey challenge is invalid or expired.' })
    }
    const credentialId = typeof response.id === 'string' ? response.id : ''
    const passkey = await this.passkeys.findOne({ where: { credentialId, state: 'active' } })
    if (!passkey) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.IDENTITY_NOT_FOUND,
        message: 'This passkey is not registered.',
      })
    }
    if (binding.userId !== null && passkey.userId !== binding.userId) {
      throw new UnauthorizedException({ code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION, message: 'The passkey does not belong to this account.' })
    }
    const rpId = this.config.get<string>('PASSKEY_RP_ID') ?? 'localhost'
    const origin = this.config.get<string>('PASSKEY_ORIGIN') ?? 'http://localhost:3030'
    const verification = await verifyAuthenticationResponse({
      response: response as unknown as AuthenticationResponseJSON,
      expectedChallenge: binding.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as never,
      },
    })
    if (!verification.verified) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION,
        message: 'The passkey assertion could not be verified.',
      })
    }
    const consumed = await this.passkeyChallenges.update(
      { id: challenge.id, consumedAt: IsNull() },
      { consumedAt: new Date() },
    )
    if (consumed.affected !== 1) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION,
        message: 'The passkey challenge is invalid or expired.',
      })
    }
    passkey.counter = verification.authenticationInfo.newCounter
    passkey.lastUsedAt = new Date()
    await this.passkeys.save(passkey)
    return this.issueSession(passkey.userId, device, 'passkey')
  }

  async confirmRecovery(token: string, device?: { fingerprint?: string; name?: string }): Promise<AuthResult> {
    const userId = await this.consumeOneTimeToken(token, 'account_recovery', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    return this.issueSession(userId, device, 'recovery')
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
   * Fixed demo user: demo@user.a-reit.com → userId 22222222-2222-2222-2222-222222222222
   */
  async demoLogin(
    email: string,
    type: 'user' | 'admin' = 'user',
  ): Promise<AuthResult> {
    this.assertDemoAdapter()
    const normalized = email.toLowerCase().trim()

    if (type === 'admin' || normalized === 'demo@admin.a-reit.com') {
      throw new BadRequestException({
        code: 'ADMIN_LOGIN_NOT_SUPPORTED',
        message: 'Demo admin login requires a separate admin auth flow.',
      })
    }

    const hash = this.crypto.hashIdentifier(normalized)
    let identity = await this.loginIdentities.findOne({
      where: { kind: 'email', identifierHash: hash },
    })

    // The historical seeded administrator remains excluded from user sessions,
    // regardless of the domain attached to its demo login identity.
    if (identity?.userId === '11111111-1111-1111-1111-111111111111') {
      throw new BadRequestException({
        code: 'ADMIN_LOGIN_NOT_SUPPORTED',
        message: 'Demo admin login requires a separate admin auth flow.',
      })
    }

    // Registered Demo accounts must keep their own user ID after sign-out.
    // The fixed seeded account remains available only for the documented
    // demo@user.a-reit.com quick-preview path.
    const userId = identity?.userId
      ?? (normalized === 'demo@user.a-reit.com'
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

  /** S1: session-level auth view for home lifecycle + GateSheet (token-based, no guard dependency). */
  async getSessionViewByToken(rawToken: string): Promise<SessionView> {
    const session = await this.sessions.findOne({
      where: { tokenHash: this.crypto.hashToken(rawToken), state: 'active' },
    })
    if (!session) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.SESSION_NOT_FOUND,
        message: 'Active session not found.',
      })
    }
    if (session.expiresAt <= new Date()) {
      session.state = 'expired'
      session.revokeReason = 'expired'
      await this.sessions.save(session)
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.SESSION_NOT_FOUND,
        message: 'The session has expired.',
      })
    }
    session.lastSeenAt = new Date()
    await this.sessions.save(session)
    const { emailIdentity, googleIdentity, googleEmail, emailVerified } = await this.emailStatus(session.userId)
    return {
      userId: session.userId,
      sessionId: session.id,
      emailVerified,
      authAdapter: this.config.get<string>('AUTH_ADAPTER') ?? 'production',
      expiresAt: session.expiresAt.toISOString(),
      accountLabel: await this.accountLabel(session.userId, emailIdentity, googleIdentity, googleEmail),
    }
  }

  private async emailStatus(userId: string, identities = this.loginIdentities) {
    const [emailIdentity, googleIdentity] = await Promise.all([
      identities.findOne({ where: { userId, kind: 'email' } }),
      identities.findOne({ where: { userId, kind: 'google', state: 'verified', revokedAt: IsNull() } }),
    ])
    const googleEmail = verifiedGoogleEmail(this.crypto, googleIdentity)
    const emailVerified = emailIdentity ? emailIdentity.state === 'verified' && !emailIdentity.revokedAt : Boolean(googleEmail)
    return { emailIdentity, googleIdentity, googleEmail, emailVerified }
  }

  /**
   * Gate for money-moving / legally binding actions (VerifiedEmailGuard). Sign-in stays open;
   * an account without a verified email (GitHub, wallet) gets AUTH_FLOW_REQUIRED step='email'
   * and binds one through POST /v1/auth/flow/email + /v1/auth/flow/complete before retrying.
   */
  async requireVerifiedEmail(userId: string): Promise<void> {
    if ((await this.emailStatus(userId)).emailVerified) return
    await this.authFlows.beginEmailBinding(userId)
  }

  /** Only masked identifiers or a provider name leave the service. */
  private async accountLabel(userId: string, emailIdentity: LoginIdentity | null, googleIdentity: LoginIdentity | null, googleEmail: string | null): Promise<string | null> {
    try {
      if (emailIdentity && !emailIdentity.revokedAt) return maskEmail(this.crypto.decrypt(emailIdentity.identifierCiphertext, emailIdentity.encryptionKeyVersion))
      if (googleEmail) return maskEmail(googleEmail)
      if (googleIdentity) return 'Google'
      const wallet = await this.loginIdentities.findOne({ where: { userId, kind: 'external_wallet', revokedAt: IsNull() } })
      if (!wallet) return null
      const address = this.crypto.decrypt(wallet.identifierCiphertext, wallet.encryptionKeyVersion)
      return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
    } catch {
      return null
    }
  }

  /**
   * Android app sign-in through the system browser, where Google, X and passkeys are allowed (Google forbids them
   * inside an app's WebView). The signed-in browser asks for a two-minute, single-use code bound to the app's PKCE
   * challenge; the app redeems it with the verifier that never left it, so a code caught by another app on the phone
   * is useless. The browser session already passed every sign-in step, so the app gets its own fresh session.
   */
  async startAppHandoff(rawToken: string, challenge: string): Promise<{ code: string; expiresAt: Date }> {
    const { userId } = await this.getSessionViewByToken(rawToken)
    await this.oneTimeTokens.update({ userId, purpose: 'app_handoff', consumedAt: IsNull() }, { consumedAt: new Date() })
    const code = this.crypto.generateSessionToken()
    const expiresAt = new Date(Date.now() + APP_HANDOFF_TTL_MS)
    await this.oneTimeTokens.save(this.oneTimeTokens.create({
      id: randomUUID(),
      userId,
      purpose: 'app_handoff',
      tokenHash: this.crypto.hashToken(`${code}.${challenge}`),
      expiresAt,
      consumedAt: null,
    }))
    return { code, expiresAt }
  }

  async redeemAppHandoff(code: string, verifier: string): Promise<AuthResult> {
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const userId = await this.consumeOneTimeToken(`${code}.${challenge}`, 'app_handoff', IDENTITY_ERROR_CODES.INVALID_VERIFICATION)
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user || user.status === 'closed' || user.status === 'suspended') {
      throw new UnauthorizedException({ code: IDENTITY_ERROR_CODES.INVALID_VERIFICATION, message: 'Verification token is invalid or expired.' })
    }
    return this.createSession(userId, { name: 'A-REIT Android' })
  }

  private async issueSession(
    userId: string,
    device?: { fingerprint?: string; name?: string },
    proof: AuthProof = 'primary',
  ): Promise<AuthResult> {
    await this.authFlows.authorize(userId, proof, device)
    return this.createSession(userId, device)
  }

  private async createSession(
    userId: string,
    device?: AuthDevice,
    manager?: EntityManager,
  ): Promise<AuthResult> {
    const devices = manager?.getRepository(Device) ?? this.devices
    const sessions = manager?.getRepository(Session) ?? this.sessions
    const identities = manager?.getRepository(LoginIdentity) ?? this.loginIdentities
    const fingerprint = device?.fingerprint ?? randomUUID()
    const fingerprintHash = this.crypto.hashIdentifier(`${userId}:${fingerprint}`)
    let deviceRow = await devices.findOne({
      where: { userId, fingerprintHash },
    })
    if (!deviceRow) {
      deviceRow = await devices.save(
        devices.create({
          id: randomUUID(),
          userId,
          fingerprintHash,
          trustState: 'untrusted',
          displayName: device?.name ?? null,
        }),
      )
    }

    const token = this.crypto.generateSessionToken()
    const session = await sessions.save(
      sessions.create({
        id: randomUUID(),
        userId,
        deviceId: deviceRow.id,
        tokenHash: this.crypto.hashToken(token),
        state: 'active',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      }),
    )
    const { emailVerified } = await this.emailStatus(userId, identities)
    return { userId, sessionId: session.id, token, emailVerified }
  }

  private async issueOneTimeToken(userId: string, purpose: IdentityOneTimeTokenPurpose): Promise<{ token: string; expiresAt: Date }> {
    await this.oneTimeTokens.update(
      { userId, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    )
    const token = this.crypto.generateSessionToken()
    const expiresAt = new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS)
    await this.oneTimeTokens.save(this.oneTimeTokens.create({
      id: randomUUID(),
      userId,
      purpose,
      tokenHash: this.crypto.hashToken(token),
      expiresAt,
      consumedAt: null,
    }))
    return { token, expiresAt }
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
