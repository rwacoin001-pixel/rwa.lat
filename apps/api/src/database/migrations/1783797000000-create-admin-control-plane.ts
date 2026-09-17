import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Admin control plane data.
 *
 * Product content is deliberately kept separate from the execution ledger. The
 * admin application can maintain the catalogue without granting it permission
 * to move funds. Operational switches are fail-closed and remain subject to
 * the runtime/provider gates enforced by the Core API.
 */
export class CreateAdminControlPlane1783797000000 implements MigrationInterface {
  name = 'CreateAdminControlPlane1783797000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.products
        ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS yield_terms_json jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS risk_disclosure_json jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS media_refs_json jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_by uuid;

      CREATE INDEX IF NOT EXISTS products_state_updated_idx
        ON app.products (state, updated_at DESC);

      CREATE TABLE IF NOT EXISTS app.wallet_treasury_addresses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        network varchar(32) NOT NULL,
        asset_code varchar(16) NOT NULL,
        purpose varchar(32) NOT NULL
          CHECK (purpose IN ('deposit', 'withdrawal', 'collection', 'operational')),
        label varchar(120) NOT NULL,
        address text NOT NULL,
        memo text,
        state varchar(16) NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'inactive')),
        updated_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (network, asset_code, purpose)
      );

      CREATE INDEX IF NOT EXISTS wallet_treasury_addresses_state_idx
        ON app.wallet_treasury_addresses (state, network);

      INSERT INTO app.operational_switches (switch_key, enabled, reason)
      VALUES
        ('orders.acceptance', false, 'Fail-closed until production order execution is installed'),
        ('wallet.deposits.crediting', false, 'Fail-closed until live custody and deposit monitoring are installed'),
        ('wallet.withdrawals.request', false, 'Fail-closed until live custody and withdrawal controls are installed'),
        ('yield.processing', false, 'Fail-closed until production yield processor is installed'),
        ('polymarket.trading', false, 'Fail-closed until authenticated trading execution is installed')
      ON CONFLICT (switch_key) DO NOTHING;

      INSERT INTO app.admin_role_permissions (role_id, permission)
      SELECT id, permission
        FROM app.admin_roles
        CROSS JOIN (VALUES ('operations.switches.manage'), ('wallet.addresses.manage')) AS permissions(permission)
       WHERE name = 'super_admin'
      ON CONFLICT DO NOTHING;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.wallet_treasury_addresses_state_idx;
      DROP TABLE IF EXISTS app.wallet_treasury_addresses;
      DROP INDEX IF EXISTS app.products_state_updated_idx;
      ALTER TABLE app.products
        DROP COLUMN IF EXISTS updated_by,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS media_refs_json,
        DROP COLUMN IF EXISTS risk_disclosure_json,
        DROP COLUMN IF EXISTS yield_terms_json,
        DROP COLUMN IF EXISTS metadata_json;
      DELETE FROM app.operational_switches
       WHERE switch_key IN (
         'orders.acceptance',
         'wallet.deposits.crediting',
         'wallet.withdrawals.request',
         'yield.processing',
         'polymarket.trading'
       );
      DELETE FROM app.admin_role_permissions
       WHERE permission IN ('operations.switches.manage', 'wallet.addresses.manage')
         AND role_id IN (SELECT id FROM app.admin_roles WHERE name = 'super_admin');
    `)
  }
}
