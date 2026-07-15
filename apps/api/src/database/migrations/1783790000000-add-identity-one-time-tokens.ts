import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddIdentityOneTimeTokens1783790000000 implements MigrationInterface {
  name = 'AddIdentityOneTimeTokens1783790000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.identity_one_time_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        purpose varchar NOT NULL CHECK (purpose IN ('email_verification', 'account_recovery')),
        token_hash bytea NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (expires_at > created_at)
      );
      CREATE INDEX identity_one_time_tokens_active_lookup_idx
        ON app.identity_one_time_tokens (token_hash, expires_at)
        WHERE consumed_at IS NULL;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.identity_one_time_tokens`)
  }
}
