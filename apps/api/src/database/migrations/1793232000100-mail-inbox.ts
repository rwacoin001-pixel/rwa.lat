import { MigrationInterface, QueryRunner } from 'typeorm'

export class MailInbox1793232000100 implements MigrationInterface {
  name = 'MailInbox1793232000100'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE app.mail_threads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, normalized_subject text NOT NULL,
        counterpart text NOT NULL, unread boolean NOT NULL DEFAULT true, archived boolean NOT NULL DEFAULT false,
        assignee uuid REFERENCES app.admin_users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX mail_threads_inbox_idx ON app.mail_threads(archived,unread DESC,updated_at DESC);
      CREATE INDEX mail_threads_match_idx ON app.mail_threads(normalized_subject,counterpart,updated_at DESC);
      CREATE TABLE app.mail_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES app.mail_threads(id) ON DELETE CASCADE,
        direction text NOT NULL CHECK(direction IN ('in','out')), from_address text NOT NULL, to_addresses jsonb NOT NULL, cc_addresses jsonb NOT NULL DEFAULT '[]',
        subject text NOT NULL, text_body text NOT NULL DEFAULT '', html_body text NOT NULL DEFAULT '',
        message_id text NOT NULL UNIQUE, in_reply_to text, references_ids jsonb NOT NULL DEFAULT '[]', spam_verdict text,
        delivery_state text NOT NULL DEFAULT 'received' CHECK(delivery_state IN ('received','queued','retrying','sent','failed')),
        request_key uuid UNIQUE, actor_id uuid, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
      );
      CREATE INDEX mail_messages_thread_idx ON app.mail_messages(thread_id,created_at);
      CREATE TABLE app.mail_attachments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES app.mail_messages(id) ON DELETE CASCADE,
        filename text NOT NULL, content_type text NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes>=0),
        content bytea, sha256 text, dropped boolean NOT NULL DEFAULT false,
        CHECK ((dropped AND content IS NULL AND size_bytes>5242880) OR (NOT dropped AND content IS NOT NULL AND octet_length(content)=size_bytes AND size_bytes<=5242880))
      );
      INSERT INTO app.admin_role_permissions(role_id,permission)
        SELECT id,permission FROM app.admin_roles CROSS JOIN unnest(ARRAY['mail.read','mail.reply']) AS p(permission)
        WHERE name IN ('super_admin','owner','admin') ON CONFLICT DO NOTHING;
    `)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM app.admin_role_permissions WHERE permission IN ('mail.read','mail.reply') AND role_id IN (SELECT id FROM app.admin_roles WHERE name IN ('super_admin','owner','admin'));
      DROP TABLE app.mail_attachments; DROP TABLE app.mail_messages; DROP TABLE app.mail_threads;`)
  }
}
