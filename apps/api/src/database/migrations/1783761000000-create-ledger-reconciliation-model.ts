import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateLedgerReconciliationModel1783761000000 implements MigrationInterface {
  name = 'CreateLedgerReconciliationModel1783761000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.reconciliation_runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text NOT NULL,
        network text CHECK (network IN ('tron', 'ethereum', 'arbitrum')),
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        expected_atomic_balance app.atomic_unit_amount NOT NULL,
        observed_atomic_balance app.atomic_unit_amount NOT NULL,
        difference_atomic_amount app.atomic_unit_amount NOT NULL,
        state text NOT NULL CHECK (state IN ('running', 'matched', 'differences_found', 'failed')),
        source_reference text NOT NULL,
        request_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        error_code text,
        UNIQUE (provider, network, asset_code, period_start, period_end, source_reference),
        CHECK (period_end > period_start),
        CHECK (difference_atomic_amount = observed_atomic_balance - expected_atomic_balance),
        CHECK ((state = 'running') = (completed_at IS NULL)),
        CHECK (state <> 'failed' OR error_code IS NOT NULL)
      );

      CREATE TABLE app.reconciliation_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_run_id uuid NOT NULL REFERENCES app.reconciliation_runs(id) ON DELETE RESTRICT,
        ledger_account_id uuid NOT NULL REFERENCES app.ledger_accounts(id) ON DELETE RESTRICT,
        difference_atomic_amount app.atomic_unit_amount NOT NULL CHECK (difference_atomic_amount <> 0),
        state text NOT NULL DEFAULT 'open'
          CHECK (state IN ('open', 'investigating', 'resolved', 'accepted_variance')),
        reason_code text NOT NULL,
        evidence jsonb NOT NULL DEFAULT '{}',
        resolution_ledger_transaction_id uuid UNIQUE REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        opened_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        UNIQUE (reconciliation_run_id, ledger_account_id),
        CHECK (jsonb_typeof(evidence) = 'object'),
        CHECK ((state IN ('resolved', 'accepted_variance')) = (resolved_at IS NOT NULL)),
        CHECK (state <> 'resolved' OR resolution_ledger_transaction_id IS NOT NULL)
      );

      CREATE TABLE app.ledger_adjustment_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_account_id uuid NOT NULL REFERENCES app.ledger_accounts(id) ON DELETE RESTRICT,
        side text NOT NULL CHECK (side IN ('debit', 'credit')),
        atomic_amount app.atomic_unit_amount NOT NULL CHECK (atomic_amount > 0),
        reason_code text NOT NULL,
        evidence jsonb NOT NULL DEFAULT '{}',
        state text NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'approved', 'rejected', 'posted')),
        requested_by uuid NOT NULL,
        approved_by uuid,
        request_id text NOT NULL,
        posted_ledger_transaction_id uuid UNIQUE REFERENCES app.ledger_transactions(id) ON DELETE RESTRICT,
        requested_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz,
        posted_at timestamptz,
        CHECK (jsonb_typeof(evidence) = 'object'),
        CHECK (approved_by IS NULL OR approved_by <> requested_by),
        CHECK ((state IN ('approved', 'rejected', 'posted')) = (decided_at IS NOT NULL)),
        CHECK ((state = 'posted') = (posted_at IS NOT NULL)),
        CHECK (state <> 'posted' OR posted_ledger_transaction_id IS NOT NULL),
        CHECK (state NOT IN ('approved', 'posted') OR approved_by IS NOT NULL)
      );

      CREATE INDEX reconciliation_runs_provider_created_idx
        ON app.reconciliation_runs(provider, created_at DESC);
      CREATE INDEX reconciliation_cases_state_opened_idx
        ON app.reconciliation_cases(state, opened_at DESC);
      CREATE INDEX ledger_adjustment_requests_state_requested_idx
        ON app.ledger_adjustment_requests(state, requested_at DESC);

      COMMENT ON TABLE app.reconciliation_cases IS
        'Differences create cases; they never mutate ledger balances directly';
      COMMENT ON TABLE app.ledger_adjustment_requests IS
        'Four-eyes approval request. Posting must create a new immutable ledger transaction';
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.ledger_adjustment_requests;
      DROP TABLE IF EXISTS app.reconciliation_cases;
      DROP TABLE IF EXISTS app.reconciliation_runs;
    `)
  }
}
