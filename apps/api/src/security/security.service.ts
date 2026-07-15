import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { randomBytes, randomUUID } from 'node:crypto'
import { IsNull, Like, Repository } from 'typeorm'
import { Device } from '../identity/device.entity'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { Session } from '../identity/session.entity'
import { AuditLog } from './audit-log.entity'
import { PasskeyCredential } from './passkey-credential.entity'
import { SecurityChallenge, type SecurityChallengeKind } from './security-challenge.entity'
import { SECURITY_ERROR_CODES } from './security.errors'
import { TotpFactor } from './totp-factor.entity'

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const STEP_UP_TTL_MS = 5 * 60 * 1000

export interface SecurityActor {
  userId: string
  sessionId: string
  deviceId: string | null
}

@Injectable()
export class SecurityService {
  private readonly rpId: string
  private readonly origin: string
  private readonly rpName: string

  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(TotpFactor) private readonly totpFactors: Repository<TotpFactor>,
    @InjectRepository(PasskeyCredential) private readonly passkeys: Repository<PasskeyCredential>,
    @InjectRepository(SecurityChallenge) private readonly challenges: Repository<SecurityChallenge>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    private readonly crypto: IdentityCrypto,
    config: ConfigService,
  ) {
    this.rpId = config.get<string>('PASSKEY_RP_ID') ?? 'localhost'
    this.origin = config.get<string>('PASSKEY_ORIGIN') ?? 'http://localhost:3001'
    this.rpName = config.get<string>('PASSKEY_RP_NAME') ?? 'RWA.LAT'
  }

  async listSessions(actor: SecurityActor) {
    const [sessions, devices] = await Promise.all([
      this.sessions.find({ where: { userId: actor.userId }, order: { lastSeenAt: 'DESC' } }),
      this.devices.find({ where: { userId: actor.userId } }),
    ])
    const deviceById = new Map(devices.map((device) => [device.id, device]))
    return sessions.map((session) => ({
      id: session.id,
      state: session.state,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === actor.sessionId,
      device: session.deviceId
        ? {
            id: session.deviceId,
            name: deviceById.get(session.deviceId)?.displayName ?? 'Unnamed device',
            trustState: deviceById.get(session.deviceId)?.trustState ?? 'untrusted',
          }
        : null,
    }))
  }

  async revokeSession(actor: SecurityActor, sessionId: string, requestId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId: actor.userId } })
    if (!session) throw this.notFound(SECURITY_ERROR_CODES.SESSION_NOT_FOUND, 'Session not found.')
    if (session.state === 'active') {
      session.state = 'revoked'
      session.revokedAt = new Date()
      session.revokeReason = session.id === actor.sessionId ? 'user_logout' : 'user_revoked'
      await this.sessions.save(session)
      await this.audit(actor.userId, requestId, 'security.session.revoked', 'session', session.id, {
        currentSession: session.id === actor.sessionId,
      })
    }
    return { revoked: true, isCurrent: session.id === actor.sessionId }
  }

  async revokeOtherSessions(actor: SecurityActor, requestId: string) {
    const sessions = await this.sessions.find({ where: { userId: actor.userId, state: 'active' } })
    const now = new Date()
    const others = sessions.filter((session) => session.id !== actor.sessionId)
    for (const session of others) {
      session.state = 'revoked'
      session.revokedAt = now
      session.revokeReason = 'revoke_other_sessions'
    }
    if (others.length) await this.sessions.save(others)
    await this.audit(actor.userId, requestId, 'security.sessions.revoked_others', 'session', actor.sessionId, {
      revokedCount: others.length,
    })
    return { revokedCount: others.length }
  }

  async listDevices(actor: SecurityActor) {
    const [devices, sessions] = await Promise.all([
      this.devices.find({ where: { userId: actor.userId }, order: { lastSeenAt: 'DESC' } }),
      this.sessions.find({ where: { userId: actor.userId, state: 'active' } }),
    ])
    return devices.map((device) => ({
      id: device.id,
      name: device.displayName ?? 'Unnamed device',
      trustState: device.trustState,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      trustedAt: device.trustedAt,
      isCurrent: device.id === actor.deviceId,
      activeSessionCount: sessions.filter((session) => session.deviceId === device.id).length,
    }))
  }

  async listFactors(actor: SecurityActor) {
    const [totpFactors, passkeys] = await Promise.all([
      this.totpFactors.find({ where: { userId: actor.userId }, order: { activatedAt: 'DESC' } }),
      this.passkeys.find({ where: { userId: actor.userId }, order: { createdAt: 'DESC' } }),
    ])
    return {
      totp: totpFactors.map((factor) => ({
        id: factor.id,
        label: factor.label,
        state: factor.state,
        activatedAt: factor.activatedAt,
        revokedAt: factor.revokedAt,
        recoveryCodesRemaining: factor.recoveryCodeHashes.length,
      })),
      passkeys: passkeys.map((passkey) => ({
        id: passkey.id,
        label: passkey.label,
        state: passkey.state,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
        revokedAt: passkey.revokedAt,
        transports: passkey.transports,
      })),
    }
  }

  async revokeTotpFactor(actor: SecurityActor, factorId: string, reauthentication: string, requestId: string) {
    this.assertStepUp(actor, reauthentication)
    const factor = await this.totpFactors.findOne({ where: { id: factorId, userId: actor.userId } })
    if (!factor || factor.state === 'revoked') {
      throw this.notFound(SECURITY_ERROR_CODES.TOTP_NOT_CONFIGURED, 'Authenticator factor not found.')
    }
    factor.state = 'revoked'
    factor.revokedAt = new Date()
    factor.recoveryCodeHashes = []
    await this.totpFactors.save(factor)
    await this.audit(actor.userId, requestId, 'security.totp.revoked', 'totp_factor', factor.id)
    return { revoked: true, factorId: factor.id }
  }

  async revokePasskey(actor: SecurityActor, passkeyId: string, reauthentication: string, requestId: string) {
    this.assertStepUp(actor, reauthentication)
    const passkey = await this.passkeys.findOne({ where: { id: passkeyId, userId: actor.userId, state: 'active' } })
    if (!passkey) throw this.notFound(SECURITY_ERROR_CODES.PASSKEY_NOT_FOUND, 'Active passkey not found.')
    passkey.state = 'revoked'
    passkey.revokedAt = new Date()
    await this.passkeys.save(passkey)
    await this.audit(actor.userId, requestId, 'security.passkey.revoked', 'passkey', passkey.id)
    return { revoked: true, passkeyId: passkey.id }
  }

  async revokeDevice(actor: SecurityActor, deviceId: string, requestId: string) {
    const device = await this.devices.findOne({ where: { id: deviceId, userId: actor.userId } })
    if (!device) throw this.notFound(SECURITY_ERROR_CODES.DEVICE_NOT_FOUND, 'Device not found.')
    const now = new Date()
    if (device.trustState !== 'revoked') {
      device.trustState = 'revoked'
      device.revokedAt = now
      await this.devices.save(device)
    }
    const active = await this.sessions.find({ where: { userId: actor.userId, deviceId, state: 'active' } })
    for (const session of active) {
      session.state = 'revoked'
      session.revokedAt = now
      session.revokeReason = 'device_revoked'
    }
    if (active.length) await this.sessions.save(active)
    await this.audit(actor.userId, requestId, 'security.device.revoked', 'device', device.id, {
      revokedSessionCount: active.length,
    })
    return { revoked: true, currentSessionRevoked: actor.deviceId === deviceId }
  }

  async beginTotpEnrollment(actor: SecurityActor, requestId: string) {
    const existing = await this.totpFactors.findOne({
      where: [{ userId: actor.userId, state: 'pending' }, { userId: actor.userId, state: 'active' }],
    })
    if (existing) {
      throw new ConflictException({
        code: SECURITY_ERROR_CODES.TOTP_ALREADY_CONFIGURED,
        message: 'An active or pending authenticator app already exists.',
      })
    }
    const secret = this.crypto.generateTotpSecret()
    const recoveryCodes = Array.from({ length: 10 }, () => this.recoveryCode())
    const encrypted = this.crypto.encrypt(secret)
    const factor = await this.totpFactors.save(
      this.totpFactors.create({
        id: randomUUID(),
        userId: actor.userId,
        state: 'pending',
        label: 'Authenticator app',
        secretCiphertext: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
        recoveryCodeHashes: recoveryCodes.map((code) => this.crypto.hashToken(code).toString('base64')),
        activatedAt: null,
        revokedAt: null,
      }),
    )
    await this.audit(actor.userId, requestId, 'security.totp.enrollment_started', 'totp_factor', factor.id)
    return {
      factorId: factor.id,
      otpauthUri: `otpauth://totp/${encodeURIComponent(`${this.rpName}:${actor.userId}`)}?secret=${secret}&issuer=${encodeURIComponent(this.rpName)}&algorithm=SHA1&digits=6&period=30`,
      recoveryCodes,
      expiresNotice: 'Confirm one current code before relying on this factor for sensitive actions.',
    }
  }

  async confirmTotpEnrollment(actor: SecurityActor, factorId: string, code: string, requestId: string) {
    const factor = await this.totpFactors.findOne({ where: { id: factorId, userId: actor.userId, state: 'pending' } })
    if (!factor) throw this.notFound(SECURITY_ERROR_CODES.TOTP_NOT_CONFIGURED, 'Pending authenticator app not found.')
    if (!this.crypto.verifyTotp(this.crypto.decrypt(factor.secretCiphertext), code)) {
      throw this.invalidTotp()
    }
    factor.state = 'active'
    factor.activatedAt = new Date()
    await this.totpFactors.save(factor)
    await this.audit(actor.userId, requestId, 'security.totp.enrolled', 'totp_factor', factor.id)
    return { enabled: true, factorId: factor.id }
  }

  async verifyTotpStepUp(actor: SecurityActor, code: string, requestId: string) {
    const factor = await this.totpFactors.findOne({ where: { userId: actor.userId, state: 'active' } })
    if (!factor) throw this.notFound(SECURITY_ERROR_CODES.TOTP_NOT_CONFIGURED, 'No active authenticator app is configured.')
    if (!this.crypto.verifyTotp(this.crypto.decrypt(factor.secretCiphertext), code)) throw this.invalidTotp()
    const reauthentication = this.issueStepUp(actor, 'totp')
    await this.audit(actor.userId, requestId, 'security.step_up.completed', 'totp_factor', factor.id, { method: 'totp' })
    return { reauthentication, expiresInSeconds: STEP_UP_TTL_MS / 1000, method: 'totp' }
  }

  async verifyRecoveryCode(actor: SecurityActor, code: string, requestId: string) {
    const factor = await this.totpFactors.findOne({ where: { userId: actor.userId, state: 'active' } })
    if (!factor) throw this.notFound(SECURITY_ERROR_CODES.TOTP_NOT_CONFIGURED, 'No active authenticator app is configured.')
    const normalized = code.replace(/-/g, '').toUpperCase()
    const digest = this.crypto.hashToken(normalized).toString('base64')
    const index = factor.recoveryCodeHashes.indexOf(digest)
    if (index < 0) throw this.invalidTotp()
    factor.recoveryCodeHashes = factor.recoveryCodeHashes.filter((_, currentIndex) => currentIndex !== index)
    await this.totpFactors.save(factor)
    const reauthentication = this.issueStepUp(actor, 'recovery_code')
    await this.audit(actor.userId, requestId, 'security.recovery_code.used', 'totp_factor', factor.id)
    return { reauthentication, expiresInSeconds: STEP_UP_TTL_MS / 1000, method: 'recovery_code' }
  }

  async beginPasskeyRegistration(actor: SecurityActor, requestId: string) {
    const passkeys = await this.passkeys.find({ where: { userId: actor.userId, state: 'active' } })
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: actor.userId,
      userID: new TextEncoder().encode(actor.userId),
      userDisplayName: 'RWA.LAT account',
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      excludeCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports as never })),
    })
    const challengeId = await this.storeChallenge(actor, 'passkey_registration', options.challenge)
    await this.audit(actor.userId, requestId, 'security.passkey.registration_started', 'security_challenge', challengeId)
    return { challengeId, options }
  }

  async finishPasskeyRegistration(
    actor: SecurityActor,
    challengeId: string,
    response: Record<string, unknown>,
    label: string | undefined,
    requestId: string,
  ) {
    const challenge = await this.loadChallenge(actor, challengeId, 'passkey_registration')
    const verification = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: this.crypto.decrypt(challenge.challengeCiphertext),
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      requireUserVerification: true,
    })
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException({
        code: SECURITY_ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        message: 'The passkey registration response could not be verified.',
      })
    }
    await this.consumeChallenge(challenge)
    const credential = verification.registrationInfo.credential
    const passkey = await this.passkeys.save(
      this.passkeys.create({
        id: randomUUID(),
        userId: actor.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? [...credential.transports] : [],
        label: label?.trim() || 'Passkey',
        state: 'active',
        lastUsedAt: null,
        revokedAt: null,
      }),
    )
    await this.audit(actor.userId, requestId, 'security.passkey.registered', 'passkey', passkey.id)
    return { registered: true, passkeyId: passkey.id, label: passkey.label }
  }

  async beginPasskeyAssertion(actor: SecurityActor, requestId: string) {
    const passkeys = await this.passkeys.find({ where: { userId: actor.userId, state: 'active' } })
    if (!passkeys.length) throw this.notFound(SECURITY_ERROR_CODES.PASSKEY_NOT_FOUND, 'No active passkey is configured.')
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'required',
      allowCredentials: passkeys.map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports as never })),
    })
    const challengeId = await this.storeChallenge(actor, 'passkey_assertion', options.challenge)
    await this.audit(actor.userId, requestId, 'security.passkey.assertion_started', 'security_challenge', challengeId)
    return { challengeId, options }
  }

  async finishPasskeyAssertion(
    actor: SecurityActor,
    challengeId: string,
    response: Record<string, unknown>,
    requestId: string,
  ) {
    const challenge = await this.loadChallenge(actor, challengeId, 'passkey_assertion')
    const credentialId = typeof response.id === 'string' ? response.id : ''
    const passkey = await this.passkeys.findOne({ where: { userId: actor.userId, credentialId, state: 'active' } })
    if (!passkey) throw this.notFound(SECURITY_ERROR_CODES.PASSKEY_NOT_FOUND, 'Passkey not found.')
    const verification = await verifyAuthenticationResponse({
      response: response as unknown as AuthenticationResponseJSON,
      expectedChallenge: this.crypto.decrypt(challenge.challengeCiphertext),
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
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
        code: SECURITY_ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        message: 'The passkey assertion could not be verified.',
      })
    }
    await this.consumeChallenge(challenge)
    passkey.counter = verification.authenticationInfo.newCounter
    passkey.lastUsedAt = new Date()
    await this.passkeys.save(passkey)
    const reauthentication = this.issueStepUp(actor, 'passkey')
    await this.audit(actor.userId, requestId, 'security.step_up.completed', 'passkey', passkey.id, { method: 'passkey' })
    return { reauthentication, expiresInSeconds: STEP_UP_TTL_MS / 1000, method: 'passkey' }
  }

  async trustCurrentDevice(actor: SecurityActor, reauthentication: string, requestId: string) {
    this.assertStepUp(actor, reauthentication)
    if (!actor.deviceId) throw this.notFound(SECURITY_ERROR_CODES.DEVICE_NOT_FOUND, 'The current session has no device.')
    const device = await this.devices.findOne({ where: { id: actor.deviceId, userId: actor.userId } })
    if (!device || device.trustState === 'revoked') {
      throw this.notFound(SECURITY_ERROR_CODES.DEVICE_NOT_FOUND, 'Current device is unavailable.')
    }
    device.trustState = 'trusted'
    device.trustedAt = new Date()
    await this.devices.save(device)
    await this.audit(actor.userId, requestId, 'security.device.trusted', 'device', device.id)
    return { trusted: true, deviceId: device.id }
  }

  assertRecentStepUp(actor: SecurityActor, reauthentication: string): void {
    this.assertStepUp(actor, reauthentication)
  }

  async listEvents(actor: SecurityActor) {
    return this.auditLogs.find({
      where: { userId: actor.userId, action: Like('security.%') },
      order: { occurredAt: 'DESC' },
      take: 50,
    })
  }

  private async storeChallenge(actor: SecurityActor, kind: SecurityChallengeKind, value: string) {
    const encrypted = this.crypto.encrypt(value)
    const row = await this.challenges.save(
      this.challenges.create({
        id: randomUUID(),
        userId: actor.userId,
        sessionId: actor.sessionId,
        kind,
        challengeHash: this.crypto.hashToken(value),
        challengeCiphertext: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
        consumedAt: null,
      }),
    )
    return row.id
  }

  private async loadChallenge(actor: SecurityActor, id: string, kind: SecurityChallengeKind) {
    const challenge = await this.challenges.findOne({
      where: { id, userId: actor.userId, sessionId: actor.sessionId, kind, consumedAt: IsNull() },
    })
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: SECURITY_ERROR_CODES.PASSKEY_CHALLENGE_INVALID,
        message: 'The passkey challenge is missing, expired, or already used.',
      })
    }
    return challenge
  }

  private async consumeChallenge(challenge: SecurityChallenge) {
    const result = await this.challenges.update({ id: challenge.id, consumedAt: IsNull() }, { consumedAt: new Date() })
    if (result.affected !== 1) {
      throw new ConflictException({
        code: SECURITY_ERROR_CODES.PASSKEY_CHALLENGE_INVALID,
        message: 'The passkey challenge was already used.',
      })
    }
  }

  private issueStepUp(actor: SecurityActor, method: 'totp' | 'passkey' | 'recovery_code') {
    return this.crypto.signState(
      JSON.stringify({
        audience: 'rwa-lat-security-step-up',
        userId: actor.userId,
        sessionId: actor.sessionId,
        method,
        expiresAt: Date.now() + STEP_UP_TTL_MS,
        nonce: randomBytes(12).toString('hex'),
      }),
    )
  }

  private assertStepUp(actor: SecurityActor, token: string) {
    const payload = this.crypto.verifyState(token)
    if (!payload) return this.stepUpRequired()
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>
      if (
        parsed.audience !== 'rwa-lat-security-step-up' ||
        parsed.userId !== actor.userId ||
        parsed.sessionId !== actor.sessionId ||
        typeof parsed.expiresAt !== 'number' ||
        parsed.expiresAt <= Date.now()
      ) {
        return this.stepUpRequired()
      }
    } catch {
      return this.stepUpRequired()
    }
  }

  private recoveryCode() {
    return randomBytes(8).toString('hex').toUpperCase()
  }

  private invalidTotp() {
    return new UnauthorizedException({
      code: SECURITY_ERROR_CODES.TOTP_INVALID,
      message: 'The verification code is invalid or expired.',
    })
  }

  private stepUpRequired(): never {
    throw new UnauthorizedException({
      code: SECURITY_ERROR_CODES.STEP_UP_REQUIRED,
      message: 'A recent TOTP, recovery-code, or passkey verification is required.',
    })
  }

  private notFound(code: string, message: string): NotFoundException {
    return new NotFoundException({ code, message })
  }

  private async audit(
    userId: string,
    requestId: string,
    action: string,
    objectType: string,
    objectId: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    await this.auditLogs.save(
      this.auditLogs.create({
        id: randomUUID(),
        actorType: 'user',
        actorId: userId,
        userId,
        action,
        objectType,
        objectId,
        requestId,
        reasonCode: null,
        metadata,
      }),
    )
  }
}
