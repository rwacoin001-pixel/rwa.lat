import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Keep the eligibility projection aligned with its TypeORM entity and service.
 * Eligibility is recomputed after KYC, sanctions, and risk decisions, so the
 * current profile is intentionally mutable while immutable audit_logs retain
 * the operational evidence trail.
 */
export class AlignEligibilityProfilePersistence1783781000000 implements MigrationInterface {
  name = 'AlignEligibilityProfilePersistence1783781000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.eligibility_profiles
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

      DROP TRIGGER IF EXISTS eligibility_profiles_immutable ON app.eligibility_profiles;
      DROP TRIGGER IF EXISTS eligibility_profiles_no_truncate ON app.eligibility_profiles;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TRIGGER eligibility_profiles_immutable
      BEFORE UPDATE OR DELETE ON app.eligibility_profiles
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TRIGGER eligibility_profiles_no_truncate
      BEFORE TRUNCATE ON app.eligibility_profiles
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();

      ALTER TABLE app.eligibility_profiles
        DROP COLUMN IF EXISTS updated_at;
    `)
  }
}
