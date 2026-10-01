ALTER TABLE app.admin_users ADD COLUMN IF NOT EXISTS mfa_last_counter bigint;
CREATE TABLE IF NOT EXISTS app.admin_mfa_recovery (
  id uuid PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES app.admin_users(id),
  code_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  code_used_at timestamptz,
  token_hash bytea,
  pending_secret_ciphertext text,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_mfa_recovery_user_created ON app.admin_mfa_recovery(admin_user_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS admin_mfa_recovery_token ON app.admin_mfa_recovery(token_hash) WHERE token_hash IS NOT NULL;
