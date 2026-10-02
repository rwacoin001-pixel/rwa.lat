import { MigrationInterface, QueryRunner } from 'typeorm'
export class CommunityIdentity1791000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.community_profiles ADD COLUMN IF NOT EXISTS identity_configured boolean NOT NULL DEFAULT false;
      ALTER TABLE app.community_profiles ADD COLUMN IF NOT EXISTS handle_base varchar(20) NULL;
      ALTER TABLE app.community_profiles ALTER COLUMN city TYPE varchar(80);
      UPDATE app.community_profiles SET identity_configured=true WHERE kind <> 'member' OR (handle !~ '^u[0-9a-f]{31}$' AND display_name !~ '^Member [0-9a-f]{6}$');
      CREATE TABLE IF NOT EXISTS app.community_handle_aliases (handle varchar(32) PRIMARY KEY CHECK (handle=lower(handle)), profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE);
      INSERT INTO app.community_handle_aliases(handle,profile_id) SELECT lower(handle),id FROM app.community_profiles ON CONFLICT DO NOTHING;
      ALTER TABLE app.community_translations ADD COLUMN IF NOT EXISTS source_hash varchar(64) NULL;`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS app.community_handle_aliases; ALTER TABLE app.community_profiles DROP COLUMN IF EXISTS identity_configured; ALTER TABLE app.community_profiles DROP COLUMN IF EXISTS handle_base; ALTER TABLE app.community_translations DROP COLUMN IF EXISTS source_hash')
  }
}
