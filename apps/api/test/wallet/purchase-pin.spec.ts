import { ConfigService } from '@nestjs/config'
import { TransactionPinService } from '../../src/wallet/transaction-pin.service'
import { hashTransactionPin } from '../../src/wallet/transaction-pin-hash'

describe('purchase transaction PIN', () => {
  const pepper = 'purchase-test-pepper-with-at-least-32-bytes'
  const now = new Date('2026-11-05T00:00:00Z')
  let pinHash: string
  beforeAll(async () => { pinHash = await hashTransactionPin('012345', 'user', pepper) })

  function fixture(overrides = {}, configured = true, configValues = {}) {
    let row = configured ? { pinHash, credentialVersion: 2, failedAttempts: 0, lockedUntil: null as Date | null,
      withdrawalBlockedUntil: null as Date | null, serverTime: now, ...overrides } : undefined
    const runner = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(),
      query: jest.fn(async (sql: string, args?: unknown[]) => {
        if (sql.includes('FOR UPDATE')) return row ? [{ ...row }] : []
        if (sql.startsWith('UPDATE')) {
          row = { ...row!, failedAttempts: args![1] as number, lockedUntil: args![2] as Date | null }
        }
        return []
      }),
    }
    const db = { createQueryRunner: jest.fn(() => runner) }
    const config = new ConfigService({ TRANSACTION_PIN_PEPPER: pepper, ...configValues })
    const service = new TransactionPinService(db as never, config, {} as never)
    return { service, runner, db, config, state: () => row }
  }

  it('verifies six digits including leading zero, locks by user and resets attempts', async () => {
    const { service, runner, state } = fixture({ failedAttempts: 3 })
    await expect(service.verifyPurchase('user', '012345')).resolves.toBeUndefined()
    expect(state()!.failedAttempts).toBe(0)
    expect(runner.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['transaction-pin:user'])
    expect(runner.commitTransaction).toHaveBeenCalled()
    expect(runner.release).toHaveBeenCalled()
  })

  it.each([undefined, ''])('returns REQUIRED for missing PIN %p without opening a transaction', async pin => {
    const { service, db } = fixture()
    await expect(service.verifyPurchase('user', pin)).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_REQUIRED' } })
    expect(db.createQueryRunner).not.toHaveBeenCalled()
  })

  it('distinguishes an unset credential', async () => {
    const { service, runner } = fixture({}, false)
    await expect(service.verifyPurchase('user', '012345')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_UNSET' } })
    expect(runner.commitTransaction).toHaveBeenCalled()
  })

  it('commits wrong attempts and shares the withdrawal attempt counter and lockout', async () => {
    const { service, runner, state } = fixture({ failedAttempts: 3 })
    await expect(service.verifyPurchase('user', '999999')).rejects.toMatchObject({ response: {
      code: 'TRANSACTION_PIN_INVALID', remainingAttempts: 1, lockedUntil: null,
      withdrawalBlockedUntil: null, serverTime: now.toISOString(),
    } })
    expect(state()!.failedAttempts).toBe(4)
    await expect(service.verifyWithdrawal('user', '999999')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_LOCKED', remainingAttempts: 0 } })
    await expect(service.verifyPurchase('user', '012345')).rejects.toMatchObject({ response: {
      code: 'TRANSACTION_PIN_LOCKED', remainingAttempts: 0, lockedUntil: '2026-11-05T00:15:00.000Z',
    } })
    expect(state()!.failedAttempts).toBe(5)
    expect(runner.commitTransaction).toHaveBeenCalledTimes(3)
    expect(runner.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('rejects an existing lock without changing attempts', async () => {
    const { service, runner } = fixture({ failedAttempts: 5, lockedUntil: new Date(now.getTime() + 60_000) })
    await expect(service.verifyPurchase('user', '012345')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_LOCKED' } })
    expect(runner.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false)
  })

  it('ignores reset cooldown for purchases while withdrawals still enforce it', async () => {
    const { service } = fixture({ withdrawalBlockedUntil: new Date(now.getTime() + 86_400_000) })
    await expect(service.verifyPurchase('user', '012345')).resolves.toBeUndefined()
    await expect(service.verifyWithdrawal('user', '012345')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_COOLDOWN' } })
  })

  it('counts a wrong purchase PIN even during withdrawal cooldown', async () => {
    const { service, state } = fixture({ withdrawalBlockedUntil: new Date(now.getTime() + 86_400_000) })
    await expect(service.verifyPurchase('user', '999999')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_INVALID' } })
    expect(state()!.failedAttempts).toBe(1)
  })

  it('reads the default-on kill switch once at construction', async () => {
    const { service, db, config } = fixture({}, true, { PURCHASE_PIN_REQUIRED: 'false' })
    jest.spyOn(config, 'get').mockImplementation(() => { throw new Error('configuration reread') })
    await expect(service.verifyPurchase('user')).resolves.toBeUndefined()
    expect(db.createQueryRunner).not.toHaveBeenCalled()
    await expect(service.verifyWithdrawal('user')).rejects.toMatchObject({ response: { code: 'TRANSACTION_PIN_REQUIRED' } })
  })
})
