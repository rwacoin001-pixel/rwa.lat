import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Remove only separation-of-person constraints; approval evidence and posting rules remain. */
export class SingleAdministratorApprovals1791532800000 implements MigrationInterface {
  name = 'SingleAdministratorApprovals1791532800000'

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conrelid, conname FROM pg_constraint WHERE contype = 'c' AND (
        (conrelid = 'app.admin_approval_requests'::regclass AND pg_get_constraintdef(oid) LIKE '%approved_by <> requested_by%') OR
        (conrelid = 'app.operational_switch_change_requests'::regclass AND pg_get_constraintdef(oid) LIKE '%decided_by <> requested_by%')
      )
      LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.conrelid::regclass, c.conname); END LOOP;
    END $$;`)
    await runner.query(`COMMENT ON TABLE app.admin_approval_requests IS 'Single-administrator approval queue; explicit decisions and audit records required'`)
  }

  async down(runner: QueryRunner): Promise<void> {
    // NOT VALID keeps existing single-operator history while enforcing the older policy on future writes.
    await runner.query(`ALTER TABLE app.admin_approval_requests ADD CONSTRAINT admin_approvals_different_approver
      CHECK (approved_by IS NULL OR approved_by <> requested_by) NOT VALID`)
    await runner.query(`ALTER TABLE app.operational_switch_change_requests ADD CONSTRAINT funds_switch_different_decider
      CHECK (decided_by IS NULL OR decided_by <> requested_by) NOT VALID`)
    await runner.query(`COMMENT ON TABLE app.admin_approval_requests IS 'Four-eyes approval queue; approved_by must differ from requested_by'`)
  }
}
