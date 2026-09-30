import type { MigrationInterface, QueryRunner } from 'typeorm'

export class EmailCodeChallenges1790000000021 implements MigrationInterface {
  name = 'EmailCodeChallenges1790000000021'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.email_code_challenges (
      id uuid PRIMARY KEY,
      identifier_hash bytea NOT NULL,
      user_id uuid REFERENCES app.users(id),
      intent varchar NOT NULL CHECK (intent IN ('login', 'register')),
      code_hash bytea NOT NULL,
      attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX email_code_challenges_identifier_idx ON app.email_code_challenges(identifier_hash, created_at DESC);`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE app.email_code_challenges')
  }
}
