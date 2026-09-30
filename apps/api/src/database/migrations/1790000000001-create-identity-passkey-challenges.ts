import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Passkey 登录（未登录认证）：一次性挑战存储。
 */
export class CreateIdentityPasskeyChallenges1790000000001 implements MigrationInterface {
  name = 'CreateIdentityPasskeyChallenges1790000000001'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.identity_passkey_challenges (
        id uuid PRIMARY KEY,
        kind varchar NOT NULL DEFAULT 'passkey_login',
        challenge_hash bytea NOT NULL,
        challenge_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz NULL,
        CONSTRAINT identity_passkey_challenges_expiry_check CHECK (expires_at > created_at)
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_identity_passkey_challenges_lookup
        ON app.identity_passkey_challenges (id, consumed_at)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.identity_passkey_challenges`)
  }
}
