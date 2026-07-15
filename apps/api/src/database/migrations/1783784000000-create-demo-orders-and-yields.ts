import type { MigrationInterface, QueryRunner } from 'typeorm'

// Functional-runthrough batches 4 and 5. These tables keep Demo trading,
// positions and distributions server-side so the H5 and Admin applications
// share durable state rather than each presenting an independent mock.
export class CreateDemoOrdersAndYields1783784000000 implements MigrationInterface {
  name = 'CreateDemoOrdersAndYields1783784000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
        side text NOT NULL CHECK (side IN ('buy', 'sell')),
        outcome_key text NOT NULL DEFAULT 'long' CHECK (outcome_key IN ('long', 'yes', 'no')),
        settlement_asset_code text NOT NULL DEFAULT 'USDT' CHECK (settlement_asset_code = 'USDT'),
        settlement_asset_decimals smallint NOT NULL DEFAULT 6 CHECK (settlement_asset_decimals = 6),
        requested_atomic_amount app.atomic_unit_amount NOT NULL CHECK (requested_atomic_amount > 0),
        fee_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (fee_atomic_amount >= 0),
        filled_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (filled_atomic_amount >= 0),
        filled_quantity_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (filled_quantity_atomic_amount >= 0),
        unit_price_atomic_amount app.atomic_unit_amount NOT NULL CHECK (unit_price_atomic_amount > 0),
        state text NOT NULL DEFAULT 'submitted' CHECK (state IN (
          'created', 'reviewing', 'submitted', 'processing', 'filled',
          'partially_filled', 'failed', 'cancelled'
        )),
        idempotency_key text NOT NULL,
        request_id text NOT NULL,
        failure_reason text,
        receipt jsonb NOT NULL DEFAULT '{}',
        submitted_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        completed_at timestamptz,
        UNIQUE (user_id, idempotency_key),
        CHECK (filled_atomic_amount <= requested_atomic_amount),
        CHECK ((state IN ('filled', 'partially_filled')) = (completed_at IS NOT NULL)),
        CHECK (state <> 'failed' OR failure_reason IS NOT NULL),
        CHECK (jsonb_typeof(receipt) = 'object')
      );

      CREATE INDEX orders_user_submitted_idx ON app.orders (user_id, submitted_at DESC);
      CREATE INDEX orders_product_state_idx ON app.orders (product_id, state, submitted_at DESC);

      CREATE TABLE app.order_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE RESTRICT,
        previous_state text,
        next_state text NOT NULL,
        actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'service')),
        actor_id uuid,
        reason_code text,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (jsonb_typeof(metadata) = 'object')
      );

      CREATE INDEX order_events_order_created_idx ON app.order_events (order_id, created_at ASC);

      CREATE TABLE app.positions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
        outcome_key text NOT NULL DEFAULT 'long' CHECK (outcome_key IN ('long', 'yes', 'no')),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        quantity_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (quantity_atomic_amount >= 0),
        cost_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (cost_atomic_amount >= 0),
        cumulative_yield_atomic_amount app.atomic_unit_amount NOT NULL DEFAULT 0 CHECK (cumulative_yield_atomic_amount >= 0),
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'settled', 'closed')),
        opened_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        settled_at timestamptz,
        UNIQUE (user_id, product_id, outcome_key),
        CHECK (state <> 'settled' OR settled_at IS NOT NULL)
      );

      CREATE INDEX positions_user_product_idx ON app.positions (user_id, product_id, updated_at DESC);

      CREATE TABLE app.yield_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE RESTRICT,
        asset_code text NOT NULL DEFAULT 'USDT' CHECK (asset_code = 'USDT'),
        asset_decimals smallint NOT NULL DEFAULT 6 CHECK (asset_decimals = 6),
        total_atomic_amount app.atomic_unit_amount NOT NULL CHECK (total_atomic_amount > 0),
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'previewed', 'approved', 'processing', 'completed', 'partially_failed')),
        request_id text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        approved_at timestamptz,
        executed_at timestamptz,
        CHECK (period_end > period_start),
        CHECK (state <> 'completed' OR executed_at IS NOT NULL)
      );

      CREATE TABLE app.yield_allocations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id uuid NOT NULL REFERENCES app.yield_batches(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        position_id uuid NOT NULL REFERENCES app.positions(id) ON DELETE RESTRICT,
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount >= 0),
        state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'credited', 'failed')),
        failure_reason text,
        credited_at timestamptz,
        UNIQUE (batch_id, user_id, position_id),
        CHECK (state <> 'credited' OR credited_at IS NOT NULL),
        CHECK (state <> 'failed' OR failure_reason IS NOT NULL)
      );

      CREATE INDEX yield_allocations_user_idx ON app.yield_allocations (user_id, batch_id);

      CREATE TABLE app.prediction_settlements (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL UNIQUE REFERENCES app.products(id) ON DELETE RESTRICT,
        outcome_key text NOT NULL CHECK (outcome_key IN ('yes', 'no', 'void')),
        request_id text NOT NULL UNIQUE,
        settled_at timestamptz NOT NULL DEFAULT now()
      );
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.prediction_settlements;
      DROP TABLE IF EXISTS app.yield_allocations;
      DROP TABLE IF EXISTS app.yield_batches;
      DROP TABLE IF EXISTS app.positions;
      DROP TABLE IF EXISTS app.order_events;
      DROP TABLE IF EXISTS app.orders;
    `)
  }
}
