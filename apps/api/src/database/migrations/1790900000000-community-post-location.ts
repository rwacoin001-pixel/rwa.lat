import { MigrationInterface, QueryRunner } from 'typeorm'
export class CommunityPostLocation1790900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE app.community_posts ADD COLUMN IF NOT EXISTS location jsonb NULL')
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE app.community_posts DROP COLUMN IF EXISTS location')
  }
}
