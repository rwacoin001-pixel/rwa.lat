import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Own circles (2026-11-01). One live circle per owner; its members are the owner's whole referral downline (any depth)
 * minus people who left or were removed. Circle posts carry circle_id and are visible to members only.
 * Additive: two new tables and one nullable column; no existing row is rewritten.
 */
export class CommunityCircles1793400000000 implements MigrationInterface {
  name = 'CommunityCircles1793400000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.community_circles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        owner_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE RESTRICT,
        name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 20),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      );
      CREATE UNIQUE INDEX community_circles_one_live_per_owner ON app.community_circles(owner_user_id) WHERE deleted_at IS NULL;
      CREATE TABLE app.community_circle_optouts (
        circle_id uuid NOT NULL REFERENCES app.community_circles(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        reason text NOT NULL CHECK (reason IN ('left','removed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (circle_id, user_id)
      );
      CREATE INDEX community_circle_optouts_user ON app.community_circle_optouts(user_id);
      ALTER TABLE app.community_posts ADD COLUMN circle_id uuid REFERENCES app.community_circles(id) ON DELETE RESTRICT;
      CREATE INDEX community_posts_circle_feed ON app.community_posts(circle_id, published_at DESC, id DESC) WHERE circle_id IS NOT NULL;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    // Never silently erase members-only posts on rollback.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.community_posts WHERE circle_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Export or remove circle posts before reverting the circles migration';
      END IF;
    END $$`)
    await q.query(`
      DROP INDEX app.community_posts_circle_feed;
      ALTER TABLE app.community_posts DROP COLUMN circle_id;
      DROP TABLE app.community_circle_optouts;
      DROP TABLE app.community_circles;
    `)
  }
}
