import { MigrationInterface, QueryRunner } from 'typeorm'

/** DM photo / file / voice attachments. Unsend reuses the existing deleted_at column. */
export class CommunityDmAttachments1793300000000 implements MigrationInterface {
  name = 'CommunityDmAttachments1793300000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.community_dm_messages
        ADD COLUMN attachment_media_id uuid,
        ADD COLUMN attachment_kind text CHECK (attachment_kind IN ('image','file','voice')),
        ADD COLUMN attachment_name text CHECK (char_length(attachment_name) <= 255),
        ADD COLUMN attachment_content_type text,
        ADD COLUMN attachment_size_bytes bigint CHECK (attachment_size_bytes > 0),
        ADD CONSTRAINT community_dm_messages_attachment_complete
          CHECK ((attachment_media_id IS NULL) = (attachment_kind IS NULL));
      ALTER TABLE app.community_dm_messages DROP CONSTRAINT community_dm_messages_body_check;
      ALTER TABLE app.community_dm_messages ADD CONSTRAINT community_dm_messages_body_check
        CHECK (char_length(btrim(body)) <= 2000 AND (char_length(btrim(body)) >= 1 OR attachment_media_id IS NOT NULL));
      CREATE INDEX community_dm_messages_attachment_idx ON app.community_dm_messages(attachment_media_id)
        WHERE attachment_media_id IS NOT NULL;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    // Never silently erase sent attachments (moderation evidence) on rollback.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.community_dm_messages WHERE attachment_media_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Export DM attachment messages before reverting this migration';
      END IF;
    END $$`)
    await q.query(`
      DROP INDEX app.community_dm_messages_attachment_idx;
      ALTER TABLE app.community_dm_messages DROP CONSTRAINT community_dm_messages_body_check;
      ALTER TABLE app.community_dm_messages ADD CONSTRAINT community_dm_messages_body_check
        CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000);
      ALTER TABLE app.community_dm_messages
        DROP CONSTRAINT community_dm_messages_attachment_complete,
        DROP COLUMN attachment_media_id, DROP COLUMN attachment_kind, DROP COLUMN attachment_name,
        DROP COLUMN attachment_content_type, DROP COLUMN attachment_size_bytes;
    `)
  }
}
