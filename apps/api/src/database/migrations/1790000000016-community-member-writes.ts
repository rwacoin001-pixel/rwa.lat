import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CommunityMemberWrites1790000000016 implements MigrationInterface {
  name = 'CommunityMemberWrites1790000000016'
  async up(q: QueryRunner) {
    await q.query(`CREATE UNIQUE INDEX community_profiles_user_idx ON app.community_profiles(user_id) WHERE user_id IS NOT NULL;
      CREATE TABLE app.community_user_intents (
        user_id uuid NOT NULL REFERENCES app.users(id), idempotency_key uuid NOT NULL,
        request_hash char(64) NOT NULL, result_type text NOT NULL CHECK (result_type IN ('post','comment')),
        result_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,idempotency_key)
      )`)
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE app.community_user_intents; DROP INDEX app.community_profiles_user_idx') }
}
