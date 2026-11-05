import type { MigrationInterface, QueryRunner } from 'typeorm'

/** A circle's short introduction (2026-11-05, user): optional, at most 120 characters, set by the owner. */
export class CircleIntro1793900000003 implements MigrationInterface {
  name = 'CircleIntro1793900000003'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.community_circles ADD COLUMN IF NOT EXISTS intro text`)
    await q.query(`DO $$ BEGIN
      ALTER TABLE app.community_circles ADD CONSTRAINT community_circles_intro_len CHECK (intro IS NULL OR char_length(intro) <= 120);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.community_circles DROP CONSTRAINT IF EXISTS community_circles_intro_len, DROP COLUMN IF EXISTS intro`)
  }
}
