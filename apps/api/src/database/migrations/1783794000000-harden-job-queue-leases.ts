import { MigrationInterface, QueryRunner } from 'typeorm'

export class HardenJobQueueLeases1783794000000 implements MigrationInterface {
  name = 'HardenJobQueueLeases1783794000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.job_queue
        ADD COLUMN locked_at timestamptz,
        ADD COLUMN lease_expires_at timestamptz,
        ADD COLUMN worker_id varchar(128),
        ADD CONSTRAINT job_queue_attempt_bounds_chk
          CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 100);

      UPDATE app.job_queue
         SET state = 'pending',
             last_error = COALESCE(last_error, 'Recovered during execution-lease migration')
       WHERE state = 'running';

      CREATE INDEX idx_job_queue_expired_lease
        ON app.job_queue (queue_name, lease_expires_at)
        WHERE state = 'running';
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.idx_job_queue_expired_lease;
      ALTER TABLE app.job_queue
        DROP CONSTRAINT IF EXISTS job_queue_attempt_bounds_chk,
        DROP COLUMN IF EXISTS worker_id,
        DROP COLUMN IF EXISTS lease_expires_at,
        DROP COLUMN IF EXISTS locked_at;
    `)
  }
}
