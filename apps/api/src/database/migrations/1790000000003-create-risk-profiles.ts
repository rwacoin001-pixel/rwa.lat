import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 风险画像：问卷答案与派生分档（替换 preferences 方案）。
 */
export class CreateRiskProfiles1790000000003 implements MigrationInterface {
  name = 'CreateRiskProfiles1790000000003'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.risk_profiles (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL UNIQUE,
        answers_json jsonb NOT NULL,
        score integer NOT NULL,
        band varchar NOT NULL,
        questionnaire_version varchar NOT NULL,
        completed_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT risk_profiles_band_check CHECK (band IN ('conservative', 'balanced', 'growth', 'aggressive')),
        CONSTRAINT risk_profiles_score_check CHECK (score >= 0 AND score <= 100)
      )
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.risk_profiles`)
  }
}
