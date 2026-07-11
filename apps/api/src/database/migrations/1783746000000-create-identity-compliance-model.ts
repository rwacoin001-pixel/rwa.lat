import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateIdentityComplianceModel1783746000000 implements MigrationInterface {
  name = 'CreateIdentityComplianceModel1783746000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'suspended', 'closed')),
        locale text NOT NULL DEFAULT 'en',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        closed_at timestamptz,
        CHECK ((status = 'closed') = (closed_at IS NOT NULL))
      );

      CREATE TABLE app.login_identities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK (kind IN ('email', 'google', 'x', 'external_wallet')),
        state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'verified', 'revoked')),
        identifier_hash bytea NOT NULL,
        identifier_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        UNIQUE (kind, identifier_hash),
        CHECK ((state = 'pending' AND verified_at IS NULL) OR (state IN ('verified', 'revoked') AND verified_at IS NOT NULL)),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE TABLE app.legal_identities (
        user_id uuid PRIMARY KEY REFERENCES app.users(id) ON DELETE RESTRICT,
        pii_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE app.devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        fingerprint_hash bytea NOT NULL,
        trust_state text NOT NULL DEFAULT 'untrusted' CHECK (trust_state IN ('untrusted', 'trusted', 'revoked')),
        display_name text,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        trusted_at timestamptz,
        revoked_at timestamptz,
        UNIQUE (user_id, fingerprint_hash),
        UNIQUE (id, user_id),
        CHECK (trust_state <> 'trusted' OR trusted_at IS NOT NULL),
        CHECK ((trust_state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE TABLE app.sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        device_id uuid,
        token_hash bytea NOT NULL UNIQUE,
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'revoked', 'expired')),
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        revoke_reason text,
        FOREIGN KEY (device_id, user_id) REFERENCES app.devices(id, user_id) ON DELETE RESTRICT,
        CHECK (expires_at > created_at),
        CHECK ((state = 'revoked') = (revoked_at IS NOT NULL))
      );

      CREATE TABLE app.consents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        document_type text NOT NULL,
        document_version text NOT NULL,
        granted boolean NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        request_id text NOT NULL,
        supersedes_consent_id uuid UNIQUE REFERENCES app.consents(id) ON DELETE RESTRICT
      );

      CREATE TABLE app.kyc_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        state text NOT NULL DEFAULT 'not_started' CHECK (state IN ('not_started', 'in_progress', 'submitted', 'needs_information', 'approved', 'rejected', 'expired')),
        provider text NOT NULL,
        provider_case_hash bytea NOT NULL,
        provider_case_ciphertext bytea NOT NULL,
        encryption_key_version integer NOT NULL CHECK (encryption_key_version > 0),
        reason_code text,
        submitted_at timestamptz,
        decided_at timestamptz,
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, provider_case_hash),
        CHECK (state IN ('not_started', 'in_progress') OR submitted_at IS NOT NULL),
        CHECK (state NOT IN ('approved', 'rejected') OR decided_at IS NOT NULL)
      );

      CREATE TABLE app.eligibility_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        policy_version text NOT NULL,
        product_scope text NOT NULL,
        decision text NOT NULL CHECK (decision IN ('browse_only', 'ineligible', 'eligible', 'manual_review')),
        reason_codes text[] NOT NULL DEFAULT '{}',
        evidence_references jsonb NOT NULL DEFAULT '{}',
        decided_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        UNIQUE (user_id, policy_version, product_scope),
        CHECK (jsonb_typeof(evidence_references) = 'object')
      );

      CREATE TABLE app.risk_flags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        category text NOT NULL,
        severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'under_review', 'resolved', 'dismissed')),
        source text NOT NULL,
        reason_code text NOT NULL,
        opened_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        CHECK ((state IN ('resolved', 'dismissed')) = (resolved_at IS NOT NULL))
      );

      CREATE TABLE app.screening_cases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK (kind IN ('sanctions', 'pep', 'adverse_media', 'wallet_risk')),
        state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'clear', 'potential_match', 'confirmed_match', 'dismissed')),
        provider text NOT NULL,
        provider_reference_hash bytea,
        reason_code text,
        opened_at timestamptz NOT NULL DEFAULT now(),
        decided_at timestamptz,
        CHECK (state IN ('pending', 'potential_match') OR decided_at IS NOT NULL)
      );

      CREATE TABLE app.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        occurred_at timestamptz NOT NULL DEFAULT now(),
        actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'service', 'partner')),
        actor_id uuid,
        user_id uuid REFERENCES app.users(id) ON DELETE RESTRICT,
        action text NOT NULL,
        object_type text NOT NULL,
        object_id text,
        request_id text NOT NULL,
        reason_code text,
        metadata jsonb NOT NULL DEFAULT '{}'
      );

      CREATE INDEX sessions_user_state_idx ON app.sessions(user_id, state);
      CREATE INDEX kyc_cases_user_created_idx ON app.kyc_cases(user_id, created_at DESC);
      CREATE INDEX eligibility_user_scope_idx ON app.eligibility_profiles(user_id, product_scope, decided_at DESC);
      CREATE INDEX risk_flags_user_state_idx ON app.risk_flags(user_id, state);
      CREATE INDEX audit_logs_user_occurred_idx ON app.audit_logs(user_id, occurred_at DESC);

      COMMENT ON COLUMN app.eligibility_profiles.evidence_references IS 'Redacted evidence references only; no raw PII';
      COMMENT ON COLUMN app.audit_logs.metadata IS 'Redacted operational context only; no credentials or raw PII';

      CREATE FUNCTION app.reject_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
      END;
      $$;

      CREATE TRIGGER audit_logs_immutable
      BEFORE UPDATE OR DELETE ON app.audit_logs
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER audit_logs_no_truncate
      BEFORE TRUNCATE ON app.audit_logs
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TRIGGER consents_immutable
      BEFORE UPDATE OR DELETE ON app.consents
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER consents_no_truncate
      BEFORE TRUNCATE ON app.consents
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();

      CREATE TRIGGER eligibility_profiles_immutable
      BEFORE UPDATE OR DELETE ON app.eligibility_profiles
      FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_mutation();
      CREATE TRIGGER eligibility_profiles_no_truncate
      BEFORE TRUNCATE ON app.eligibility_profiles
      FOR EACH STATEMENT EXECUTE FUNCTION app.reject_immutable_mutation();
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_logs_immutable ON app.audit_logs;
      DROP TRIGGER IF EXISTS audit_logs_no_truncate ON app.audit_logs;
      DROP TRIGGER IF EXISTS consents_immutable ON app.consents;
      DROP TRIGGER IF EXISTS consents_no_truncate ON app.consents;
      DROP TRIGGER IF EXISTS eligibility_profiles_immutable ON app.eligibility_profiles;
      DROP TRIGGER IF EXISTS eligibility_profiles_no_truncate ON app.eligibility_profiles;
      DROP TABLE IF EXISTS app.audit_logs;
      DROP TABLE IF EXISTS app.screening_cases;
      DROP TABLE IF EXISTS app.risk_flags;
      DROP TABLE IF EXISTS app.eligibility_profiles;
      DROP TABLE IF EXISTS app.kyc_cases;
      DROP TABLE IF EXISTS app.consents;
      DROP TABLE IF EXISTS app.sessions;
      DROP TABLE IF EXISTS app.devices;
      DROP TABLE IF EXISTS app.legal_identities;
      DROP TABLE IF EXISTS app.login_identities;
      DROP TABLE IF EXISTS app.users;
      DROP FUNCTION IF EXISTS app.reject_immutable_mutation();
      DROP FUNCTION IF EXISTS app.reject_audit_log_mutation();
    `)
  }
}
