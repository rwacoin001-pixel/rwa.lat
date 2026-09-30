import { MigrationInterface, QueryRunner } from 'typeorm'
export class CreateRecurringInvestments1790000000013 implements MigrationInterface {
  name = 'CreateRecurringInvestments1790000000013'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.recurring_investments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id),
        product_id uuid NOT NULL REFERENCES app.products(id), amount_atomic app.atomic_unit_amount NOT NULL CHECK (amount_atomic>0),
        frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
        anchor_at timestamptz NOT NULL, next_run_at timestamptz NOT NULL,
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','cancelled')),
        consented_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(), idempotency_key varchar(128) NOT NULL,
        UNIQUE (user_id,idempotency_key)
      );
      CREATE INDEX recurring_investments_due ON app.recurring_investments(next_run_at) WHERE state='active';
      CREATE TABLE app.recurring_investment_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES app.recurring_investments(id),
        scheduled_at timestamptz NOT NULL, state text NOT NULL CHECK (state IN ('submitted','failed')),
        order_id uuid REFERENCES app.orders(id), failure_code text, completed_at timestamptz NOT NULL DEFAULT now(), notified_at timestamptz,
        UNIQUE (plan_id,scheduled_at)
      );
    `)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE app.recurring_investment_runs; DROP TABLE app.recurring_investments;')
  }
}
