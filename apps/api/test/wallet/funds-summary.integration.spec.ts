import type { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { buildDatabaseOptions } from '../../src/database/database-options'
import { FundsSummaryService } from '../../src/wallet/funds-summary.service'
import type { ManualCustodyAdapter } from '../../src/wallet/manual/manual-custody.adapter'
import type { TronClientService } from '../../src/wallet/manual/tron-client.service'
import { realDeposit } from './funds-security-fixture'

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip

describeDatabase('funds summary (PostgreSQL)', () => {
  let db: DataSource
  let funds: FundsSummaryService

  beforeAll(async () => {
    db = new DataSource(buildDatabaseOptions({ ...process.env, NODE_ENV: 'test' }))
    await db.initialize()
    await db.runMigrations({ transaction: 'all' })
    funds = new FundsSummaryService(
      db,
      { getHotWalletAddress: () => null } as unknown as ManualCustodyAdapter,
      {} as TronClientService,
      { get: () => 'stub' } as unknown as ConfigService,
    )
  })

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy()
  })

  it('reports ledger cash, today’s credited deposits and a balance line ending at the current total', async () => {
    const before = await funds.summary(7)
    const [user] = await db.query(`INSERT INTO app.users DEFAULT VALUES RETURNING id`)
    await realDeposit(db, user.id, '3000000')
    await realDeposit(db, user.id, '5000000')
    const after = await funds.summary(7)

    expect(BigInt(after.balances.cashAtomic) - BigInt(before.balances.cashAtomic)).toBe(8000000n)
    expect(BigInt(after.balances.availableAtomic) - BigInt(before.balances.availableAtomic)).toBe(8000000n)
    expect(after.balances.fundedUsers).toBe(before.balances.fundedUsers + 1)
    expect(after.today.deposits.count - before.today.deposits.count).toBe(2)
    expect(BigInt(after.today.deposits.atomic) - BigInt(before.today.deposits.atomic)).toBe(8000000n)
    expect(after.allTime.deposits.count - before.allTime.deposits.count).toBe(2)

    expect(after.series).toHaveLength(7)
    const last = after.series[after.series.length - 1]
    expect(last.cashBalanceAtomic).toBe(after.balances.cashAtomic)
    const beforeLast = before.series[before.series.length - 1]
    expect(BigInt(last.depositsAtomic) - BigInt(beforeLast.depositsAtomic)).toBe(8000000n)
    // Every day's balance is non-negative and the line never exceeds today's total by more than later outflows.
    for (const day of after.series) expect(BigInt(day.cashBalanceAtomic) >= 0n).toBe(true)
  })

  it('counts pending withdrawals in review', async () => {
    const before = await funds.summary(7)
    const [row] = await db.query(`SELECT count(*)::int AS n FROM app.withdrawals WHERE state = ANY($1::text[])`, [['requested', '2fa_verified', 'risk_review', 'approved']])
    expect(before.pending.review.count).toBe(row.n)
  })
})
