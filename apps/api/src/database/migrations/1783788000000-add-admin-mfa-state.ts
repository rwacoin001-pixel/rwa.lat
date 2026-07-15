import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdminMfaState1783788000000 implements MigrationInterface {
  name = 'AddAdminMfaState1783788000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.admin_users
        ADD COLUMN mfa_state varchar NOT NULL DEFAULT 'disabled',
        ADD CONSTRAINT admin_users_mfa_state_check CHECK (mfa_state IN ('disabled', 'pending', 'enabled'));
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.admin_users
        DROP CONSTRAINT IF EXISTS admin_users_mfa_state_check,
        DROP COLUMN IF EXISTS mfa_state;
    `)
  }
}
