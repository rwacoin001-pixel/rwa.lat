import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdminMfaSecret1783789000000 implements MigrationInterface {
  name = 'AddAdminMfaSecret1783789000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.admin_users ADD COLUMN mfa_secret_ciphertext text`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.admin_users DROP COLUMN IF EXISTS mfa_secret_ciphertext`)
  }
}
