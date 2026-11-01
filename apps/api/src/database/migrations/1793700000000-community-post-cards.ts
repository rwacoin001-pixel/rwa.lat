import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CommunityPostCards1793700000000 implements MigrationInterface {
  name = 'CommunityPostCards1793700000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.community_post_cards (
      post_id uuid PRIMARY KEY REFERENCES app.community_posts(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
      kind text NOT NULL CHECK(kind IN ('quant_day','quant_product','quant_total','holdings','prediction_bet','prediction_record','deposit','withdrawal')),
      source_refs jsonb NOT NULL, snapshot jsonb NOT NULL, visible_fields text[] NOT NULL,
      calc_version int NOT NULL CHECK(calc_version=1), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
    );
    CREATE INDEX community_post_cards_kind_created ON app.community_post_cards(kind,created_at DESC);
    -- A card/proof is inserted after its parent post. Its presence is validated by the
    -- publication service in the same transaction, not by a cross-table CHECK.
    ALTER TABLE app.community_posts DROP CONSTRAINT community_posts_body_check;
    ALTER TABLE app.community_posts ADD CONSTRAINT community_posts_body_check CHECK(char_length(body)<=4000);
    ALTER TABLE app.public_resource_shares DROP CONSTRAINT public_resource_shares_kind_check;
    ALTER TABLE app.public_resource_shares ADD CONSTRAINT public_resource_shares_kind_check CHECK(kind IN ('product','community_post','community_card'));`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM app.public_resource_shares WHERE kind='community_card';
      ALTER TABLE app.public_resource_shares DROP CONSTRAINT public_resource_shares_kind_check;
      ALTER TABLE app.public_resource_shares ADD CONSTRAINT public_resource_shares_kind_check CHECK(kind IN ('product','community_post'));
      DROP TABLE app.community_post_cards;
      ALTER TABLE app.community_posts DROP CONSTRAINT community_posts_body_check;
      -- Preserve posts that were valid attachment-only publications. Restore the old
      -- rule for new writes without deleting or rewriting those existing posts.
      ALTER TABLE app.community_posts ADD CONSTRAINT community_posts_body_check
        CHECK(char_length(body)<=4000 AND (char_length(body)>=1 OR jsonb_array_length(images)>=1)) NOT VALID;`)
  }
}
