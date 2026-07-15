import type { MigrationInterface, QueryRunner } from 'typeorm'

// API-010：持仓、收益、价格快照、历史表现和赎回
// 持仓余额复用 ledger 不可变投影（不重复造余额表）；此处仅落持仓时点快照（历史表现溯源）与赎回请求。
export class CreatePortfolioModel1783767000000 implements MigrationInterface {
  name = 'CreatePortfolioModel1783767000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.position_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        quantity_atomic_amount app.atomic_unit_amount NOT NULL,
        unit_price_atomic_amount app.atomic_unit_amount NOT NULL,
        price_snapshot_id uuid REFERENCES app.price_snapshots(id) ON DELETE SET NULL,
        currency text NOT NULL DEFAULT 'USD',
        valued_at timestamptz NOT NULL,
        captured_at timestamptz NOT NULL DEFAULT now(),
        CHECK (quantity_atomic_amount >= 0),
        CHECK (unit_price_atomic_amount >= 0)
      );

      CREATE INDEX idx_position_snapshots_user_product
        ON app.position_snapshots (user_id, product_id, captured_at DESC);

      CREATE TABLE app.redemptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        quantity_atomic_amount app.atomic_unit_amount NOT NULL CHECK (quantity_atomic_amount > 0),
        estimated_unit_price_atomic_amount app.atomic_unit_amount NOT NULL CHECK (estimated_unit_price_atomic_amount >= 0),
        currency text NOT NULL DEFAULT 'USD',
        destination_address text,
        state text NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'queued', 'executing', 'completed', 'failed', 'canceled')),
        order_id uuid,
        requested_at timestamptz NOT NULL DEFAULT now(),
        executed_at timestamptz,
        canceled_at timestamptz,
        failed_at timestamptz,
        reason_code text,
        request_id text NOT NULL,
        CHECK ((state = 'executing') = (executed_at IS NOT NULL)),
        CHECK ((state = 'completed') = (executed_at IS NOT NULL)),
        CHECK ((state = 'canceled') = (canceled_at IS NOT NULL)),
        CHECK ((state = 'failed') = (failed_at IS NOT NULL)),
        CHECK (state <> 'failed' OR reason_code IS NOT NULL),
        UNIQUE (request_id)
      );

      CREATE INDEX idx_redemptions_user_state
        ON app.redemptions (user_id, state, requested_at DESC);
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.redemptions;
      DROP TABLE IF EXISTS app.position_snapshots;
    `)
  }
}
