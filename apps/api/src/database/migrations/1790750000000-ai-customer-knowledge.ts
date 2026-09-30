import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiCustomerKnowledge1790750000000 implements MigrationInterface {
  name = 'AiCustomerKnowledge1790750000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.ai_knowledge_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
      locale varchar(5) NOT NULL CHECK (locale IN ('en','zh-CN','hi','es','ar','fr','pt')),
      draft jsonb NOT NULL, published jsonb, published_revision integer, published_at timestamptz,
      archived_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid NOT NULL,
      CHECK ((published IS NULL AND published_revision IS NULL AND published_at IS NULL) OR
        (published IS NOT NULL AND published_revision > 0 AND published_at IS NOT NULL))
    );
    CREATE INDEX ai_knowledge_live ON app.ai_knowledge_items(locale,published_at DESC)
      WHERE published IS NOT NULL AND archived_at IS NULL;
    CREATE TABLE app.ai_knowledge_versions (
      item_id uuid NOT NULL REFERENCES app.ai_knowledge_items(id), revision integer NOT NULL CHECK (revision > 0),
      content jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(), published_by uuid NOT NULL,
      PRIMARY KEY (item_id,revision)
    );
    CREATE FUNCTION app.ai_knowledge_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Published knowledge versions are immutable'; END $$;
    CREATE TRIGGER ai_knowledge_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON app.ai_knowledge_versions
      FOR EACH STATEMENT EXECUTE FUNCTION app.ai_knowledge_version_immutable();`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE app.ai_knowledge_versions; DROP FUNCTION app.ai_knowledge_version_immutable(); DROP TABLE app.ai_knowledge_items;`)
  }
}
