import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 邮箱登录（magic link）：为 identity_one_time_tokens.purpose 增加 'email_login'。
 */
export class AddEmailLoginPurpose1790000000000 implements MigrationInterface {
  name = 'AddEmailLoginPurpose1790000000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        DROP CONSTRAINT IF EXISTS identity_one_time_tokens_purpose_check
    `)
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        ADD CONSTRAINT identity_one_time_tokens_purpose_check
        CHECK (purpose IN ('email_verification', 'account_recovery', 'email_login'))
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        DROP CONSTRAINT IF EXISTS identity_one_time_tokens_purpose_check
    `)
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        ADD CONSTRAINT identity_one_time_tokens_purpose_check
        CHECK (purpose IN ('email_verification', 'account_recovery'))
    `)
  }
}
