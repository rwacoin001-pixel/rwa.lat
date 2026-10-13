import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Deposit address rotation and on-demand watching for the manual-custody pool.
 *
 * - 'retired': a pool address that already received a deposit and was replaced by a fresh one.
 *   It stays bound to the same user forever (late transfers still credit them) and keeps being watched.
 *   The partial unique index on state = 'assigned' still guarantees one *current* address per user.
 * - watch_until: set when the user opens the deposit page or taps "check now"; scanned frequently until then.
 * - next_scan_at: per-address schedule for the chain watcher (NULL = due now).
 *
 * Additive only; the previous API build keeps working against this schema during deployment.
 */
export class DepositAddressRotation1791900000000 implements MigrationInterface {
  name = 'DepositAddressRotation1791900000000'

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      ADD COLUMN retired_at timestamptz,
      ADD COLUMN watch_until timestamptz,
      ADD COLUMN next_scan_at timestamptz`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses DROP CONSTRAINT deposit_pool_addresses_state_check`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      ADD CONSTRAINT deposit_pool_addresses_state_check CHECK (state IN ('available', 'assigned', 'retired', 'disabled'))`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses DROP CONSTRAINT deposit_pool_addresses_check1`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      ADD CONSTRAINT deposit_pool_addresses_owner_check CHECK ((state IN ('assigned', 'retired')) = (assigned_user_id IS NOT NULL)),
      ADD CONSTRAINT deposit_pool_addresses_retired_check CHECK ((state = 'retired') = (retired_at IS NOT NULL))`)
    await runner.query(`DROP INDEX app.deposit_pool_addresses_scan_idx`)
    await runner.query(`CREATE INDEX deposit_pool_addresses_due_idx
      ON app.deposit_pool_addresses (next_scan_at NULLS FIRST)
      WHERE state IN ('assigned', 'retired')`)
    await runner.query(`CREATE INDEX deposit_pool_addresses_owner_idx
      ON app.deposit_pool_addresses (network, assigned_user_id, assigned_at)
      WHERE state IN ('assigned', 'retired')`)
  }

  async down(runner: QueryRunner): Promise<void> {
    const [{ retired }] = await runner.query(`SELECT count(*)::int AS retired FROM app.deposit_pool_addresses WHERE state = 'retired'`)
    if (retired > 0) {
      throw new Error('Deposit address rotation cannot be rolled back after addresses were retired; retired rows still bind users to their old addresses.')
    }
    await runner.query(`DROP INDEX app.deposit_pool_addresses_owner_idx`)
    await runner.query(`DROP INDEX app.deposit_pool_addresses_due_idx`)
    await runner.query(`CREATE INDEX deposit_pool_addresses_scan_idx
      ON app.deposit_pool_addresses (last_scan_at NULLS FIRST)
      WHERE state = 'assigned'`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      DROP CONSTRAINT deposit_pool_addresses_retired_check,
      DROP CONSTRAINT deposit_pool_addresses_owner_check`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      ADD CONSTRAINT deposit_pool_addresses_check1 CHECK ((state = 'assigned') = (assigned_user_id IS NOT NULL))`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses DROP CONSTRAINT deposit_pool_addresses_state_check`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      ADD CONSTRAINT deposit_pool_addresses_state_check CHECK (state IN ('available', 'assigned', 'disabled'))`)
    await runner.query(`ALTER TABLE app.deposit_pool_addresses
      DROP COLUMN next_scan_at,
      DROP COLUMN watch_until,
      DROP COLUMN retired_at`)
  }
}
