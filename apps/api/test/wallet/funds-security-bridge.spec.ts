import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'

function fixture(query: jest.Mock) {
  const runner = { connect: jest.fn(), startTransaction: jest.fn(), query, commitTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn() }
  return { runner, bridge: new WalletLedgerBridge({ createQueryRunner: () => runner } as never) }
}
const withdrawal = {
  id: 'new', userId: 'sender', walletId: 'wallet', network: 'tron' as const, atomicAmount: '1000000', feeAtomicAmount: '1000',
  destinationHash: Buffer.from('destination'), destinationCiphertext: Buffer.from('encrypted'), encryptionKeyVersion: 1,
  addressBookEntryId: null, policySnapshot: {}, perTransactionLimitAtomic: null, dailyLimitAtomic: null,
  idempotencyKey: 'key', state: 'risk_review' as const, reasonCode: null, requestId: 'request', transactionPinVersion: 1,
}
describe('funds security final transaction boundary', () => {
  it('rejects a recipient without a qualifying deposit before any financial insert', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('FROM app.users') ? [{ id: 'recipient', status: 'active' }] : [])
    const { runner, bridge } = fixture(query)
    await expect(bridge.postInternalTransfer({id:'new',senderUserId:'sender',recipientUserId:'recipient',atomicAmount:'1',idempotencyKey:'key',requestId:'request'})).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_TRANSFER_DEPOSIT_REQUIRED'})})
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.internal_transfers'))).toBe(false)
    expect(runner.rollbackTransaction).toHaveBeenCalled()
  })
  it('rejects reusing a withdrawal key with a different amount, network or destination', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('FROM app.withdrawals') ? [{id:'prior',atomicAmount:'2000000',feeAtomicAmount:'1000',network:'tron',destinationHash:Buffer.from('destination')}] : [])
    const { bridge } = fixture(query)
    await expect(bridge.createWithdrawalWithLock(withdrawal)).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_IDEMPOTENCY_CONFLICT'})})
  })
  it('rejects an old PIN credential version at the funds boundary without creating a withdrawal', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('FROM app.transaction_password_credentials') ? [{credentialVersion:2,lockedUntil:null,withdrawalBlockedUntil:null,serverTime:new Date()}] : [])
    const { bridge } = fixture(query)
    await expect(bridge.createWithdrawalWithLock(withdrawal)).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_CONFLICT'})})
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO app.withdrawals'))).toBe(false)
  })
})
