import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Email one-time codes for transaction-password step-up: security_challenges.kind gains 'step_up_email'
 * and rows gain a wrong-guess counter (five guesses, then the challenge is locked).
 */
export class StepUpEmailChallenges1792400000000 implements MigrationInterface {
  name = 'StepUpEmailChallenges1792400000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        DROP CONSTRAINT IF EXISTS security_challenges_kind_check
    `)
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        ADD CONSTRAINT security_challenges_kind_check
        CHECK (kind IN ('passkey_registration', 'passkey_assertion', 'step_up_email'))
    `)
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        DROP CONSTRAINT IF EXISTS security_challenges_kind_check
    `)
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        ADD CONSTRAINT security_challenges_kind_check
        CHECK (kind IN ('passkey_registration', 'passkey_assertion')) NOT VALID
    `)
    await queryRunner.query(`
      ALTER TABLE app.security_challenges
        DROP COLUMN IF EXISTS attempts
    `)
    // NOT VALID: existing step_up_email rows stay as they are; only new rows are checked.
  }
}
