import type { MigrationInterface, QueryRunner } from 'typeorm'

export class TransactionPassword1791619200000 implements MigrationInterface {
  name = 'TransactionPassword1791619200000'
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE app.transaction_password_credentials (
      user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
      pin_hash text NOT NULL,
      credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
      failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
      locked_until timestamptz,
      withdrawal_blocked_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      reset_at timestamptz
    )`)
    await runner.query(`COMMENT ON TABLE app.transaction_password_credentials IS 'Independent withdrawal PIN; pepper is stored outside the database. Do not drop to roll back the UI.'`)
    await runner.query(`CREATE INDEX deposits_transfer_eligibility ON app.deposits(user_id, atomic_amount) WHERE state='credited' AND asset_code='USDT'`)
  }
  async down(runner: QueryRunner): Promise<void> {
    if (!runner.isTransactionActive) throw new Error('Transaction password rollback requires a transaction.')
    const [isolation] = await runner.query('SHOW transaction_isolation')
    if (isolation?.transaction_isolation !== 'read committed') {
      throw new Error('Transaction password rollback requires read committed isolation; stale snapshots cannot delete credentials.')
    }
    // Empty-table rollback permits CI run -> revert -> run; locking prevents a concurrent setup being deleted.
    await runner.query('LOCK TABLE app.transaction_password_credentials IN ACCESS EXCLUSIVE MODE')
    const rows = await runner.query('SELECT user_id FROM app.transaction_password_credentials LIMIT 1')
    if (rows.length) throw new Error('Transaction password rollback requires an explicit security migration; credential and cooldown history is retained.')
    await runner.query('DROP INDEX app.deposits_transfer_eligibility')
    await runner.query('DROP TABLE app.transaction_password_credentials')
  }
}
