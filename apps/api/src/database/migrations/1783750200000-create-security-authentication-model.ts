import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateSecurityAuthenticationModel1783750200000 implements MigrationInterface {
  name = 'CreateSecurityAuthenticationModel1783750200000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.totp_factors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'revoked')),
        label text NOT NULL DEFAULT 'Authenticator app',
        secret_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        activated_at timestamptz,
        revoked_at timestamptz,
        CHECK (jsonb_typeof(recovery_code_hashes) = 'array'),
        CHECK ((state = 'active') = (activated_at IS NOT NULL)),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE UNIQUE INDEX totp_factors_one_open_factor_per_user
        ON app.totp_factors(user_id)
        WHERE state IN ('pending', 'active');

      CREATE TABLE app.passkey_credentials (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        credential_id text NOT NULL UNIQUE,
        public_key bytea NOT NULL,
        counter bigint NOT NULL DEFAULT 0 CHECK (counter >= 0),
        transports text[] NOT NULL DEFAULT '{}',
        label text NOT NULL DEFAULT 'Passkey',
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked')),
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz,
        revoked_at timestamptz,
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE TABLE app.security_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        session_id uuid REFERENCES app.sessions(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK (kind IN ('passkey_registration', 'passkey_assertion')),
        challenge_hash bytea NOT NULL UNIQUE,
        challenge_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        CHECK (expires_at > created_at)
      );

      CREATE INDEX passkey_credentials_user_state_idx
        ON app.passkey_credentials(user_id, state, created_at DESC);
      CREATE INDEX security_challenges_user_kind_idx
        ON app.security_challenges(user_id, kind, expires_at DESC);
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.security_challenges;
      DROP TABLE IF EXISTS app.passkey_credentials;
      DROP TABLE IF EXISTS app.totp_factors;
    `)
  }
}
