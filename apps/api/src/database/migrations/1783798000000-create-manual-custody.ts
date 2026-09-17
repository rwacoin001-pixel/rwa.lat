import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateManualCustody1783798000000 implements MigrationInterface {
  name = 'CreateManualCustody1783798000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.deposit_pool_addresses (
        id uuid PRIMARY KEY,
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code = 'USDT'),
        asset_decimals smallint NOT NULL DEFAULT 6 CHECK (asset_decimals = 6),
        address_hash bytea NOT NULL,
        address_ciphertext bytea NOT NULL,
        private_key_ciphertext bytea,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        key_held boolean NOT NULL,
        state text NOT NULL DEFAULT 'available' CHECK (state IN ('available', 'assigned', 'disabled')),
        source text NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'imported')),
        assigned_user_id uuid,
        assigned_at timestamptz,
        label varchar(120),
        note text,
        last_scan_at timestamptz,
        last_seen_timestamp bigint,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        disabled_at timestamptz,
        disabled_reason varchar(240),
        CHECK (key_held = (private_key_ciphertext IS NOT NULL)),
        CHECK ((state = 'assigned') = (assigned_user_id IS NOT NULL))
      );

      CREATE UNIQUE INDEX deposit_pool_addresses_network_hash_idx
        ON app.deposit_pool_addresses (network, address_hash);
      CREATE INDEX deposit_pool_addresses_state_idx
        ON app.deposit_pool_addresses (network, state, created_at);
      CREATE UNIQUE INDEX deposit_pool_addresses_assigned_idx
        ON app.deposit_pool_addresses (network, assigned_user_id)
        WHERE state = 'assigned';
      CREATE INDEX deposit_pool_addresses_scan_idx
        ON app.deposit_pool_addresses (last_scan_at NULLS FIRST)
        WHERE state = 'assigned';

      CREATE TABLE app.withdrawal_whitelist_entries (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        network text NOT NULL CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
        note varchar(240),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_by uuid,
        revoked_at timestamptz,
        revoke_reason varchar(240),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE UNIQUE INDEX withdrawal_whitelist_active_idx
        ON app.withdrawal_whitelist_entries (user_id, network)
        WHERE state = 'active';
      CREATE INDEX withdrawal_whitelist_user_idx
        ON app.withdrawal_whitelist_entries (user_id, network, state);

      INSERT INTO app.admin_role_permissions (role_id, permission)
      SELECT id, permission
        FROM app.admin_roles
        CROSS JOIN (VALUES
          ('wallet.withdrawals.manage'),
          ('wallet.withdrawals.execute'),
          ('operations.funds.switch.manage'),
          ('operations.funds.pause')
        ) AS permissions(permission)
       WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING;

      COMMENT ON TABLE app.deposit_pool_addresses IS
        'Operator-managed manual-custody deposit address pool. Address and private keys are encrypted; assignment is one address per user and network.';
      COMMENT ON COLUMN app.deposit_pool_addresses.key_held IS
        'False when the address was imported without its private key (receive-only address).';
      COMMENT ON COLUMN app.deposit_pool_addresses.last_seen_timestamp IS
        'Block timestamp (ms) of the newest observed TRC-20 transfer used as the incremental scan cursor.';
      COMMENT ON TABLE app.withdrawal_whitelist_entries IS
        'Users whose withdrawals auto-approve into the execution queue in financial mode. Manual review applies to everyone else.';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.withdrawal_whitelist_user_idx;
      DROP INDEX IF EXISTS app.withdrawal_whitelist_active_idx;
      DROP TABLE IF EXISTS app.withdrawal_whitelist_entries;
      DROP INDEX IF EXISTS app.deposit_pool_addresses_scan_idx;
      DROP INDEX IF EXISTS app.deposit_pool_addresses_assigned_idx;
      DROP INDEX IF EXISTS app.deposit_pool_addresses_state_idx;
      DROP INDEX IF EXISTS app.deposit_pool_addresses_network_hash_idx;
      DROP TABLE IF EXISTS app.deposit_pool_addresses;
      DELETE FROM app.admin_role_permissions
       WHERE permission IN (
         'wallet.withdrawals.manage',
         'wallet.withdrawals.execute',
         'operations.funds.switch.manage',
         'operations.funds.pause'
       )
         AND role_id IN (SELECT id FROM app.admin_roles WHERE name = 'super_admin');
    `)
  }
}
