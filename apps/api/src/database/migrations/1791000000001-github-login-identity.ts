import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * GitHub sign-in: the provider was added in code (LoginIdentityKind / OAuthProviderName) but both
 * schema CHECKs still listed only the original providers, so /v1/auth/oauth/github/start failed on
 * the flow insert and a first GitHub sign-in failed on the identity insert (SQLSTATE 23514).
 */
export class GithubLoginIdentity1791000000001 implements MigrationInterface {
  name = 'GithubLoginIdentity1791000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.login_identities
        DROP CONSTRAINT IF EXISTS login_identities_kind_check,
        ADD CONSTRAINT login_identities_kind_check
          CHECK (kind IN ('email', 'google', 'github', 'x', 'external_wallet'));

      ALTER TABLE app.oauth_authorization_flows
        DROP CONSTRAINT IF EXISTS oauth_authorization_flows_provider_check,
        ADD CONSTRAINT oauth_authorization_flows_provider_check
          CHECK (provider IN ('google', 'github', 'x'));
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restoring the narrower rules fails while GitHub rows exist; revoke/remove them first.
    await queryRunner.query(`
      ALTER TABLE app.oauth_authorization_flows
        DROP CONSTRAINT IF EXISTS oauth_authorization_flows_provider_check,
        ADD CONSTRAINT oauth_authorization_flows_provider_check CHECK (provider IN ('google', 'x'));

      ALTER TABLE app.login_identities
        DROP CONSTRAINT IF EXISTS login_identities_kind_check,
        ADD CONSTRAINT login_identities_kind_check
          CHECK (kind IN ('email', 'google', 'x', 'external_wallet'));
    `)
  }
}
