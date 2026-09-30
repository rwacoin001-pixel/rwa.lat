import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateWalletSignInChallenges1790000000006 implements MigrationInterface {
  name = 'CreateWalletSignInChallenges1790000000006'
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE app.wallet_sign_in_challenges (
      message_hash bytea PRIMARY KEY, address varchar(42) NOT NULL,
      expires_at timestamptz NOT NULL, consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`)
    await runner.query('CREATE INDEX wallet_sign_in_challenges_expiry_idx ON app.wallet_sign_in_challenges (expires_at)')
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE app.wallet_sign_in_challenges')
  }
}
