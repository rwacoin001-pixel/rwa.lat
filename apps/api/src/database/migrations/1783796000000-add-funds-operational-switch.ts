import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFundsOperationalSwitch1783796000000 implements MigrationInterface {
  name = 'AddFundsOperationalSwitch1783796000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.operational_switches (
        switch_key varchar(80) PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
        reason text NOT NULL,
        changed_by uuid REFERENCES app.admin_users(id),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE app.operational_switch_change_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        switch_key varchar(80) NOT NULL REFERENCES app.operational_switches(switch_key),
        requested_state boolean NOT NULL,
        state varchar(16) NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'approved', 'rejected')),
        requested_by uuid NOT NULL REFERENCES app.admin_users(id),
        decided_by uuid REFERENCES app.admin_users(id),
        change_id varchar(120) NOT NULL,
        reason text NOT NULL,
        request_id varchar(128) NOT NULL,
        requested_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz,
        UNIQUE (switch_key, change_id),
        CHECK (decided_by IS NULL OR decided_by <> requested_by)
      );

      CREATE UNIQUE INDEX operational_switch_one_pending_idx
        ON app.operational_switch_change_requests (switch_key)
        WHERE state = 'requested';

      INSERT INTO app.operational_switches (switch_key, enabled, reason)
      VALUES ('wallet.withdrawals.execution', false, 'Fail-closed initial production state');
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.operational_switch_change_requests;
      DROP TABLE IF EXISTS app.operational_switches;
    `)
  }
}
