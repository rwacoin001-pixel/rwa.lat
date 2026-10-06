import type { DataSource, EntityManager } from 'typeorm'
import { AuthFlowService } from '../../src/identity/auth-flow.service'
import type { IdentityCrypto } from '../../src/identity/identity-crypto.service'
import type { IdentityDeliveryService } from '../../src/identity/identity-delivery.service'

describe('Auth flow email expiry propagation', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-06T06:00:00Z')))
  afterEach(() => jest.useRealTimers())

  it.each(['login', 'reset', 'setup', 'email_bind', 'email_change'] as const)(
    'resends %s using its saved expiry and correct localized mail purpose', async purpose => {
      const expiresAt = new Date(Date.now() + 90_000)
      const payload = { userId: 'test-user', steps: ['email'], purpose, version: 1, factorIds: [],
        bindingEmail: 'user@example.com', sentAt: Date.now() - 61_000, sends: 1 }
      const query = jest.fn(async (sql: string) => {
        if (sql.startsWith('SELECT * FROM app.auth_flows')) return [{ payload_ciphertext: Buffer.from('stored'),
          encryption_key_version: 1, attempts: 0, expires_at: expiresAt, consumed_at: null }]
        if (sql.includes('SELECT u.status')) return [{ status: 'active', version: 1, password_required: false, password_hash: null }]
        if (sql.startsWith('SELECT locale')) return [{ locale: 'ar' }]
        return []
      })
      const manager = { query } as unknown as EntityManager
      const db = { transaction: (callback: (manager: EntityManager) => Promise<unknown>) => callback(manager) } as unknown as DataSource
      const crypto = { hashToken: () => Buffer.alloc(32), decrypt: () => JSON.stringify(payload),
        encrypt: (value: string) => ({ ciphertext: Buffer.from(value), keyVersion: 1 }) } as unknown as IdentityCrypto
      const delivery = { sendEmailCode: jest.fn().mockResolvedValue(undefined) }
      await new AuthFlowService(db, crypto, delivery as unknown as IdentityDeliveryService).resend('continuation')
      expect(delivery.sendEmailCode).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ar', expiresAt,
        purpose: purpose === 'setup' ? 'reset' : purpose, intent: 'login', code: expect.stringMatching(/^\d{6}$/) }))
      const updates = query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE app.auth_flows'))
      expect(updates).toHaveLength(1)
      expect(updates[0][0]).not.toContain('expires_at=')
    })
})
