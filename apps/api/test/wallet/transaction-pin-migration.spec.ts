import { TransactionPassword1791619200000 } from '../../src/database/migrations/1791619200000-transaction-password'
import type { MigrationInterface, QueryRunner } from 'typeorm'

const migration: MigrationInterface = new TransactionPassword1791619200000()

describe('transaction password migration rollback', () => {
  it('allows the CI empty-table rollback only under an exclusive transactional lock', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ transaction_isolation: 'read committed' }]).mockResolvedValue([])
    await migration.down({ isTransactionActive: true, query } as unknown as QueryRunner)
    const statements = query.mock.calls.map(([sql]) => String(sql))
    expect(statements[0]).toBe('SHOW transaction_isolation')
    expect(statements[1]).toContain('ACCESS EXCLUSIVE')
    expect(statements[2]).toContain('LIMIT 1')
    expect(statements.slice(3)).toEqual([
      'DROP INDEX app.deposits_transfer_eligibility',
      'DROP TABLE app.transaction_password_credentials',
    ])
  })

  it('never deletes existing credentials, lockouts or reset cooldown history', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ transaction_isolation: 'read committed' }])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{ user_id: 'existing-account' }])
    await expect(migration.down({ isTransactionActive: true, query } as unknown as QueryRunner))
      .rejects.toThrow('credential and cooldown history is retained')
    expect(query.mock.calls.some(([sql]) => /DROP/.test(String(sql)))).toBe(false)
  })

  it('refuses a rollback without a transaction before inspecting or deleting any data', async () => {
    const query = jest.fn()
    await expect(migration.down({ isTransactionActive: false, query } as unknown as QueryRunner))
      .rejects.toThrow('requires a transaction')
    expect(query).not.toHaveBeenCalled()
  })

  it('refuses old snapshot isolation before taking a lock or deleting credentials', async () => {
    const query = jest.fn().mockResolvedValue([{ transaction_isolation: 'repeatable read' }])
    await expect(migration.down({ isTransactionActive: true, query } as unknown as QueryRunner))
      .rejects.toThrow('requires read committed isolation')
    expect(query).toHaveBeenCalledTimes(1)
  })
})
