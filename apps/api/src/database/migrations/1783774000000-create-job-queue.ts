import { MigrationInterface, QueryRunner } from 'typeorm'

// INFRA-002：基于 Postgres 的任务队列 + 死信 + 回调事件落盘。
// 不引入 BullMQ/ioredis，复用现有 PG 连接（SKIP LOCKED 实现乱序领取）。
export class CreateJobQueue1783774000000 implements MigrationInterface {
  name = 'CreateJobQueue1783774000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- 外部回调事件落盘（可重放、去重）
      CREATE TABLE app.inbound_callback_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        partner text NOT NULL,
        event_type text NOT NULL,
        external_id text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}',
        signature_ok boolean NOT NULL DEFAULT false,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        UNIQUE (partner, external_id)
      );

      -- 通用任务队列（死信通过 state='dead' 标记，不单独建表）
      CREATE TABLE app.job_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}',
        state text NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'running', 'completed', 'dead')),
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 5,
        last_error text,
        dedup_key text,
        run_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        UNIQUE (dedup_key)
      );

      CREATE INDEX idx_job_queue_claim ON app.job_queue (queue_name, run_at) WHERE state = 'pending';
      CREATE INDEX idx_callback_unprocessed ON app.inbound_callback_events (received_at) WHERE processed_at IS NULL;
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.job_queue;
      DROP TABLE IF EXISTS app.inbound_callback_events;
    `)
  }
}
