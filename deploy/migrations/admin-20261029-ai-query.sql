-- Admin credential database only, when ADMIN_DATABASE_URL uses a separate database.
-- Same DDL as AdminAiQueryAudit1793000000100 in the shared TypeORM migration chain.
-- Apply once before deploying the admin API. Skip if that migration already ran here.
-- Existing sessions deliberately remain unverified; administrators must sign in with MFA again.
BEGIN;
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
COMMIT;
