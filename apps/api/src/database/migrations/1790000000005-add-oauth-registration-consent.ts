import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOAuthRegistrationConsent1790000000005 implements MigrationInterface {
  name = 'AddOAuthRegistrationConsent1790000000005'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.oauth_authorization_flows
        ADD COLUMN intent varchar(16) NOT NULL DEFAULT 'login',
        ADD COLUMN terms_version text,
        ADD COLUMN privacy_version text,
        ADD COLUMN consented_at timestamptz,
        ADD CONSTRAINT oauth_authorization_flows_intent_check
          CHECK (intent IN ('login', 'register')),
        ADD CONSTRAINT oauth_authorization_flows_consent_snapshot_check
          CHECK (
            (intent = 'login' AND terms_version IS NULL AND privacy_version IS NULL AND consented_at IS NULL)
            OR
            (intent = 'register' AND terms_version IS NOT NULL AND privacy_version IS NOT NULL AND consented_at IS NOT NULL)
          );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.oauth_authorization_flows
        DROP CONSTRAINT IF EXISTS oauth_authorization_flows_consent_snapshot_check,
        DROP CONSTRAINT IF EXISTS oauth_authorization_flows_intent_check,
        DROP COLUMN IF EXISTS consented_at,
        DROP COLUMN IF EXISTS privacy_version,
        DROP COLUMN IF EXISTS terms_version,
        DROP COLUMN IF EXISTS intent;
    `)
  }
}
