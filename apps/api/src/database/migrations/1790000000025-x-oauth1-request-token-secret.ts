import { MigrationInterface, QueryRunner } from 'typeorm'

export class XOAuth1RequestTokenSecret1790000000025 implements MigrationInterface {
  name = 'XOAuth1RequestTokenSecret1790000000025'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.oauth_authorization_flows
        ALTER COLUMN code_verifier_ciphertext DROP NOT NULL,
        ADD COLUMN oauth1_request_token_secret_ciphertext bytea,
        ADD CONSTRAINT oauth_authorization_flows_protocol_secret_check
          CHECK (
            (code_verifier_ciphertext IS NOT NULL AND oauth1_request_token_secret_ciphertext IS NULL)
            OR
            (provider = 'x' AND code_verifier_ciphertext IS NULL AND oauth1_request_token_secret_ciphertext IS NOT NULL)
          );
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE app.oauth_authorization_flows
         SET code_verifier_ciphertext = oauth1_request_token_secret_ciphertext,
             consumed_at = COALESCE(consumed_at, now())
       WHERE oauth1_request_token_secret_ciphertext IS NOT NULL;

      ALTER TABLE app.oauth_authorization_flows
        DROP CONSTRAINT IF EXISTS oauth_authorization_flows_protocol_secret_check,
        DROP COLUMN IF EXISTS oauth1_request_token_secret_ciphertext,
        ALTER COLUMN code_verifier_ciphertext SET NOT NULL;
    `)
  }
}
