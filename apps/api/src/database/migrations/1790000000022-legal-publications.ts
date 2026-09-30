import type { MigrationInterface, QueryRunner } from 'typeorm'

export class LegalPublications1790000000022 implements MigrationInterface {
  name = 'LegalPublications1790000000022'
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE app.legal_documents (
      kind text PRIMARY KEY CHECK (kind IN ('terms','privacy')),
      revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
      draft jsonb NOT NULL DEFAULT '{}',
      published_revision integer,
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
    );
    CREATE TABLE app.legal_document_versions (
      kind text NOT NULL REFERENCES app.legal_documents(kind),
      revision integer NOT NULL CHECK (revision > 0),
      version text NOT NULL UNIQUE, content jsonb NOT NULL,
      published_at timestamptz NOT NULL DEFAULT now(), published_by uuid NOT NULL,
      PRIMARY KEY (kind, revision)
    );
    ALTER TABLE app.legal_documents ADD CONSTRAINT legal_published_revision_fk
      FOREIGN KEY (kind,published_revision) REFERENCES app.legal_document_versions(kind,revision);
    INSERT INTO app.legal_documents(kind) VALUES ('terms'),('privacy');`)
  }
  async down(q: QueryRunner) {
    await q.query(`ALTER TABLE app.legal_documents DROP CONSTRAINT legal_published_revision_fk;
      DROP TABLE app.legal_document_versions; DROP TABLE app.legal_documents;`)
  }
}
