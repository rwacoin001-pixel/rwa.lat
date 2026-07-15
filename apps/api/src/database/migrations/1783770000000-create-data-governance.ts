import { MigrationInterface, QueryRunner } from 'typeorm'

// DB-007：数据保留/删除流程 + 备份恢复演练留痕。
// 不改动任何现有表；仅新增治理所需的独立表。
export class CreateDataGovernance1783770000000 implements MigrationInterface {
  name = 'CreateDataGovernance1783770000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- 备份恢复演练记录：满足"恢复演练留存记录"要求
      CREATE TABLE app.backup_drills (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind text NOT NULL CHECK (kind IN ('full', 'incremental', 'point_in_time')),
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz,
        status text NOT NULL DEFAULT 'running'
          CHECK (status IN ('running', 'succeeded', 'failed')),
        target text NOT NULL DEFAULT 'rwa_lat',
        notes text NOT NULL DEFAULT '',
        performed_by uuid
      );

      -- 数据删除请求：满足"删除流程"的登记与审计留痕（软删 + 保留期后可物理删）
      CREATE TABLE app.data_deletion_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_type text NOT NULL CHECK (subject_type IN ('user', 'admin', 'partner', 'audit')),
        subject_id text NOT NULL,
        reason_code text NOT NULL DEFAULT 'user_request',
        requested_by uuid NOT NULL,
        state text NOT NULL DEFAULT 'requested'
          CHECK (state IN ('requested', 'approved', 'purged', 'rejected')),
        approved_by uuid,
        retain_until timestamptz NOT NULL,
        requested_at timestamptz NOT NULL DEFAULT now(),
        purged_at timestamptz,
        decided_at timestamptz
      );

      CREATE INDEX idx_backup_drills_started ON app.backup_drills (started_at DESC);
      CREATE INDEX idx_deletion_requests_state ON app.data_deletion_requests (state, retain_until);
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.data_deletion_requests;
      DROP TABLE IF EXISTS app.backup_drills;
    `)
  }
}
