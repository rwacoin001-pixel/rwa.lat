import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'

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

describe('WalletLedgerBridge financial decisions', () => {
  it('rejects an unavailable transfer recipient before creating any transfer or ledger entry', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id FROM app.users')) return []
      return []
    })
    const runner = runnerWith(query)
    const bridge = new WalletLedgerBridge({ createQueryRunner: () => runner } as never)

    await expect(bridge.postInternalTransfer({
      id: 'transfer-1', senderUserId: 'user-1', recipientUserId: 'missing-user',
      atomicAmount: '1000', idempotencyKey: 'transfer-key-1', requestId: 'request-1',
    })).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'WALLET_TRANSFER_RECIPIENT_UNAVAILABLE',
        message: 'This transfer could not be completed. Check the recipient details and try again.',
      }),
    })

    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.internal_transfers'))).toBe(false)
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.ledger_entries'))).toBe(false)
    expect(runner.rollbackTransaction).toHaveBeenCalled()
  })

  it('returns the original transfer only when an idempotency retry has the same intent', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM app.internal_transfers') && sql.includes('idempotency_key')) {
        return [{ id: 'transfer-existing', recipientUserId: 'user-2', atomicAmount: '1000' }]
      }
      return []
    })
    const runner = runnerWith(query)
    const bridge = new WalletLedgerBridge({ createQueryRunner: () => runner } as never)

    await expect(bridge.postInternalTransfer({
      id: 'transfer-new', senderUserId: 'user-1', recipientUserId: 'user-2',
      atomicAmount: '1000', idempotencyKey: 'transfer-key-1', requestId: 'request-1',
    })).resolves.toEqual({ id: 'transfer-existing', created: false })
    expect(runner.commitTransaction).toHaveBeenCalled()

    await expect(bridge.postInternalTransfer({
      id: 'transfer-new', senderUserId: 'user-1', recipientUserId: 'user-3',
      atomicAmount: '1000', idempotencyKey: 'transfer-key-1', requestId: 'request-2',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WALLET_IDEMPOTENCY_CONFLICT' }) })
  })

  it('serializes distinct approvals on the withdrawal row before marking it approved', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id, user_id, state FROM app.withdrawals')) {
        return [{ id: 'withdrawal-1', user_id: 'user-1', state: 'risk_review' }]
      }
      if (sql.includes('INSERT INTO app.withdrawal_approval_decisions')) return [{ id: 'decision-2' }]
      if (sql.includes('SELECT COUNT(*)')) return [{ count: 2 }]
      return []
    })
    const runner = runnerWith(query)
    const bridge = new WalletLedgerBridge({ createQueryRunner: () => runner } as never)

    await expect(bridge.recordWithdrawalApproval({
      withdrawalId: 'withdrawal-1',
      adminId: 'admin-2',
      approvalsRequired: 2,
      enqueueExecution: true,
      reasonCode: null,
      requestId: 'request-1',
    })).resolves.toMatchObject({ state: 'approved', approvalCount: 2 })

    expect(query.mock.calls.some(([sql]) => /withdrawals WHERE id = \$1 FOR UPDATE/.test(String(sql)))).toBe(true)
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET state = 'approved'"))).toBe(true)
    expect(query.mock.calls.some(([sql]) => String(sql).includes("'wallet-withdrawal-execution'"))).toBe(true)
    expect(runner.commitTransaction).toHaveBeenCalled()
  })

  it('rejects and refunds the locked amount in the same transaction', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT * FROM app.withdrawals')) {
        return [{
          id: 'withdrawal-1', user_id: 'user-1', state: 'risk_review',
          atomic_amount: '1000', fee_atomic_amount: '10',
        }]
      }
      if (sql.includes('INSERT INTO app.withdrawal_approval_decisions')) return [{ id: 'decision-1' }]
      if (sql.includes('SELECT id FROM app.ledger_accounts')) {
        return [{ id: params?.[1] === 'locked' ? 'locked-account' : 'available-account' }]
      }
      if (sql.includes('INSERT INTO app.ledger_transactions')) return [{ id: 'refund-transaction' }]
      return []
    })
    const runner = runnerWith(query)
    const bridge = new WalletLedgerBridge({ createQueryRunner: () => runner } as never)

    await expect(bridge.recordWithdrawalRejection({
      withdrawalId: 'withdrawal-1',
      adminId: 'admin-3',
      reasonCode: 'risk_rejected',
      requestId: 'request-2',
    })).resolves.toMatchObject({ state: 'rejected', refunded: true, duplicate: false })

    const entries = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO app.ledger_entries'))
    expect(entries?.[1]).toEqual(['refund-transaction', 'locked-account', 'available-account', '1010'])
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SET state = 'rejected'"))).toBe(true)
    expect(runner.commitTransaction).toHaveBeenCalled()
  })
})
