import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddEligibilityProfileCreatedAt1783782000000 implements MigrationInterface {
  name = 'AddEligibilityProfileCreatedAt1783782000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.eligibility_profiles
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.eligibility_profiles
        DROP COLUMN IF EXISTS created_at;
    `)
  }
}
