-- Apply to ADMIN_DATABASE_URL after owner approval; the core migration seeds its own RBAC.
BEGIN;
WITH added AS (
  INSERT INTO app.admin_role_permissions(role_id,permission)
  SELECT id,permission FROM app.admin_roles
  CROSS JOIN unnest(ARRAY['mail.read','mail.reply']) AS p(permission)
  WHERE name IN ('owner','admin','super_admin')
  ON CONFLICT DO NOTHING
  RETURNING role_id,permission
)
INSERT INTO app.audit_logs(id,actor_type,actor_id,action,object_type,object_id,request_id,metadata)
SELECT gen_random_uuid(),'service',NULL,'admin.mail.permissions_seeded','admin_role',role_id::text,
  gen_random_uuid(),jsonb_build_object('actor','system:migration','permissions',jsonb_agg(permission))
FROM added GROUP BY role_id;
COMMIT;
