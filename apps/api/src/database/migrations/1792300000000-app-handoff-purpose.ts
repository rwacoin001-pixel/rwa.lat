import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Android app sign-in through the system browser: identity_one_time_tokens.purpose gains 'app_handoff'
 * (the two-minute, PKCE-bound code the signed-in browser hands to the app). Without it the insert is rejected.
 */
export class AppHandoffPurpose1792300000000 implements MigrationInterface {
  name = 'AppHandoffPurpose1792300000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        DROP CONSTRAINT IF EXISTS identity_one_time_tokens_purpose_check
    `)
    await queryRunner.query(`
      ALTER TABLE app.identity_one_time_tokens
        ADD CONSTRAINT identity_one_time_tokens_purpose_check
        CHECK (purpose IN ('email_verification', 'account_recovery', 'email_login', 'app_handoff'))
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
        CHECK (purpose IN ('email_verification', 'account_recovery', 'email_login')) NOT VALID
    `)
    // NOT VALID: spent app_handoff rows stay as they are; only new rows are checked.
  }
}
