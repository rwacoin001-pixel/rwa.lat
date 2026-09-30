import type { MigrationInterface, QueryRunner } from 'typeorm'

export class PasswordAuthFlows1790000000023 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE app.auth_credentials (
        user_id uuid PRIMARY KEY REFERENCES app.users(id),
        password_hash text,
        password_required boolean NOT NULL DEFAULT false,
        version integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app.auth_flows (
        token_hash bytea PRIMARY KEY,
        user_id uuid REFERENCES app.users(id),
        payload_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX auth_flows_user_idx ON app.auth_flows(user_id);
      CREATE INDEX auth_flows_expiry_idx ON app.auth_flows(expires_at);
      CREATE TABLE app.auth_password_attempts (
        identifier_hash bytea PRIMARY KEY,
        attempts integer NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE app.auth_totp_uses (
        factor_id uuid NOT NULL REFERENCES app.totp_factors(id),
        time_step bigint NOT NULL,
        used_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(factor_id, time_step)
      );
    `)
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE app.auth_totp_uses, app.auth_password_attempts, app.auth_flows, app.auth_credentials')
  }
}
