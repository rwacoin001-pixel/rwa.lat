import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Circles stage 1 (2026-11-01): a permanent 6-digit public number, a "findable by name" switch, a pinned post, per-member
 * mute / silence, and a flag that lets a circle post also appear in the public feeds. Additive: new columns with defaults
 * (existing circles get a random number), one new table, and trigram indexes for name / post search.
 *
 * The trigram indexes need the pg_trgm extension. If the database role may not create it, the indexes are skipped
 * (search then falls back to plain ILIKE scans, which is fine at this size) and the migration still succeeds.
 */
export class CommunityCirclesStage11793600000000 implements MigrationInterface {
  name = 'CommunityCirclesStage11793600000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.community_circles
        ADD COLUMN public_no integer,
        ADD COLUMN searchable boolean NOT NULL DEFAULT true,
        ADD COLUMN pinned_post_id uuid REFERENCES app.community_posts(id) ON DELETE SET NULL;
      CREATE UNIQUE INDEX community_circles_public_no_key ON app.community_circles(public_no);
      DO $$
      DECLARE r record; candidate integer;
      BEGIN
        FOR r IN SELECT id FROM app.community_circles WHERE public_no IS NULL LOOP
          LOOP
            candidate := 100000 + floor(random() * 900000)::integer;
            BEGIN
              UPDATE app.community_circles SET public_no = candidate WHERE id = r.id;
              EXIT;
            EXCEPTION WHEN unique_violation THEN
              -- try another number
            END;
          END LOOP;
        END LOOP;
      END $$;
      ALTER TABLE app.community_circles ALTER COLUMN public_no SET NOT NULL;
      ALTER TABLE app.community_circles ADD CONSTRAINT community_circles_public_no_range CHECK (public_no BETWEEN 100000 AND 999999);
      ALTER TABLE app.community_posts ADD COLUMN circle_only boolean NOT NULL DEFAULT true;
      CREATE TABLE app.community_circle_member_settings (
        circle_id uuid NOT NULL REFERENCES app.community_circles(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        muted boolean NOT NULL DEFAULT false,
        silenced boolean NOT NULL DEFAULT false,
        silenced_at timestamptz,
        PRIMARY KEY (circle_id, user_id)
      );
      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS community_circles_name_trgm ON app.community_circles USING gin (name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS community_posts_circle_body_trgm ON app.community_posts USING gin (body gin_trgm_ops) WHERE circle_id IS NOT NULL;
      EXCEPTION WHEN insufficient_privilege OR undefined_file OR feature_not_supported THEN
        RAISE NOTICE 'pg_trgm is not available; circle search will use plain ILIKE';
      END $$;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    // Never silently drop a post that was made visible to the public, or a pinned post choice, on rollback.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.community_posts WHERE circle_id IS NOT NULL AND circle_only = false) THEN
        RAISE EXCEPTION 'Make synced circle posts circle-only (or export them) before reverting the circles stage 1 migration';
      END IF;
    END $$`)
    await q.query(`
      DROP INDEX IF EXISTS app.community_posts_circle_body_trgm;
      DROP INDEX IF EXISTS app.community_circles_name_trgm;
      DROP TABLE app.community_circle_member_settings;
      ALTER TABLE app.community_posts DROP COLUMN circle_only;
      ALTER TABLE app.community_circles DROP CONSTRAINT community_circles_public_no_range;
      DROP INDEX app.community_circles_public_no_key;
      ALTER TABLE app.community_circles DROP COLUMN pinned_post_id, DROP COLUMN searchable, DROP COLUMN public_no;
    `)
  }
}
