import { assertTransactionPin, hashTransactionPin, verifyTransactionPin } from '../../src/wallet/transaction-pin-hash'
import { pinAttempt, pinWithdrawalGate } from '../../src/wallet/transaction-pin-policy'

describe('independent transaction PIN', () => {
  const pepper = 'a-test-only-pepper-with-at-least-32-bytes'
  it('keeps leading zeros, uses a random salt, and binds the hash to account and outside-DB pepper', async () => {
    const first = await hashTransactionPin('012345', 'account-a', pepper)
    const second = await hashTransactionPin('012345', 'account-a', pepper)
    expect(first).not.toBe(second)
    expect(first).not.toContain('012345')
    expect(await verifyTransactionPin('012345', 'account-a', pepper, first)).toBe(true)
    expect(await verifyTransactionPin('012345', 'account-b', pepper, first)).toBe(false)
    expect(await verifyTransactionPin('012345', 'account-a', `${pepper}changed`, first)).toBe(false)
    expect(await verifyTransactionPin('123450', 'account-a', pepper, first)).toBe(false)
    expect(await verifyTransactionPin('012345', 'account-a', pepper, 'invalid')).toBe(false)
  })
  it.each(['12345', '1234567', '１２３４５６', '123 45', 123456, null])('accepts only six ASCII digits: %p', (value) => {
    expect(() => assertTransactionPin(value as string)).toThrow()
  })
  it('locks the fifth consecutive failure for 15 minutes and cannot unlock early with a correct PIN', () => {
    const now = new Date('2026-10-09T00:00:00Z')
    const locked = pinAttempt({ failedAttempts: 4, lockedUntil: null }, false, now)
    expect(locked).toMatchObject({ failedAttempts: 5, lockedUntil: new Date('2026-10-09T00:15:00Z'), allowed: false })
    expect(pinAttempt(locked, true, now)).toMatchObject({ failedAttempts: 5, allowed: false })
    expect(pinAttempt(locked, false, new Date('2026-10-09T00:15:00Z'))).toMatchObject({ failedAttempts: 1, lockedUntil: null, allowed: false })
  })
  it('clears a consecutive failure streak on success', () => {
    expect(pinAttempt({ failedAttempts: 4, lockedUntil: null }, true, new Date())).toMatchObject({ failedAttempts: 0, lockedUntil: null, allowed: true })
  })
  it('enforces credential version and the exact server-side cooldown boundary', () => {
    const row = { credentialVersion: 2, lockedUntil: null, withdrawalBlockedUntil: new Date('2026-10-10T00:00:00Z') }
    expect(pinWithdrawalGate(row, 1, new Date('2026-10-10T00:00:00Z'))).toBe('TRANSACTION_PIN_CONFLICT')
    expect(pinWithdrawalGate(row, 2, new Date('2026-10-09T23:59:59.999Z'))).toBe('TRANSACTION_PIN_COOLDOWN')
    expect(pinWithdrawalGate(row, 2, new Date('2026-10-10T00:00:00Z'))).toBe(null)
    expect(pinWithdrawalGate(null, 2, new Date())).toBe('TRANSACTION_PIN_REQUIRED')
  })
})
