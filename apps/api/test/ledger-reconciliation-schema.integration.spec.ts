import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../src/database/database-options'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('ledger reconciliation schema', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    dataSource = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await dataSource.initialize()
    await dataSource.runMigrations({ transaction: 'all' })
  })

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy()
  })

  it('requires the recorded difference to equal observed minus expected', async () => {
    await expect(dataSource.query(
      `INSERT INTO app.reconciliation_runs
        (provider, network, asset_code, asset_decimals, period_start, period_end,
         expected_atomic_balance, observed_atomic_balance, difference_atomic_amount,
         state, source_reference, request_id, completed_at)
       VALUES ('custody-test', 'arbitrum', 'USDT', 6, now() - interval '1 day', now(),
               100, 90, 5, 'differences_found', $1, $2, now())`,
      [randomUUID(), randomUUID()],
    )).rejects.toMatchObject({ code: '23514' })
  })

  it('prevents one person from requesting and approving an adjustment', async () => {
    const [user] = await dataSource.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    const [account] = await dataSource.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') RETURNING id`,
      [user.id],
    )
    const actor = randomUUID()
    await expect(dataSource.query(
      `INSERT INTO app.ledger_adjustment_requests
        (ledger_account_id, side, atomic_amount, reason_code, state,
         requested_by, approved_by, request_id, decided_at)
       VALUES ($1, 'credit', 1, 'test_adjustment', 'approved', $2, $2, $3, now())`,
      [account.id, actor, randomUUID()],
    )).rejects.toMatchObject({ code: '23514' })
  })
})
