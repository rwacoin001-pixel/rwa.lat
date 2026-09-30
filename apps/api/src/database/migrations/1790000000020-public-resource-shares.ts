import type { MigrationInterface, QueryRunner } from 'typeorm'
export class PublicResourceShares1790000000020 implements MigrationInterface {
  name='PublicResourceShares1790000000020'
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE app.public_resource_shares(id uuid PRIMARY KEY,token_hash char(64) NOT NULL UNIQUE,creator_id uuid NOT NULL REFERENCES app.users(id),kind text NOT NULL CHECK(kind IN ('product','community_post')),resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz);
      CREATE INDEX public_resource_shares_creator_idx ON app.public_resource_shares(creator_id,created_at DESC);`)
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE app.public_resource_shares') }
}
