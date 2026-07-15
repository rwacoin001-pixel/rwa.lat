import { UnauthorizedException } from '@nestjs/common'
import { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import { SessionAuthGuard, type AuthenticatedRequest } from '../../src/security/session-auth.guard'
import { SecurityService, type SecurityActor } from '../../src/security/security.service'

function crypto() {
  return new IdentityCrypto({
    getOrThrow: () => 'a'.repeat(64),
  } as any)
}

describe('Security core', () => {
  it('accepts a current RFC 6238 six-digit code within its time window', () => {
    const service = crypto()
    // RFC 6238 SHA-1 secret at T=59 seconds; the 8-digit vector is 94287082.
    expect(service.verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true)
    expect(service.verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287083', 59_000)).toBe(false)
  })

  it('binds a bearer token to an unexpired active session', async () => {
    const identityCrypto = crypto()
    const token = 'session-token'
    const session = {
      id: 'session-1',
      userId: 'user-1',
      deviceId: 'device-1',
      tokenHash: identityCrypto.hashToken(token),
      state: 'active',
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(0),
    }
    const sessions = {
      findOne: jest.fn().mockResolvedValue(session),
      save: jest.fn().mockResolvedValue(session),
    }
    const guard = new SessionAuthGuard(sessions as any, identityCrypto)
    const request = {
      header: (name: string) => (name === 'authorization' ? `Bearer ${token}` : undefined),
    } as AuthenticatedRequest
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.auth).toEqual({ userId: 'user-1', sessionId: 'session-1', deviceId: 'device-1' })
    expect(sessions.save).toHaveBeenCalled()
  })

  it('requires a recent step-up token before trusting a device', async () => {
    const identityCrypto = crypto()
    const device = { id: 'device-1', userId: 'user-1', trustState: 'untrusted', trustedAt: null }
    const devices = { findOne: jest.fn().mockResolvedValue(device), save: jest.fn().mockResolvedValue(device) }
    const auditLogs = { create: (value: unknown) => value, save: jest.fn().mockResolvedValue(undefined) }
    const service = new SecurityService(
      {} as any,
      devices as any,
      {} as any,
      {} as any,
      {} as any,
      auditLogs as any,
      identityCrypto,
      { get: () => undefined } as any,
    )
    const actor: SecurityActor = { userId: 'user-1', sessionId: 'session-1', deviceId: 'device-1' }
    const token = (service as any).issueStepUp(actor, 'totp')

    await expect(service.trustCurrentDevice(actor, token, 'request-1')).resolves.toEqual({ trusted: true, deviceId: 'device-1' })
    await expect(service.trustCurrentDevice({ ...actor, sessionId: 'other-session' }, token, 'request-2')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(device.trustState).toBe('trusted')
    expect(auditLogs.save).toHaveBeenCalledTimes(1)
  })

  it('lists and revokes security factors only with a step-up token bound to the session', async () => {
    const identityCrypto = crypto()
    const factor = {
      id: 'factor-1', userId: 'user-1', label: 'Authenticator app', state: 'active', activatedAt: new Date(),
      revokedAt: null, recoveryCodeHashes: ['hash-1', 'hash-2'],
    }
    const passkey = {
      id: 'passkey-1', userId: 'user-1', label: 'Laptop', state: 'active', createdAt: new Date(),
      lastUsedAt: null, revokedAt: null, transports: ['internal'],
    }
    const totpFactors = {
      find: jest.fn().mockResolvedValue([factor]),
      findOne: jest.fn().mockResolvedValue(factor),
      save: jest.fn().mockImplementation(async (value) => value),
    }
    const passkeys = {
      find: jest.fn().mockResolvedValue([passkey]),
      findOne: jest.fn().mockResolvedValue(passkey),
      save: jest.fn().mockImplementation(async (value) => value),
    }
    const auditLogs = { create: (value: unknown) => value, save: jest.fn().mockResolvedValue(undefined) }
    const service = new SecurityService(
      {} as any,
      {} as any,
      totpFactors as any,
      passkeys as any,
      {} as any,
      auditLogs as any,
      identityCrypto,
      { get: () => undefined } as any,
    )
    const actor: SecurityActor = { userId: 'user-1', sessionId: 'session-1', deviceId: 'device-1' }
    const token = (service as any).issueStepUp(actor, 'passkey')

    await expect(service.listFactors(actor)).resolves.toMatchObject({
      totp: [{ id: 'factor-1', recoveryCodesRemaining: 2 }],
      passkeys: [{ id: 'passkey-1', label: 'Laptop' }],
    })
    await expect(service.revokeTotpFactor(actor, 'factor-1', token, 'request-3')).resolves.toEqual({ revoked: true, factorId: 'factor-1' })
    await expect(service.revokePasskey(actor, 'passkey-1', token, 'request-4')).resolves.toEqual({ revoked: true, passkeyId: 'passkey-1' })
    await expect(service.revokePasskey({ ...actor, sessionId: 'session-2' }, 'passkey-1', token, 'request-5')).rejects.toBeInstanceOf(UnauthorizedException)

    expect(factor.state).toBe('revoked')
    expect(factor.recoveryCodeHashes).toEqual([])
    expect(passkey.state).toBe('revoked')
    expect(auditLogs.save).toHaveBeenCalledTimes(2)
  })
})
