import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePlatformPublishing1790000000011 implements MigrationInterface {
  name = 'CreatePlatformPublishing1790000000011'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.products ADD COLUMN cover_storage_ref text;
      CREATE TABLE app.platform_configuration (
        id boolean PRIMARY KEY DEFAULT true CHECK (id),
        revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
        draft jsonb NOT NULL DEFAULT '{}',
        published_revision integer,
        published jsonb,
        published_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid
      );
      INSERT INTO app.platform_configuration (id) VALUES (true);
      CREATE TABLE app.platform_configuration_versions (
        revision integer PRIMARY KEY,
        content jsonb NOT NULL,
        published_at timestamptz NOT NULL DEFAULT now(),
        published_by uuid NOT NULL
      );
      CREATE TABLE app.user_verified_access (
        user_id uuid PRIMARY KEY REFERENCES app.users(id),
        region varchar(2) NOT NULL CHECK (region ~ '^[A-Z]{2}$'),
        investor_type varchar(24) NOT NULL CHECK (investor_type IN ('retail','professional','institutional')),
        evidence_ref text NOT NULL,
        verified_by uuid NOT NULL,
        verified_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO app.admin_role_permissions (role_id, permission)
        SELECT id, 'platform.manage' FROM app.admin_roles WHERE name = 'super_admin'
        ON CONFLICT DO NOTHING;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DELETE FROM app.admin_role_permissions WHERE permission = 'platform.manage';
      DROP TABLE app.user_verified_access;
      DROP TABLE app.platform_configuration_versions;
      DROP TABLE app.platform_configuration;
      ALTER TABLE app.products DROP COLUMN cover_storage_ref;
    `)
  }
}
