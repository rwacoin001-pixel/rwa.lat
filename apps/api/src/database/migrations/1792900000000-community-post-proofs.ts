import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Ledger-verified results on community posts (2026-10-28). A post may carry one proof: a Koala Quant day that paid or a
 * prediction that won. The server resolves it from the author's own ledger rows and stores the figure it computed, so the
 * number shown under the post is never typed by the user. One ledger row can back one post only. Additive: no existing
 * table changes.
 */
export class CommunityPostProofs1792900000000 implements MigrationInterface {
  name = 'CommunityPostProofs1792900000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.community_post_proofs (
        post_id uuid PRIMARY KEY REFERENCES app.community_posts(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        kind varchar(24) NOT NULL CHECK (kind IN ('quant_day', 'prediction_win')),
        ref_id uuid NOT NULL,
        title varchar(300) NOT NULL,
        pct numeric(12, 2) NOT NULL CHECK (pct > 0),
        trade_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT community_post_proofs_once UNIQUE (kind, ref_id)
      )
    `)
    await q.query('CREATE INDEX community_post_proofs_user ON app.community_post_proofs(user_id, created_at DESC)')
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE app.community_post_proofs')
  }
}
