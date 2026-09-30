import type { MigrationInterface, QueryRunner } from 'typeorm'
import { DEFAULT_COMPANY, DEFAULT_TEMPLATES, DOCUMENT_KINDS } from '../../generated-documents/document-model'

export class GeneratedDocuments1790000000019 implements MigrationInterface {
  name = 'GeneratedDocuments1790000000019'
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE app.document_company_settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),revision integer NOT NULL DEFAULT 1,content jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE app.document_company_versions(revision integer PRIMARY KEY,content jsonb NOT NULL,created_by uuid,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE app.document_templates(kind text PRIMARY KEY CHECK(kind IN ('trade_confirmation','statement','agreement','tax_document')),revision integer NOT NULL DEFAULT 1,content jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE app.document_template_versions(kind text NOT NULL REFERENCES app.document_templates(kind),revision integer NOT NULL,content jsonb NOT NULL,created_by uuid,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,revision));
      CREATE TABLE app.document_tax_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.users(id),tax_year integer NOT NULL CHECK(tax_year BETWEEN 2000 AND 2200),content jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE app.generated_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.users(id),kind text NOT NULL REFERENCES app.document_templates(kind),source_key text NOT NULL,snapshot jsonb NOT NULL,
        state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','rendering','ready','failed')),object_id uuid REFERENCES app.object_storage_objects(id),sha256 char(64),attempts integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,error_code text,created_at timestamptz NOT NULL DEFAULT now(),generated_at timestamptz,UNIQUE(user_id,kind,source_key));
      CREATE INDEX generated_documents_user_idx ON app.generated_documents(user_id,created_at DESC);
      CREATE INDEX generated_documents_queue_idx ON app.generated_documents(state,lease_until);
      CREATE TABLE app.document_agreement_consents(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES app.users(id),template_revision integer NOT NULL,company_revision integer NOT NULL,document_id uuid NOT NULL REFERENCES app.generated_documents(id),accepted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,template_revision,company_revision));`)
    await q.query('INSERT INTO app.document_company_settings(content) VALUES($1::jsonb)', [JSON.stringify(DEFAULT_COMPANY)])
    await q.query('INSERT INTO app.document_company_versions(revision,content) VALUES(1,$1::jsonb)', [JSON.stringify(DEFAULT_COMPANY)])
    for (const kind of DOCUMENT_KINDS) {
      await q.query('INSERT INTO app.document_templates(kind,content) VALUES($1,$2::jsonb)', [kind, JSON.stringify(DEFAULT_TEMPLATES[kind])])
      await q.query('INSERT INTO app.document_template_versions(kind,revision,content) VALUES($1,1,$2::jsonb)', [kind, JSON.stringify(DEFAULT_TEMPLATES[kind])])
    }
  }
  async down(q: QueryRunner) { await q.query('DROP TABLE app.document_agreement_consents,app.generated_documents,app.document_tax_records,app.document_template_versions,app.document_templates,app.document_company_versions,app.document_company_settings') }
}
