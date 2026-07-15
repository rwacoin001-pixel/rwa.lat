import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddFinancialWithdrawalControls1783793000000 implements MigrationInterface {
  name = 'AddFinancialWithdrawalControls1783793000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.withdrawal_address_book (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code = 'USDT'),
        label varchar(80) NOT NULL,
        address_hash bytea NOT NULL,
        address_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'revoked')),
        risk_state text NOT NULL CHECK (risk_state IN ('clear', 'manual_review', 'blocked')),
        reason_code text,
        cooldown_until timestamptz NOT NULL,
        created_from_device_id uuid REFERENCES app.devices(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz,
        revoked_at timestamptz,
        UNIQUE (user_id, network, asset_code, address_hash),
        CHECK ((state = 'active') = (activated_at IS NOT NULL)),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE INDEX withdrawal_address_book_user_state_idx
        ON app.withdrawal_address_book(user_id, state, created_at DESC);
      CREATE INDEX withdrawal_address_book_cooldown_idx
        ON app.withdrawal_address_book(cooldown_until)
        WHERE state = 'pending' AND risk_state = 'clear';

      ALTER TABLE app.withdrawals
        ADD COLUMN address_book_entry_id uuid,
        ADD COLUMN policy_snapshot jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN approved_at timestamptz,
        ADD COLUMN execution_lease_until timestamptz,
        ADD COLUMN execution_attempt_count integer NOT NULL DEFAULT 0,
        ADD CONSTRAINT withdrawals_address_book_entry_fk
          FOREIGN KEY (address_book_entry_id) REFERENCES app.withdrawal_address_book(id) ON DELETE RESTRICT,
        ADD CONSTRAINT withdrawals_execution_attempt_count_check
          CHECK (execution_attempt_count >= 0);

      CREATE INDEX withdrawals_execution_queue_idx
        ON app.withdrawals(state, execution_lease_until, requested_at)
        WHERE state IN ('approved', 'signing');
      CREATE INDEX withdrawals_user_daily_policy_idx
        ON app.withdrawals(user_id, requested_at DESC)
        WHERE state NOT IN ('rejected', 'failed', 'cancelled');

      CREATE TABLE app.withdrawal_approval_decisions (
        id uuid PRIMARY KEY,
        withdrawal_id uuid NOT NULL REFERENCES app.withdrawals(id) ON DELETE CASCADE,
        admin_user_id uuid NOT NULL REFERENCES app.admin_users(id) ON DELETE RESTRICT,
        decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
        reason_code varchar(120),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (withdrawal_id, admin_user_id)
      );

      CREATE INDEX withdrawal_approval_decisions_withdrawal_idx
        ON app.withdrawal_approval_decisions(withdrawal_id, created_at);

      COMMENT ON TABLE app.withdrawal_address_book IS
        'Encrypted withdrawal destinations. Financial mode requires a trusted-device age gate and cooldown before use.';
      COMMENT ON TABLE app.withdrawal_approval_decisions IS
        'Immutable per-admin decisions. Financial production requires at least two distinct approvals before broadcast.';
      COMMENT ON COLUMN app.withdrawals.policy_snapshot IS
        'Non-secret immutable policy inputs used when the withdrawal was accepted and funds were locked.';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.withdrawal_approval_decisions;
      DROP INDEX IF EXISTS app.withdrawals_execution_queue_idx;
      DROP INDEX IF EXISTS app.withdrawals_user_daily_policy_idx;
      ALTER TABLE app.withdrawals
        DROP CONSTRAINT IF EXISTS withdrawals_execution_attempt_count_check,
        DROP CONSTRAINT IF EXISTS withdrawals_address_book_entry_fk,
        DROP COLUMN IF EXISTS execution_attempt_count,
        DROP COLUMN IF EXISTS execution_lease_until,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS policy_snapshot,
        DROP COLUMN IF EXISTS address_book_entry_id;
      DROP TABLE IF EXISTS app.withdrawal_address_book;
    `)
  }
}
