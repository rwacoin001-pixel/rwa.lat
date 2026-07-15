import { MigrationInterface, QueryRunner } from 'typeorm'

export class FixRedemptionExecutionStateConstraints1783785000000 implements MigrationInterface {
  name = 'FixRedemptionExecutionStateConstraints1783785000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.redemptions
        DROP CONSTRAINT IF EXISTS redemptions_check,
        DROP CONSTRAINT IF EXISTS redemptions_check1;

      ALTER TABLE app.redemptions
        ADD CONSTRAINT redemptions_execution_timestamp_check
          CHECK ((state IN ('executing', 'completed')) = (executed_at IS NOT NULL));
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.redemptions
        DROP CONSTRAINT IF EXISTS redemptions_execution_timestamp_check;

      ALTER TABLE app.redemptions
        ADD CONSTRAINT redemptions_check
          CHECK ((state = 'executing') = (executed_at IS NOT NULL)),
        ADD CONSTRAINT redemptions_check1
          CHECK ((state = 'completed') = (executed_at IS NOT NULL));
    `)
  }
}
