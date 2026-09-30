import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AiPlanning1790000000017 implements MigrationInterface {
  name = 'AiPlanning1790000000017'
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE app.ai_goals (
      user_id uuid PRIMARY KEY REFERENCES app.users(id), revision integer NOT NULL CHECK(revision>0),
      content jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE app.ai_plans (
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app.users(id), idempotency_key uuid NOT NULL,
      request_hash char(64) NOT NULL, goal_revision integer NOT NULL, goals jsonb NOT NULL, catalog jsonb NOT NULL,
      state text NOT NULL CHECK(state IN ('generating','ready','failed')), result jsonb, model text,
      created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
      UNIQUE(user_id,idempotency_key), CHECK((state='ready')=(result IS NOT NULL))
    ); CREATE INDEX ai_plans_user_date_idx ON app.ai_plans(user_id,created_at DESC)`)
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE app.ai_plans; DROP TABLE app.ai_goals') }
}
