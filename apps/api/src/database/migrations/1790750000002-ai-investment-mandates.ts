import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiInvestmentMandates1790750000002 implements MigrationInterface {
  name = 'AiInvestmentMandates1790750000002'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.ai_product_execution_rules (
      product_id uuid PRIMARY KEY REFERENCES app.products(id), revision integer NOT NULL CHECK (revision>0),
      state text NOT NULL CHECK(state IN ('enabled','disabled')), content jsonb NOT NULL,
      terms_knowledge_id uuid NOT NULL, terms_revision integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid NOT NULL,
      FOREIGN KEY (terms_knowledge_id,terms_revision) REFERENCES app.ai_knowledge_versions(item_id,revision)
    );
    CREATE TABLE app.ai_investment_mandates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES app.users(id),
      revision integer NOT NULL CHECK(revision>0),status text NOT NULL CHECK(status IN ('active','paused','revoked')),
      content jsonb NOT NULL,terms_version text NOT NULL,confirmed_at timestamptz NOT NULL,
      confirmation_session_id uuid NOT NULL,managed_cash_atomic numeric(78,0) NOT NULL CHECK(managed_cash_atomic>=0),
      nonreinvestable_cash_atomic numeric(78,0) NOT NULL DEFAULT 0 CHECK(nonreinvestable_cash_atomic>=0 AND nonreinvestable_cash_atomic<=managed_cash_atomic),
      next_check_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX ai_mandates_due ON app.ai_investment_mandates(next_check_at) WHERE status='active';
    CREATE TABLE app.ai_investment_mandate_versions (
      mandate_id uuid NOT NULL REFERENCES app.ai_investment_mandates(id),revision integer NOT NULL CHECK(revision>0),
      content jsonb NOT NULL,status text NOT NULL,terms_version text NOT NULL,change_kind text NOT NULL,
      confirmed_at timestamptz NOT NULL DEFAULT now(),session_id uuid,PRIMARY KEY(mandate_id,revision)
    );
    CREATE TABLE app.ai_managed_positions (
      mandate_id uuid NOT NULL REFERENCES app.ai_investment_mandates(id),product_id uuid NOT NULL REFERENCES app.products(id),
      asset_code text NOT NULL,asset_decimals integer NOT NULL CHECK(asset_decimals BETWEEN 0 AND 30),
      quantity_atomic numeric(78,0) NOT NULL CHECK(quantity_atomic>=0),cost_atomic numeric(78,0) NOT NULL CHECK(cost_atomic>=0),
      PRIMARY KEY(mandate_id,product_id)
    );
    CREATE TABLE app.ai_automatic_runs (
      id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES app.users(id),mandate_id uuid NOT NULL REFERENCES app.ai_investment_mandates(id),
      mandate_revision integer NOT NULL,idempotency_key varchar(128) NOT NULL,
      state text NOT NULL CHECK(state IN ('generating','ready','selling','waiting_redemptions','buying','waiting_orders','completed','no_change','failed','attention','paused','canceled')),
      snapshot jsonb,result jsonb,model text,failure_code text,resolution_note text,
      lease_token uuid,lease_until timestamptz,buys_prepared boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(mandate_id,idempotency_key)
    );
    CREATE UNIQUE INDEX ai_run_one_active ON app.ai_automatic_runs(mandate_id)
      WHERE state IN ('generating','ready','selling','waiting_redemptions','buying','waiting_orders','attention','paused');
    CREATE INDEX ai_runs_work ON app.ai_automatic_runs(updated_at) WHERE state IN ('ready','selling','waiting_redemptions','buying','waiting_orders','attention','paused','generating');
    CREATE TABLE app.ai_automatic_legs (
      id uuid PRIMARY KEY,run_id uuid NOT NULL REFERENCES app.ai_automatic_runs(id),product_id uuid NOT NULL REFERENCES app.products(id),
      kind text NOT NULL CHECK(kind IN ('buy','redeem')),state text NOT NULL CHECK(state IN ('planned','submitted','settled','failed','canceled')),
      notional_atomic numeric(78,0) NOT NULL CHECK(notional_atomic>0),quantity_atomic numeric(78,0),
      fee_estimate_atomic numeric(78,0),rule_revision integer NOT NULL,order_id uuid UNIQUE REFERENCES app.orders(id),
      redemption_id uuid UNIQUE REFERENCES app.redemptions(id),actual_amount_atomic numeric(78,0),actual_quantity_atomic numeric(78,0),
      created_at timestamptz NOT NULL DEFAULT now(),submitted_at timestamptz,applied_at timestamptz,
      CHECK((kind='buy' AND quantity_atomic IS NULL) OR (kind='redeem' AND quantity_atomic>0)),
      CHECK(NOT(order_id IS NOT NULL AND redemption_id IS NOT NULL)),UNIQUE(run_id,product_id,kind)
    );
    CREATE INDEX ai_legs_turnover ON app.ai_automatic_legs(submitted_at) WHERE submitted_at IS NOT NULL;
    CREATE FUNCTION app.ai_mandate_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Confirmed mandate versions are immutable'; END $$;
    CREATE TRIGGER ai_mandate_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON app.ai_investment_mandate_versions
      FOR EACH STATEMENT EXECUTE FUNCTION app.ai_mandate_version_immutable();`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE app.ai_automatic_legs; DROP TABLE app.ai_automatic_runs; DROP TABLE app.ai_managed_positions;
      DROP TABLE app.ai_investment_mandate_versions; DROP FUNCTION app.ai_mandate_version_immutable(); DROP TABLE app.ai_investment_mandates; DROP TABLE app.ai_product_execution_rules;`)
  }
}
