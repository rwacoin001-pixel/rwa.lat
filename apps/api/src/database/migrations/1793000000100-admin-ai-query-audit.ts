import type { MigrationInterface, QueryRunner } from 'typeorm'

// Admin tables share the core migration runner, like admin RBAC and sessions.
export class AdminAiQueryAudit1793000000100 implements MigrationInterface {
  name = 'AdminAiQueryAudit1793000000100'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.admin_sessions ADD COLUMN mfa_verified_at timestamptz;
      CREATE TABLE app.admin_ai_query_audit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id uuid NOT NULL REFERENCES app.admin_users(id) ON DELETE RESTRICT,
        action text NOT NULL CHECK (action IN ('query','sql','export')),
        question text NOT NULL,
        sql text,
        row_count integer NOT NULL DEFAULT 0 CHECK (row_count BETWEEN 0 AND 500),
        duration_ms integer NOT NULL CHECK (duration_ms >= 0),
        error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX admin_ai_query_audit_admin_created ON app.admin_ai_query_audit(admin_id, created_at DESC);
      INSERT INTO app.admin_role_permissions(role_id, permission)
        SELECT id, 'ai.ops.query' FROM app.admin_roles WHERE name='super_admin' ON CONFLICT DO NOTHING;
    `)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM app.admin_role_permissions WHERE permission='ai.ops.query';
      DROP TABLE app.admin_ai_query_audit;
      ALTER TABLE app.admin_sessions DROP COLUMN mfa_verified_at;`)
  }
}
