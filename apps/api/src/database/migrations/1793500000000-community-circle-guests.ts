import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Circle invite links (2026-11-01): every circle gets a random invite code; people who open the link apply, and an approved
 * applicant becomes a "guest" member (their own invitees do not join). Additive: one new column (backfilled, then unique)
 * and one new table; no existing row is rewritten except the new code.
 */
export class CommunityCircleGuests1793500000000 implements MigrationInterface {
  name = 'CommunityCircleGuests1793500000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.community_circles ADD COLUMN invite_code text;
      UPDATE app.community_circles SET invite_code = left(translate(encode(
        decode(left(replace(gen_random_uuid()::text,'-',''),12) || right(replace(gen_random_uuid()::text,'-',''),12),'hex'),'base64'),'+/=','-_'),10);
      ALTER TABLE app.community_circles ALTER COLUMN invite_code SET NOT NULL;
      ALTER TABLE app.community_circles ADD CONSTRAINT community_circles_invite_code_key UNIQUE (invite_code);
      ALTER TABLE app.community_circles ADD CONSTRAINT community_circles_invite_code_shape CHECK (invite_code ~ '^[A-Za-z0-9_-]{10}$');
      CREATE TABLE app.community_circle_guests (
        circle_id uuid NOT NULL REFERENCES app.community_circles(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending','member','rejected')),
        created_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz,
        PRIMARY KEY (circle_id, user_id)
      );
      CREATE INDEX community_circle_guests_status ON app.community_circle_guests(circle_id, status);
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    // Never silently drop who was let into a circle.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.community_circle_guests) THEN
        RAISE EXCEPTION 'Export circle guests before reverting the circle guests migration';
      END IF;
    END $$`)
    await q.query(`
      DROP TABLE app.community_circle_guests;
      ALTER TABLE app.community_circles DROP CONSTRAINT community_circles_invite_code_shape;
      ALTER TABLE app.community_circles DROP COLUMN invite_code;
    `)
  }
}
