import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAdminSessionAuthentication1783787000000 implements MigrationInterface {
  name = 'AddAdminSessionAuthentication1783787000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.admin_users
        ADD COLUMN password_hash text,
        ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
        ADD COLUMN locked_until timestamptz,
        ADD COLUMN last_login_at timestamptz,
        ADD COLUMN password_updated_at timestamptz;

      CREATE TABLE app.admin_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_user_id uuid NOT NULL REFERENCES app.admin_users(id) ON DELETE CASCADE,
        token_hash bytea NOT NULL UNIQUE,
        issued_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        ip_address inet,
        user_agent text,
        CHECK (expires_at > issued_at)
      );
      CREATE INDEX admin_sessions_active_user_idx
        ON app.admin_sessions (admin_user_id, expires_at DESC)
        WHERE revoked_at IS NULL;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.admin_sessions;
      ALTER TABLE app.admin_users
        DROP COLUMN IF EXISTS password_updated_at,
        DROP COLUMN IF EXISTS last_login_at,
        DROP COLUMN IF EXISTS locked_until,
        DROP COLUMN IF EXISTS failed_login_count,
        DROP COLUMN IF EXISTS password_hash;
    `)
  }
}
