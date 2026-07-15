import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateAdminRbac1783768000000 implements MigrationInterface {
  name = 'CreateAdminRbac1783768000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.admin_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid
      );

      CREATE TABLE app.admin_role_permissions (
        role_id uuid NOT NULL REFERENCES app.admin_roles(id) ON DELETE CASCADE,
        permission text NOT NULL,
        PRIMARY KEY (role_id, permission)
      );

      CREATE TABLE app.admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        role_id uuid NOT NULL REFERENCES app.admin_roles(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid,
        disabled_at timestamptz
      );

      CREATE TABLE app.admin_approval_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        action text NOT NULL,
        object_type text NOT NULL,
        object_id text,
        payload_json jsonb NOT NULL DEFAULT '{}',
        state text NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'approved', 'rejected')),
        requested_by uuid NOT NULL,
        approved_by uuid,
        decided_at timestamptz,
        reason_code text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((state IN ('approved', 'rejected')) = (decided_at IS NOT NULL)),
        CHECK (state NOT IN ('approved') OR approved_by IS NOT NULL),
        CHECK (approved_by IS NULL OR approved_by <> requested_by)
      );

      CREATE INDEX admin_approval_requests_state_idx ON app.admin_approval_requests(state, created_at DESC);
      CREATE INDEX admin_approval_requests_requested_by_idx ON app.admin_approval_requests(requested_by, created_at DESC);

      COMMENT ON TABLE app.admin_approval_requests IS 'Four-eyes approval queue; approved_by must differ from requested_by';
      COMMENT ON COLUMN app.admin_approval_requests.payload_json IS 'Redacted request context only; no credentials or raw PII';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.admin_approval_requests;
      DROP TABLE IF EXISTS app.admin_users;
      DROP TABLE IF EXISTS app.admin_role_permissions;
      DROP TABLE IF EXISTS app.admin_roles;
    `)
  }
}
