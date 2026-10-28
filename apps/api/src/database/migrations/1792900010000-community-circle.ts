import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * "My circle" (2026-10-28): the people I invited (and who invited me) in Community. An invitee can hide from their
 * inviter's circle; visible by default. Only the public community profile is ever shown — never email, name or assets.
 * Additive: one column with a default, no data rewritten.
 */
export class CommunityCircle1792900010000 implements MigrationInterface {
  name = 'CommunityCircle1792900010000'

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE app.community_profiles ADD COLUMN show_to_inviter boolean NOT NULL DEFAULT true')
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE app.community_profiles DROP COLUMN show_to_inviter')
  }
}
