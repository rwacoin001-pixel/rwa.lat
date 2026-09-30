import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * AI 助手：会话与消息存储（会话可匿名，登录后归属用户）。
 */
export class CreateAiChat1790000000002 implements MigrationInterface {
  name = 'CreateAiChat1790000000002'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.ai_chat_sessions (
        id uuid PRIMARY KEY,
        user_id uuid NULL,
        title text NOT NULL DEFAULT 'New conversation',
        context_json jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user
        ON app.ai_chat_sessions (user_id, updated_at DESC)
        WHERE deleted_at IS NULL
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.ai_chat_messages (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES app.ai_chat_sessions(id),
        role varchar NOT NULL,
        content text NOT NULL,
        citations_json jsonb NULL,
        helpful boolean NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ai_chat_messages_role_check CHECK (role IN ('user', 'assistant'))
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session
        ON app.ai_chat_messages (session_id, created_at ASC)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.ai_chat_messages`)
    await queryRunner.query(`DROP TABLE IF EXISTS app.ai_chat_sessions`)
  }
}
