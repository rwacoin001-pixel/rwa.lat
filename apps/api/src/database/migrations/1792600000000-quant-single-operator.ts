import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Koala Quant daily settlement no longer requires a second operator: the same administrator may enter a day's return and
 * confirm it (as with the platform's other single-administrator approvals). The two steps stay: a draft is entered, then
 * confirmed in a separate action, and a move above the product's daily limit still needs an explicit confirmation.
 * The original table check (approved_by <> entered_by) is looked up by definition because its generated name is not fixed.
 */
export class QuantSingleOperator1792600000000 implements MigrationInterface {
  name = 'QuantSingleOperator1792600000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$
      DECLARE constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name FROM pg_constraint
         WHERE conrelid = 'app.quant_daily_settlements'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) LIKE '%approved_by <> entered_by%';
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE app.quant_daily_settlements DROP CONSTRAINT %I', constraint_name);
        END IF;
      END $$;
    `)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.quant_daily_settlements ADD CONSTRAINT quant_daily_settlements_two_people_check CHECK (approved_by IS NULL OR approved_by <> entered_by) NOT VALID`)
  }
}
