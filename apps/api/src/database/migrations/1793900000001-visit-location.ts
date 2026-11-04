import type { MigrationInterface, QueryRunner } from 'typeorm'

export class VisitLocation1793900000001 implements MigrationInterface {
  name = 'VisitLocation1793900000001'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.visit_log ADD COLUMN IF NOT EXISTS region text, ADD COLUMN IF NOT EXISTS city text`)
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.visit_log DROP COLUMN IF EXISTS region, DROP COLUMN IF EXISTS city`)
  }
}
