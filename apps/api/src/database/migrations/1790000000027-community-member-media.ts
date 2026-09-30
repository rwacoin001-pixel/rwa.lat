import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Community member media: replies can carry up to four images like posts, and
 * both are capped at four in the schema. Image references are API-relative
 * paths (/v1/community/media/<object id>) that resolve through object storage
 * only after the malware scan clears the object. Like X, an image-only post or
 * reply is valid, so the non-empty body check becomes "body or images".
 */
export class CommunityMemberMedia1790000000027 implements MigrationInterface {
  name = 'CommunityMemberMedia1790000000027'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.community_comments ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await queryRunner.query(`ALTER TABLE app.community_comments ADD CONSTRAINT community_comments_images_max
      CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 4)`)
    await queryRunner.query(`ALTER TABLE app.community_posts ADD CONSTRAINT community_posts_images_max
      CHECK (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) <= 4)`)
    for (const [table, max] of [['community_posts', 4000], ['community_comments', 2000]] as const) {
      await queryRunner.query(`ALTER TABLE app.${table} DROP CONSTRAINT IF EXISTS ${table}_body_check`)
      await queryRunner.query(`ALTER TABLE app.${table} ADD CONSTRAINT ${table}_body_check
        CHECK (char_length(body) <= ${max} AND (char_length(body) >= 1 OR jsonb_array_length(images) >= 1))`)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restoring the text-only rule fails while image-only rows exist; remove or edit them first.
    for (const [table, max] of [['community_posts', 4000], ['community_comments', 2000]] as const) {
      await queryRunner.query(`ALTER TABLE app.${table} DROP CONSTRAINT IF EXISTS ${table}_body_check`)
      await queryRunner.query(`ALTER TABLE app.${table} ADD CONSTRAINT ${table}_body_check CHECK (char_length(body) BETWEEN 1 AND ${max})`)
    }
    await queryRunner.query(`ALTER TABLE app.community_posts DROP CONSTRAINT IF EXISTS community_posts_images_max`)
    await queryRunner.query(`ALTER TABLE app.community_comments DROP CONSTRAINT IF EXISTS community_comments_images_max`)
    await queryRunner.query(`ALTER TABLE app.community_comments DROP COLUMN IF EXISTS images`)
  }
}
