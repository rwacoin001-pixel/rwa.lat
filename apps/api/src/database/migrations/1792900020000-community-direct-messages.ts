import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CommunityDirectMessages1792900020000 implements MigrationInterface {
  name = 'CommunityDirectMessages1792900020000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE app.community_profiles ADD COLUMN dm_policy text NOT NULL DEFAULT 'everyone'
        CHECK (dm_policy IN ('everyone','following'));

      CREATE TABLE app.community_dm_threads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        a_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        b_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        created_by_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
        last_message_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
        CHECK (a_profile_id < b_profile_id),
        CHECK (created_by_profile_id IN (a_profile_id,b_profile_id)),
        UNIQUE (a_profile_id,b_profile_id)
      );
      CREATE INDEX community_dm_threads_activity_idx ON app.community_dm_threads(last_message_at DESC,id DESC);
      CREATE INDEX community_dm_threads_creator_idx ON app.community_dm_threads(created_by_profile_id,created_at DESC);

      CREATE TABLE app.community_dm_members (
        thread_id uuid NOT NULL REFERENCES app.community_dm_threads(id) ON DELETE CASCADE,
        profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        last_read_message_id uuid,
        muted boolean NOT NULL DEFAULT false,
        archived boolean NOT NULL DEFAULT false,
        -- Maintained with the thread timestamp in the send transaction, for member activity pagination.
        last_message_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (thread_id,profile_id)
      );
      CREATE INDEX community_dm_members_activity_idx ON app.community_dm_members(profile_id,last_message_at DESC,thread_id DESC);

      CREATE TABLE app.community_dm_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id uuid NOT NULL REFERENCES app.community_dm_threads(id) ON DELETE CASCADE,
        sender_profile_id uuid NOT NULL,
        client_id uuid NOT NULL,
        -- A monotonic cursor also avoids unread/read races for messages created in the same millisecond.
        sequence bigserial NOT NULL UNIQUE,
        body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
        created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
        deleted_at timestamptz,
        FOREIGN KEY (thread_id,sender_profile_id) REFERENCES app.community_dm_members(thread_id,profile_id) ON DELETE CASCADE,
        UNIQUE (sender_profile_id,client_id),
        UNIQUE (thread_id,id)
      );
      ALTER TABLE app.community_dm_members ADD CONSTRAINT community_dm_member_read_fk
        FOREIGN KEY (thread_id,last_read_message_id) REFERENCES app.community_dm_messages(thread_id,id);
      CREATE INDEX community_dm_messages_created_idx ON app.community_dm_messages(thread_id,created_at DESC,sequence DESC);
      CREATE INDEX community_dm_messages_sequence_idx ON app.community_dm_messages(thread_id,sequence DESC);
      CREATE INDEX community_dm_messages_sender_idx ON app.community_dm_messages(sender_profile_id,created_at DESC);

      CREATE TABLE app.community_dm_blocks (
        blocker_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        blocked_profile_id uuid NOT NULL REFERENCES app.community_profiles(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (blocker_profile_id,blocked_profile_id),
        CHECK (blocker_profile_id<>blocked_profile_id)
      );
      CREATE INDEX community_dm_blocks_blocked_idx ON app.community_dm_blocks(blocked_profile_id,blocker_profile_id);
      CREATE UNIQUE INDEX notifications_community_dm_unread_idx
        ON app.notifications(recipient_user_id,(payload->>'threadId'))
        WHERE kind='community.dm' AND channel='in_app' AND read_at IS NULL;
      ALTER TABLE app.community_reports DROP CONSTRAINT community_reports_target_type_check;
      ALTER TABLE app.community_reports ADD CONSTRAINT community_reports_target_type_check
        CHECK (target_type IN ('post','comment','profile','dm_message'));
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    // Never silently erase moderation evidence on rollback.
    await q.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM app.community_reports WHERE target_type='dm_message') THEN
        RAISE EXCEPTION 'Resolve and export DM reports before reverting the DM migration';
      END IF;
    END $$`)
    await q.query(`
      ALTER TABLE app.community_reports DROP CONSTRAINT community_reports_target_type_check;
      ALTER TABLE app.community_reports ADD CONSTRAINT community_reports_target_type_check CHECK (target_type IN ('post','comment','profile'));
      DROP INDEX app.notifications_community_dm_unread_idx;
      DROP TABLE app.community_dm_blocks;
      ALTER TABLE app.community_dm_members DROP CONSTRAINT community_dm_member_read_fk;
      DROP TABLE app.community_dm_messages;
      DROP TABLE app.community_dm_members;
      DROP TABLE app.community_dm_threads;
      ALTER TABLE app.community_profiles DROP COLUMN dm_policy;
    `)
  }
}
