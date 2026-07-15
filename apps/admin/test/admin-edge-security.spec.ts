import { ConfigService } from '@nestjs/config'
import type { DataSource } from 'typeorm'
import { AdminRateLimiter } from '../src/admin-edge.middleware'
import { AdminAuthService, encryptAdminMfaSecret, hashAdminPassword } from '../src/admin-auth.service'
import { validateAdminEnvironment } from '../src/production-environment'
import { Reflector } from '@nestjs/core'
import { ADMIN_REQUIRED_PERMISSIONS, AdminPermissionGuard } from '../src/admin-permission.guard'
import type { ExecutionContext } from '@nestjs/common'

describe('admin edge security', () => {
  it('limits administrator login attempts to five per minute per IP', () => {
    const limiter = new AdminRateLimiter()
    const input = { method: 'POST', path: '/v1/admin/auth/login', ip: '203.0.113.20', now: 1_000 }
    for (let attempt = 0; attempt < 5; attempt += 1) expect(limiter.consume(input).allowed).toBe(true)
    expect(limiter.consume(input)).toMatchObject({
      allowed: false,
      limit: 5,
      retryAfterSeconds: 60,
      rule: 'admin-login',
    })
  })

  it('keeps login limits independent across client IPs', () => {
    const limiter = new AdminRateLimiter()
    const request = { method: 'POST', path: '/v1/admin/auth/login', ip: '203.0.113.21', now: 2_000 }
    for (let attempt = 0; attempt < 6; attempt += 1) limiter.consume(request)
    expect(limiter.consume({ ...request, ip: '203.0.113.22' }).allowed).toBe(true)
  })

  it('rejects incomplete or unsafe production configuration', () => {
    expect(() => validateAdminEnvironment({ APP_ENV: 'production' })).toThrow(/missing/i)
    expect(() => validateAdminEnvironment(production({ ADMIN_CORS_ORIGINS: 'http://localhost:3100' }))).toThrow(/non-local HTTPS/i)
    expect(() => validateAdminEnvironment(production({ ADMIN_MFA_REQUIRED: 'false' }))).toThrow(/mandatory/i)
    expect(() => validateAdminEnvironment(production({ TRUST_PROXY_HOPS: 'true' }))).toThrow(/TRUST_PROXY_HOPS/)
  })

  it('accepts an explicit production admin boundary', () => {
    expect(validateAdminEnvironment(production())).toMatchObject({ APP_ENV: 'production', ADMIN_MFA_REQUIRED: 'true' })
  })

  it('accepts versioned Admin MFA keys and emits key-versioned ciphertext', () => {
    const first = Buffer.alloc(32, 8).toString('base64')
    const second = Buffer.alloc(32, 9).toString('base64')
    expect(validateAdminEnvironment(production({
      ADMIN_MFA_ENCRYPTION_KEY: '',
      ADMIN_MFA_KEYS_JSON: JSON.stringify({ 1: first, 2: second }),
      ADMIN_MFA_ACTIVE_KEY_VERSION: '2',
    }))).toMatchObject({ ADMIN_MFA_ACTIVE_KEY_VERSION: '2' })
    expect(encryptAdminMfaSecret('JBSWY3DPEHPK3PXP', second, 2)).toMatch(/^v2\.2\./)
  })

  it('fails closed when a production administrator has no enabled MFA factor', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT u.id')) {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          email: 'operator@example.com',
          role_id: '22222222-2222-2222-2222-222222222222',
          password_hash: hashAdminPassword('long-production-password'),
          disabled_at: null,
          locked_until: null,
          mfa_state: 'disabled',
          mfa_secret_ciphertext: null,
          role_name: 'operator',
          permissions: [],
        }]
      }
      return []
    })
    const service = new AdminAuthService(
      { query } as unknown as DataSource,
      new ConfigService({ APP_ENV: 'production', ADMIN_MFA_REQUIRED: 'true' }),
    )
    await expect(service.login({
      email: 'operator@example.com',
      password: 'long-production-password',
    })).rejects.toThrow('Additional administrator verification is required')
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.admin_sessions'), expect.anything())
  })

  it('enforces method-level administrator permissions', () => {
    const handler = () => undefined
    Reflect.defineMetadata(ADMIN_REQUIRED_PERMISSIONS, ['redemptions.read'], handler)
    const guard = new AdminPermissionGuard(new Reflector())
    expect(guard.canActivate(permissionContext(handler, ['redemptions.read']))).toBe(true)
    expect(() => guard.canActivate(permissionContext(handler, ['users.read']))).toThrow(/redemptions.read/)
    expect(() => guard.canActivate(permissionContext(handler, []))).toThrow()
  })
})

function production(overrides: Record<string, string> = {}) {
  return {
    APP_ENV: 'production',
    ADMIN_DATABASE_URL: 'postgresql://admin:secret@db.example.com:5432/rwa_lat_production',
    ADMIN_CORS_ORIGINS: 'https://admin.rwa.lat',
    PUBLIC_ADMIN_API_URL: 'https://admin-api.rwa.lat',
    TRUST_PROXY_HOPS: '1',
    ADMIN_MFA_REQUIRED: 'true',
    ADMIN_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    ...overrides,
  }
}

function permissionContext(handler: () => void, permissions: string[]): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ admin: { permissions } }),
    }),
  } as unknown as ExecutionContext
}
