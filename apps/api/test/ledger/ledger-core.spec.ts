import { LedgerService } from '../../src/ledger/ledger.service'

function runnerWith(query: jest.Mock) {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query,
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  }
}

describe('LedgerService', () => {
  it('reads user balances from the ledger projection and clamps history limits', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ accountId: 'a1', atomicBalance: '123' }])
      .mockResolvedValueOnce([{ id: 't1', entries: [] }])
    const service = new LedgerService({ query } as never)

    await expect(service.listUserBalances('user-1')).resolves.toMatchObject({
      accounts: [{ accountId: 'a1', atomicBalance: '123' }],
      source: 'immutable-ledger-projection',
    })
    await expect(service.listUserTransactions('user-1', 500)).resolves.toMatchObject({ limit: 100 })
    expect(query.mock.calls[1][1]).toEqual(['user-1', 100])
  })

  it('creates a reconciliation case for a difference without mutating balances', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT id FROM app.ledger_accounts')) return [{ id: 'settlement-account' }]
      if (sql.includes('FROM app.ledger_account_balances')) return [{ amount: '1000000' }]
      if (sql.includes('INSERT INTO app.reconciliation_runs')) return [{ id: 'run-1' }]
      return []
    })
    const runner = runnerWith(query)
    const service = new LedgerService({ createQueryRunner: () => runner } as never)

    const result = await service.reconcileCustody({
      provider: 'custody-a', network: 'arbitrum', observedAtomicBalance: '999000',
      periodStart: new Date('2026-07-11T00:00:00Z'), periodEnd: new Date('2026-07-12T00:00:00Z'),
      sourceReference: 'statement-2026-07-11', requestId: 'request-1',
    })

    expect(result).toMatchObject({ state: 'differences_found', differenceAtomicAmount: '-1000', duplicate: false })
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.reconciliation_cases'))).toBe(true)
    expect(query.mock.calls.some(([sql]) => /UPDATE app\.ledger_account_balances|INSERT INTO app\.ledger_entries/.test(String(sql)))).toBe(false)
    expect(runner.commitTransaction).toHaveBeenCalled()
  })

  it('rolls back settlement when the chain transaction is not confirmed', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT * FROM app.withdrawals')) {
        return [{ id: 'w1', user_id: 'u1', state: 'confirming', network: 'arbitrum', atomic_amount: '1000', fee_atomic_amount: '10' }]
      }
      if (sql.includes('FROM app.chain_transactions')) return []
      return []
    })
    const runner = runnerWith(query)
    const service = new LedgerService({ createQueryRunner: () => runner } as never)

    await expect(service.settleWithdrawal('w1', 'chain-1', 'request-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LEDGER_CHAIN_TRANSACTION_UNCONFIRMED' }),
    })
    expect(runner.rollbackTransaction).toHaveBeenCalled()
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.ledger_entries'))).toBe(false)
  })

  it('treats a repeated withdrawal refund as idempotent and does not post entries twice', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT * FROM app.withdrawals')) {
        return [{ id: 'w1', user_id: 'u1', state: 'failed', network: 'arbitrum', atomic_amount: '1000', fee_atomic_amount: '10' }]
      }
      if (sql.includes('SELECT id FROM app.ledger_accounts')) {
        return [{ id: params?.[1] === 'locked' ? 'locked-account' : 'available-account' }]
      }
      if (sql.includes('INSERT INTO app.ledger_transactions')) return []
      return []
    })
    const runner = runnerWith(query)
    const service = new LedgerService({ createQueryRunner: () => runner } as never)

    await expect(service.refundWithdrawal('w1', 'provider_failed', 'request-1')).resolves.toMatchObject({
      refunded: true,
      duplicate: true,
    })
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.ledger_entries'))).toBe(false)
  })

  it('forbids an adjustment requester from approving their own request', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM app.ledger_adjustment_requests')) {
        return [{ id: 'adjustment-1', state: 'requested', requested_by: 'admin-1' }]
      }
      return []
    })
    const runner = runnerWith(query)
    const service = new LedgerService({ createQueryRunner: () => runner } as never)

    await expect(service.decideLedgerAdjustment(
      'adjustment-1', 'admin-1', true, undefined, 'request-1',
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'LEDGER_ADJUSTMENT_SELF_APPROVAL_FORBIDDEN' }),
    })
    expect(runner.rollbackTransaction).toHaveBeenCalled()
  })

  it('posts an approved adjustment as two equal and opposite immutable entries', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM app.ledger_adjustment_requests')) {
        return [{
          id: 'adjustment-1', state: 'approved', requested_by: 'admin-1', approved_by: 'admin-2',
          ledger_account_id: 'target-account', side: 'credit', atomic_amount: '2500', reason_code: 'reconciliation_difference',
        }]
      }
      if (sql.includes('FROM app.ledger_accounts WHERE id')) {
        return [{ id: 'target-account', asset_code: 'USDT', asset_decimals: 6, network: null, state: 'active' }]
      }
      if (sql.includes("owner_reference = 'ledger-adjustments'")) return [{ id: 'contra-account' }]
      if (sql.includes('INSERT INTO app.ledger_transactions')) return [{ id: 'ledger-transaction-1' }]
      return []
    })
    const runner = runnerWith(query)
    const service = new LedgerService({ createQueryRunner: () => runner } as never)

    await expect(service.postLedgerAdjustment('adjustment-1', 'admin-3', 'request-1')).resolves.toMatchObject({
      state: 'posted', duplicate: false,
    })
    const entryCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO app.ledger_entries'))
    expect(entryCall?.[1]).toEqual([
      expect.any(String), 'target-account', 'credit', 'contra-account', '2500', 'debit',
    ])
    expect(runner.commitTransaction).toHaveBeenCalled()
  })
})
