import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { WalletLedgerBridge } from '../../src/wallet/wallet-ledger.bridge'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('internal wallet transfers (PostgreSQL)', () => {
  let dataSource: DataSource
  let bridge: WalletLedgerBridge

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
    bridge = new WalletLedgerBridge(dataSource)
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  async function createUser() {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    return user.id as string
  }

  async function seedAvailableBalance(userId: string, atomicAmount: string) {
    const [userAccount] = await dataSource.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
      [userId],
    )
    const [platformAccount] = await dataSource.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
       VALUES ('platform', $1, 'settlement', 'USDT', 6, 'debit', true) RETURNING id`,
      [`test-transfer-funding:${randomUUID()}`],
    )
    const [funding] = await dataSource.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id,
         reason_code, actor_type, effective_at)
       VALUES ('adjustment', $1, $2, 'test_fixture', $3,
               'integration_test_funding', 'service', now()) RETURNING id`,
      [`test-transfer-funding:${randomUUID()}`, randomUUID(), randomUUID()],
    )
    await dataSource.query(
      `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
       VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
      [funding.id, platformAccount.id, userAccount.id, atomicAmount],
    )
    return userAccount.id as string
  }

  async function transferRows(input: { id: string; requestId: string }) {
    const [row] = await dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM app.internal_transfers WHERE id = $1) AS transfer_count,
         (SELECT COUNT(*)::int FROM app.ledger_transactions WHERE idempotency_key = $2) AS transaction_count,
         (SELECT COUNT(*)::int FROM app.audit_logs WHERE request_id = $3) AS audit_count`,
      [input.id, `internal-transfer:${input.id}`, input.requestId],
    )
    return row as { transfer_count: number; transaction_count: number; audit_count: number }
  }

  async function balances(userIds: string[]) {
    const rows = await dataSource.query(
      `SELECT a.user_id, b.current_atomic_balance::text AS amount
       FROM app.ledger_accounts a
       JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.user_id = ANY($1::uuid[]) AND a.purpose = 'available' AND a.asset_code = 'USDT'
       ORDER BY a.user_id`,
      [userIds],
    )
    return Object.fromEntries(rows.map((row: { user_id: string; amount: string }) => [row.user_id, row.amount])) as Record<string, string>
  }

  it('rejects an unavailable recipient without persisting transfer or ledger records', async () => {
    const senderUserId = await createUser()
    const input = {
      id: randomUUID(),
      senderUserId,
      recipientUserId: randomUUID(),
      atomicAmount: '1000000',
      idempotencyKey: `transfer:${randomUUID()}`,
      requestId: `request:${randomUUID()}`,
    }

    await expect(bridge.postInternalTransfer(input)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WALLET_TRANSFER_RECIPIENT_UNAVAILABLE' }),
    })
    await expect(transferRows(input)).resolves.toEqual({ transfer_count: 0, transaction_count: 0, audit_count: 0 })
  })

  it('rolls back the transfer when the sender balance is insufficient', async () => {
    const senderUserId = await createUser()
    const recipientUserId = await createUser()
    await seedAvailableBalance(senderUserId, '1000000')
    const input = {
      id: randomUUID(),
      senderUserId,
      recipientUserId,
      atomicAmount: '1000001',
      idempotencyKey: `transfer:${randomUUID()}`,
      requestId: `request:${randomUUID()}`,
    }

    await expect(bridge.postInternalTransfer(input)).rejects.toMatchObject({ code: '23514' })
    await expect(transferRows(input)).resolves.toEqual({ transfer_count: 0, transaction_count: 0, audit_count: 0 })
    await expect(balances([senderUserId, recipientUserId])).resolves.toEqual({ [senderUserId]: '1000000' })
  })

  it('posts a balanced transfer and replays only the same intent without duplicate entries', async () => {
    const senderUserId = await createUser()
    const recipientUserId = await createUser()
    await seedAvailableBalance(senderUserId, '5000000')
    const input = {
      id: randomUUID(),
      senderUserId,
      recipientUserId,
      atomicAmount: '1250000',
      idempotencyKey: `transfer:${randomUUID()}`,
      requestId: `request:${randomUUID()}`,
    }

    await expect(bridge.postInternalTransfer(input)).resolves.toEqual({ id: input.id, created: true })
    await expect(bridge.postInternalTransfer(input)).resolves.toEqual({ id: input.id, created: false })
    await expect(
      dataSource.query(
        `SELECT COUNT(*)::int AS entry_count,
                SUM(CASE WHEN side = 'debit' THEN atomic_amount ELSE -atomic_amount END)::text AS net_amount
         FROM app.ledger_entries
         WHERE transaction_id = (
           SELECT id FROM app.ledger_transactions WHERE idempotency_key = $1
         )`,
        [`internal-transfer:${input.id}`],
      ),
    ).resolves.toEqual([{ entry_count: 2, net_amount: '0' }])
    await expect(transferRows(input)).resolves.toEqual({ transfer_count: 1, transaction_count: 1, audit_count: 1 })
    await expect(balances([senderUserId, recipientUserId])).resolves.toEqual({
      [senderUserId]: '3750000',
      [recipientUserId]: '1250000',
    })

    await expect(
      bridge.postInternalTransfer({ ...input, recipientUserId: randomUUID() }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'WALLET_IDEMPOTENCY_CONFLICT' }) })
    await expect(transferRows(input)).resolves.toEqual({ transfer_count: 1, transaction_count: 1, audit_count: 1 })
  })
})
