import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOauthAuthorizationFlows1783795000000 implements MigrationInterface {
  name = 'AddOauthAuthorizationFlows1783795000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.oauth_authorization_flows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider varchar(16) NOT NULL CHECK (provider IN ('google', 'x')),
        state_hash bytea NOT NULL UNIQUE,
        code_verifier_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL,
        redirect_uri text NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX oauth_authorization_flows_active_idx
        ON app.oauth_authorization_flows (state_hash, expires_at)
        WHERE consumed_at IS NULL;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.oauth_authorization_flows`)
  }
}
