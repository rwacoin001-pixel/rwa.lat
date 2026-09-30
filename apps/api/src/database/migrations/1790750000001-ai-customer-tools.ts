import { MigrationInterface, QueryRunner } from 'typeorm'

export class AiCustomerTools1790750000001 implements MigrationInterface {
  name = 'AiCustomerTools1790750000001'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE app.ai_ticket_drafts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.users(id),
      content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
      confirmed_at timestamptz, ticket_id uuid REFERENCES app.tickets(id),
      CHECK (expires_at > created_at), CHECK ((confirmed_at IS NULL) = (ticket_id IS NULL))
    ); CREATE INDEX ai_ticket_drafts_user ON app.ai_ticket_drafts(user_id,created_at DESC);`)
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE app.ai_ticket_drafts') }
}
