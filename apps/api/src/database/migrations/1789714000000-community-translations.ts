import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateCommunityTranslations1789714000000 implements MigrationInterface {
  name = 'CreateCommunityTranslations1789714000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.community_posts
        ADD COLUMN lang varchar(16) NOT NULL DEFAULT 'zh-Hans';

      ALTER TABLE app.community_comments
        ADD COLUMN lang varchar(16) NOT NULL DEFAULT 'zh-Hans';

      CREATE TABLE app.community_translations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        target_type varchar(16) NOT NULL CHECK (target_type IN ('post', 'comment')),
        target_id uuid NOT NULL,
        target_lang varchar(16) NOT NULL,
        source_lang varchar(16) NOT NULL,
        body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
        provider varchar(32),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX community_translations_target_idx
        ON app.community_translations (target_type, target_id, target_lang);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.community_translations;
      ALTER TABLE app.community_comments DROP COLUMN IF EXISTS lang;
      ALTER TABLE app.community_posts DROP COLUMN IF EXISTS lang;
    `)
  }
}
