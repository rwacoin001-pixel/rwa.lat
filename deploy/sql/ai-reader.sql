-- Run manually with psql as a PostgreSQL superuser AFTER the ai_ro migration.
-- Intentionally fails if ai_reader exists: inspect existing privileges before reusing a role.
-- Then set its password interactively: \password ai_reader
-- Default privileges below follow the actual view owners, even when this script runs as another superuser.
-- Repeat ALTER DEFAULT PRIVILEGES FOR ROLE <migration_owner> if a new role starts creating views.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE ai_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE ai_reader SET default_transaction_read_only = on;
ALTER ROLE ai_reader SET statement_timeout = '5s';
ALTER ROLE ai_reader SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE ai_reader SET search_path = pg_catalog, ai_ro;
GRANT USAGE ON SCHEMA ai_ro TO ai_reader;
-- Grant existing views only, never base tables accidentally created in this schema.
DO $$ DECLARE v record; BEGIN
  FOR v IN SELECT schemaname, viewname FROM pg_views WHERE schemaname='ai_ro' LOOP
    EXECUTE format('GRANT SELECT ON %I.%I TO ai_reader', v.schemaname, v.viewname);
  END LOOP;
END $$;
-- PostgreSQL calls both views and tables TABLES here. Keep ai_ro a view-only schema.
DO $$ DECLARE owner_name text; BEGIN
  FOR owner_name IN SELECT DISTINCT viewowner FROM pg_views WHERE schemaname='ai_ro' LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA ai_ro GRANT SELECT ON TABLES TO ai_reader', owner_name);
  END LOOP;
END $$;
COMMIT;
-- PUBLIC privileges are inherited even with NOINHERIT. The owner must verify that
-- PUBLIC has no business-schema/table access and no unsafe SECURITY DEFINER functions.
-- Do not grant app schema access, role memberships, table access or database CREATE.
