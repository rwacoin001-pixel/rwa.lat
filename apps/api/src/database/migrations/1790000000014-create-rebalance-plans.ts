import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateRebalancePlans1790000000014 implements MigrationInterface {
  name = 'CreateRebalancePlans1790000000014'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.rebalance_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id),
        state text NOT NULL CHECK (state IN (
          'submitting_redemptions','redemptions_submitted','awaiting_buy_confirmation',
          'submitting_buys','buy_orders_submitted','completed','canceled','attention'
        )),
        targets_json jsonb NOT NULL CHECK (jsonb_typeof(targets_json) = 'array'),
        initial_value_atomic app.atomic_unit_amount NOT NULL CHECK (initial_value_atomic > 0),
        sell_proceeds_atomic app.atomic_unit_amount NOT NULL DEFAULT 0,
        idempotency_key varchar(128) NOT NULL,
        buy_idempotency_key varchar(128),
        sell_confirmed_at timestamptz NOT NULL,
        buy_confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, idempotency_key)
      );

      CREATE INDEX rebalance_plans_user_created
        ON app.rebalance_plans(user_id, created_at DESC);
      CREATE UNIQUE INDEX rebalance_plans_one_active_per_user
        ON app.rebalance_plans(user_id) WHERE state NOT IN ('completed','canceled');

      CREATE TABLE app.rebalance_legs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id uuid NOT NULL REFERENCES app.rebalance_plans(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES app.products(id),
        kind text NOT NULL CHECK (kind IN ('sell','buy')),
        target_bps integer NOT NULL CHECK (target_bps BETWEEN 0 AND 10000),
        requested_amount_atomic app.atomic_unit_amount,
        requested_quantity_atomic app.atomic_unit_amount,
        actual_amount_atomic app.atomic_unit_amount,
        state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','submitted','completed','failed')),
        redemption_id uuid REFERENCES app.redemptions(id),
        order_id uuid REFERENCES app.orders(id),
        failure_code varchar(180),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (plan_id, product_id, kind),
        CHECK (
          (kind = 'sell' AND requested_quantity_atomic IS NOT NULL AND requested_quantity_atomic > 0 AND requested_amount_atomic IS NULL)
          OR
          (kind = 'buy' AND requested_amount_atomic IS NOT NULL AND requested_amount_atomic > 0 AND requested_quantity_atomic IS NULL)
        )
      );

      CREATE INDEX rebalance_legs_plan ON app.rebalance_legs(plan_id, kind, state);
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE app.rebalance_legs; DROP TABLE app.rebalance_plans;')
  }
}
