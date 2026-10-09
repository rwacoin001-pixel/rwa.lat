import { randomUUID } from 'node:crypto'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { TransactionPinService } from '../../src/wallet/transaction-pin.service'
import { hasQualifyingDeposit } from '../../src/wallet/transfer-eligibility'
import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'
import { realDeposit, reverseDeposit } from './funds-security-fixture'
import { TransactionPassword1791619200000 } from '../../src/database/migrations/1791619200000-transaction-password'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip
describeDatabase('funds security (isolated PostgreSQL)', () => {
  let db: DataSource, pin: TransactionPinService, bridge: WalletLedgerBridge
  const security = { assertRecentStepUp: jest.fn() }
  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize(); await db.runMigrations({ transaction: 'all' })
    bridge = new WalletLedgerBridge(db)
    pin = new TransactionPinService(db, new ConfigService({ TRANSACTION_PIN_PEPPER: 'test-only-pepper-outside-db-at-least-32-bytes' }), security as never)
  })
  afterAll(async () => { if (db?.isInitialized) await db.destroy() })
  const user = async () => (await db.query('INSERT INTO app.users DEFAULT VALUES RETURNING id'))[0].id as string
  const actor = (userId: string) => ({ userId, sessionId: randomUUID(), deviceId: null })
  async function setup(userId: string) {
    await pin.setup(actor(userId), { pin: '012345', confirmation: '012345', reauthentication: 'test-strong-auth' }, randomUUID())
  }
  const input = (sender: string, recipient: string) => ({ id: randomUUID(), senderUserId: sender, recipientUserId: recipient, atomicAmount: '1000000', idempotencyKey: randomUUID(), requestId: randomUUID() })

  it.each(['299999999', '300000000', '300000001'])('strict single-deposit boundary %s', async amount => {
    const id = await user(); await realDeposit(db, id, amount)
    expect(await hasQualifyingDeposit(db, id)).toBe(BigInt(amount) > 300000000n)
  })
  it('does not add two small deposits and does not accept a stub-custody credit', async () => {
    const small = await user(); await realDeposit(db, small, '200000000'); await realDeposit(db, small, '200000000')
    const demo = await user(); await realDeposit(db, demo, '900000000', 'stub-custody')
    expect(await hasQualifyingDeposit(db, small)).toBe(false)
    expect(await hasQualifyingDeposit(db, demo)).toBe(false)
  })
  it('requires confirmed chain and unreversed genuine ledger credit', async () => {
    const id = await user(); const deposit = await realDeposit(db, id)
    await db.query("UPDATE app.chain_transactions SET state='reorged' WHERE id=$1", [deposit.chainId])
    expect(await hasQualifyingDeposit(db, id)).toBe(false)
    await db.query("UPDATE app.chain_transactions SET state='confirmed' WHERE id=$1", [deposit.chainId])
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    try { await reverseDeposit(runner, deposit.transactionId); await runner.commitTransaction() }
    finally { await runner.release() }
    expect(await hasQualifyingDeposit(db, id)).toBe(false)
  })
  it('does not trust a credited flag without the deposit ledger, or accept review/rejected/unconfirmed records', async () => {
    const id=await user();const deposit=await realDeposit(db,id,'900000000','manual-custody',false)
    expect(await hasQualifyingDeposit(db,id)).toBe(false)
    await db.query("UPDATE app.deposits SET state='manual_review',reason_code='test_review' WHERE id=$1",[deposit.depositId])
    expect(await hasQualifyingDeposit(db,id)).toBe(false)
    await db.query("UPDATE app.deposits SET state='rejected',reason_code='test_rejected' WHERE id=$1",[deposit.depositId])
    expect(await hasQualifyingDeposit(db,id)).toBe(false)
    await db.query("UPDATE app.deposits SET state='credited',credited_at=now(),reason_code=NULL WHERE id=$1",[deposit.depositId])
    expect(await hasQualifyingDeposit(db,id)).toBe(false)
    const actual=await user();const confirmed=await realDeposit(db,actual)
    await db.query("UPDATE app.chain_transactions SET state='confirming' WHERE id=$1",[confirmed.chainId])
    expect(await hasQualifyingDeposit(db,actual)).toBe(false)
  })
  it('rejects an unqualified recipient without transfer rows or changing the sender balance', async () => {
    const sender = await user(), recipient = await user(); await realDeposit(db, sender, '500000000')
    const transfer = input(sender, recipient)
    await expect(bridge.postInternalTransfer(transfer)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WALLET_TRANSFER_DEPOSIT_REQUIRED' }) })
    expect((await db.query('SELECT id FROM app.internal_transfers WHERE id=$1', [transfer.id])).length).toBe(0)
    const [balance] = await db.query(`SELECT b.current_atomic_balance::text AS amount FROM app.ledger_account_balances b JOIN app.ledger_accounts a ON a.id=b.account_id WHERE a.user_id=$1 AND a.purpose='available'`, [sender])
    expect(balance.amount).toBe('500000000')
  })
  it('replays a completed eligible transfer without reapplying the new-receipt rule or double credit', async () => {
    const sender = await user(), recipient = await user(); await realDeposit(db, sender, '500000000')
    const deposit = await realDeposit(db, recipient)
    const transfer = input(sender, recipient)
    expect((await bridge.postInternalTransfer(transfer)).created).toBe(true)
    await db.query("UPDATE app.chain_transactions SET state='reorged' WHERE id=$1", [deposit.chainId])
    expect(await bridge.postInternalTransfer(transfer)).toEqual({ id: transfer.id, created: false })
    await expect(bridge.postInternalTransfer({ ...transfer, atomicAmount: '2000000' })).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_IDEMPOTENCY_CONFLICT'})})
  })
  it('waits for a concurrent reversal and rechecks after its commit', async () => {
    const sender = await user(), recipient = await user(); await realDeposit(db, sender, '500000000')
    const deposit = await realDeposit(db, recipient)
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    try {
      await reverseDeposit(runner, deposit.transactionId)
      const pending = bridge.postInternalTransfer(input(sender, recipient))
      // The reversal is uncommitted; transfer eligibility must not use its earlier snapshot.
      await new Promise(resolve => setTimeout(resolve, 100))
      await runner.commitTransaction()
      await expect(pending).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_TRANSFER_DEPOSIT_REQUIRED'})})
    } finally { await runner.release() }
  })
  it('commits all five concurrent failures, locks account-wide and only expires at server time', async () => {
    const id = await user(); await setup(id)
    const result = await Promise.allSettled(Array.from({ length: 5 }, () => pin.verifyWithdrawal(id, '999999')))
    expect(result.every(item => item.status === 'rejected')).toBe(true)
    const state = await pin.status(id)
    expect(state.remainingAttempts).toBe(0); expect(state.lockedUntil).not.toBeNull()
    const remaining = Date.parse(state.lockedUntil!) - Date.parse(state.serverTime)
    expect(remaining).toBeGreaterThan(14 * 60 * 1000); expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000)
    await expect(pin.verifyWithdrawal(id, '012345')).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_LOCKED'})})
    await db.query("UPDATE app.transaction_password_credentials SET locked_until=clock_timestamp()-interval '1 second' WHERE user_id=$1", [id])
    expect(await pin.verifyWithdrawal(id, '012345')).toBe(1)
    expect((await pin.status(id)).remainingAttempts).toBe(5)
  })
  it('reset increments credential version and forces 24h withdrawal pause; changing cannot clear it', async () => {
    const id = await user(); await setup(id)
    expect(await pin.verifyWithdrawal(id, '012345')).toBe(1)
    const result = await pin.reset(actor(id), {pin:'987650',confirmation:'987650',reauthentication:'test-strong-auth'},randomUUID())
    expect(Date.parse(result.withdrawalBlockedUntil!) - Date.parse(result.serverTime)).toBe(24 * 60 * 60 * 1000)
    await expect(pin.verifyWithdrawal(id, '987650')).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_COOLDOWN'})})
    const changed = await pin.change(actor(id), {currentPin:'987650',pin:'112233',confirmation:'112233',reauthentication:'test-strong-auth'}, randomUUID())
    expect(changed.withdrawalBlockedUntil).toBe(result.withdrawalBlockedUntil)
    await db.query("UPDATE app.transaction_password_credentials SET withdrawal_blocked_until=clock_timestamp()-interval '1 second' WHERE user_id=$1", [id])
    expect(await pin.verifyWithdrawal(id, '112233')).toBe(3)
    expect(security.assertRecentStepUp).toHaveBeenCalled()
  })
  it('rejects missing PIN and configuration instead of enabling a demo bypass', async () => {
    const id = await user(); await setup(id)
    await expect(pin.verifyWithdrawal(id)).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_REQUIRED'})})
    const unavailable = new TransactionPinService(db,new ConfigService({}),security as never)
    expect((await unavailable.status(id)).available).toBe(false)
    await expect(unavailable.verifyWithdrawal(id,'012345')).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_UNAVAILABLE'})})
  })
  it('refuses PIN recovery without strong authentication and never overwrites the credential', async () => {
    const id = await user(); await setup(id)
    security.assertRecentStepUp.mockImplementationOnce(() => { throw new Error('STEP_UP_REQUIRED') })
    await expect(pin.reset(actor(id), {pin:'112233',confirmation:'112233',reauthentication:''},randomUUID())).rejects.toThrow('STEP_UP_REQUIRED')
    expect(await pin.verifyWithdrawal(id,'012345')).toBe(1)
    expect((await pin.status(id)).withdrawalBlockedUntil).toBeNull()
  })
  it('refuses migration rollback with credentials and retains all password security history', async () => {
    const id = await user(); await setup(id)
    await pin.reset(actor(id), { pin: '112233', confirmation: '112233', reauthentication: 'test-strong-auth' }, randomUUID())
    const [before] = await db.query('SELECT * FROM app.transaction_password_credentials WHERE user_id=$1', [id])
    const runner = db.createQueryRunner(); await runner.connect(); await runner.startTransaction()
    try {
      await expect(new TransactionPassword1791619200000().down(runner)).rejects.toThrow('credential and cooldown history is retained')
    } finally { await runner.rollbackTransaction(); await runner.release() }
    const [after] = await db.query('SELECT * FROM app.transaction_password_credentials WHERE user_id=$1', [id])
    expect(after).toEqual(before)
    expect((await pin.status(id)).withdrawalBlockedUntil).not.toBeNull()
  })
  it('locks funds once and rejects stale authorization and changed withdrawal intent', async () => {
    const id = await user(); const deposit = await realDeposit(db,id,'500000000'); await setup(id)
    const version = await pin.verifyWithdrawal(id,'012345')
    const withdraw = { id:randomUUID(),userId:id,walletId:deposit.walletId,network:'tron' as const,atomicAmount:'1000000',feeAtomicAmount:'1000',
      destinationHash:Buffer.from('test-destination'),destinationCiphertext:Buffer.from('encrypted'),encryptionKeyVersion:1,addressBookEntryId:null,
      policySnapshot:{version:1},perTransactionLimitAtomic:null,dailyLimitAtomic:null,idempotencyKey:randomUUID(),state:'risk_review' as const,
      reasonCode:null,requestId:randomUUID(),transactionPinVersion:version }
    const results = await Promise.all([bridge.createWithdrawalWithLock(withdraw),bridge.createWithdrawalWithLock({...withdraw,id:randomUUID()})])
    expect(results.filter(item => item.created)).toHaveLength(1)
    await pin.change(actor(id),{currentPin:'012345',pin:'112233',confirmation:'112233',reauthentication:'test-strong-auth'},randomUUID())
    await expect(bridge.createWithdrawalWithLock({...withdraw,id:randomUUID(),idempotencyKey:randomUUID()})).rejects.toMatchObject({response:expect.objectContaining({code:'TRANSACTION_PIN_CONFLICT'})})
    await expect(bridge.createWithdrawalWithLock({...withdraw,atomicAmount:'2000000'})).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_IDEMPOTENCY_CONFLICT'})})
    await expect(bridge.createWithdrawalWithLock({...withdraw,destinationHash:Buffer.from('other')})).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_IDEMPOTENCY_CONFLICT'})})
    await expect(bridge.createWithdrawalWithLock({...withdraw,network:'arbitrum'})).rejects.toMatchObject({response:expect.objectContaining({code:'WALLET_IDEMPOTENCY_CONFLICT'})})
    const [balance] = await db.query(`SELECT b.current_atomic_balance::text AS amount FROM app.ledger_account_balances b JOIN app.ledger_accounts a ON a.id=b.account_id WHERE a.user_id=$1 AND a.purpose='locked'`,[id])
    expect(balance.amount).toBe('1001000')
  })
})
