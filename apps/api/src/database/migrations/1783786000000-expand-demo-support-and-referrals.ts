import { MigrationInterface, QueryRunner } from 'typeorm'

export class ExpandDemoSupportAndReferrals1783786000000 implements MigrationInterface {
  name = 'ExpandDemoSupportAndReferrals1783786000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.tickets
        DROP CONSTRAINT IF EXISTS tickets_status_check,
        ADD COLUMN category text NOT NULL DEFAULT 'support'
          CHECK (category IN ('support', 'dispute', 'appeal', 'scam_report')),
        ADD COLUMN order_id uuid REFERENCES app.orders(id) ON DELETE SET NULL,
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT tickets_status_check
          CHECK (status IN ('open', 'pending', 'investigating', 'waiting_user', 'resolved', 'closed'));

      CREATE INDEX tickets_order_idx ON app.tickets (order_id, created_at DESC);

      CREATE TABLE app.ticket_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
        actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'service')),
        actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
        body text NOT NULL,
        attachments jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (jsonb_typeof(attachments) = 'object')
      );
      CREATE INDEX ticket_messages_ticket_idx ON app.ticket_messages (ticket_id, created_at ASC);

      CREATE TABLE app.ticket_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id uuid NOT NULL REFERENCES app.tickets(id) ON DELETE CASCADE,
        event_type text NOT NULL CHECK (event_type IN ('created', 'message_added', 'status_changed', 'assigned')),
        actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'service')),
        actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
        previous_status text,
        next_status text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (jsonb_typeof(metadata) = 'object')
      );
      CREATE INDEX ticket_events_ticket_idx ON app.ticket_events (ticket_id, created_at ASC);

      ALTER TABLE app.invitations
        ADD CONSTRAINT invitations_inviter_accepted_user_check
          CHECK (accepted_user_id IS NULL OR accepted_user_id <> inviter_user_id);
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.invitations
        DROP CONSTRAINT IF EXISTS invitations_inviter_accepted_user_check;

      DROP TABLE IF EXISTS app.ticket_events;
      DROP TABLE IF EXISTS app.ticket_messages;

      ALTER TABLE app.tickets
        DROP CONSTRAINT IF EXISTS tickets_status_check,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS order_id,
        DROP COLUMN IF EXISTS category,
        ADD CONSTRAINT tickets_status_check
          CHECK (status IN ('open', 'pending', 'resolved', 'closed'));
    `)
  }
}
