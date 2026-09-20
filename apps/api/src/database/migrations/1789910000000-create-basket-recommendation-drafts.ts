import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 组合推荐草稿：保存问卷答案、推荐结果与引擎版本（可追溯、可审计）。
 */
export class CreateBasketRecommendationDrafts1789910000000 implements MigrationInterface {
  name = 'CreateBasketRecommendationDrafts1789910000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.basket_recommendation_drafts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NULL,
        answers_json jsonb NOT NULL,
        result_json jsonb NOT NULL,
        engine_version text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_basket_recommendation_drafts_user
        ON app.basket_recommendation_drafts (user_id, created_at DESC)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.basket_recommendation_drafts`)
  }
}
