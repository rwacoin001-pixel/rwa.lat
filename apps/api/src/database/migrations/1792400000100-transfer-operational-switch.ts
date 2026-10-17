import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Internal transfers get their own operator switch so they can be paused without pausing withdrawals.
 * Seeded enabled: transfers already run today, and a missing row would read as paused in production.
 */
export class TransferOperationalSwitch1792400000100 implements MigrationInterface {
  name = 'TransferOperationalSwitch1792400000100'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO app.operational_switches (switch_key, enabled, reason)
      VALUES ('wallet.transfers.request', true, 'Internal transfers were live before this switch existed')
      ON CONFLICT (switch_key) DO NOTHING
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM app.operational_switches WHERE switch_key = 'wallet.transfers.request'`)
  }
}
