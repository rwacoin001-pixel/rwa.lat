import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateLearningContent1790000000015 implements MigrationInterface {
  name = 'CreateLearningContent1790000000015'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.learning_articles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      slug varchar(100) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
      locale varchar(5) NOT NULL CHECK (locale IN ('en','zh-CN','hi','es','ar','fr','pt')),
      revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      draft jsonb NOT NULL,
      published jsonb,
      published_revision integer,
      published_at timestamptz,
      archived_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid NOT NULL,
      UNIQUE (slug,locale)
    ); CREATE INDEX learning_articles_published ON app.learning_articles(published_at DESC) WHERE published IS NOT NULL AND archived_at IS NULL;`)
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE app.learning_articles') }
}
