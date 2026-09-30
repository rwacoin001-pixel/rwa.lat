import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddTicketIdempotency1790000000008 implements MigrationInterface {
  name = 'AddTicketIdempotency1790000000008'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.tickets
        ADD COLUMN idempotency_key varchar(128),
        ADD COLUMN request_hash char(64);
      CREATE UNIQUE INDEX tickets_author_idempotency_key_idx
        ON app.tickets (author_user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS app.tickets_author_idempotency_key_idx;
      ALTER TABLE app.tickets
        DROP COLUMN request_hash,
        DROP COLUMN idempotency_key;
    `)
  }
}
