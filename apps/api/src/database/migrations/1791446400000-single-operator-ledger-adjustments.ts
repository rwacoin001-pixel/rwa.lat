import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Approval policy is enforced by LEDGER_ALLOW_SELF_APPROVAL; keep immutable posting/state constraints. */
export class SingleOperatorLedgerAdjustments1791446400000 implements MigrationInterface {
  name = 'SingleOperatorLedgerAdjustments1791446400000'
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'app.ledger_adjustment_requests'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%approved_by IS NULL%approved_by <> requested_by%'
      LOOP EXECUTE format('ALTER TABLE app.ledger_adjustment_requests DROP CONSTRAINT %I', c.conname); END LOOP;
    END $$;`)
    await runner.query(`CREATE UNIQUE INDEX ledger_user_adjustment_operation_idx
      ON app.ledger_adjustment_requests(requested_by, request_id) WHERE evidence->>'origin' = 'admin-user-management'`)
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX IF EXISTS app.ledger_user_adjustment_operation_idx')
    // Retain historical, explicitly approved single-operator records while enforcing the older policy on new writes.
    await runner.query(`ALTER TABLE app.ledger_adjustment_requests ADD CONSTRAINT ledger_adjustments_different_approver
      CHECK (approved_by IS NULL OR approved_by <> requested_by) NOT VALID`)
  }
}
