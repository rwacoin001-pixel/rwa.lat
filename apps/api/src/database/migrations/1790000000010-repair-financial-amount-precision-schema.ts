import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Reconcile databases where migration 0009 was recorded after an earlier
 * version of that file had run. Migration 0009 remains the canonical owner of
 * these columns; this migration safely brings older local schemas forward.
 */
export class RepairFinancialAmountPrecisionSchema1790000000010 implements MigrationInterface {
  name = 'RepairFinancialAmountPrecisionSchema1790000000010'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.position_snapshots
        ADD COLUMN IF NOT EXISTS snapshot_batch_id uuid,
        ALTER COLUMN currency TYPE varchar(10);
      CREATE INDEX IF NOT EXISTS position_snapshots_batch_idx
        ON app.position_snapshots (user_id, snapshot_batch_id, captured_at DESC)
        WHERE snapshot_batch_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS position_snapshots_batch_product_uq
        ON app.position_snapshots (user_id, snapshot_batch_id, product_id)
        WHERE snapshot_batch_id IS NOT NULL;

      ALTER TABLE app.redemptions
        ADD COLUMN IF NOT EXISTS quote_decimals smallint NOT NULL DEFAULT 6,
        ALTER COLUMN currency TYPE varchar(10);
      UPDATE app.redemptions SET quote_decimals = 6 WHERE quote_decimals IS NULL;
      ALTER TABLE app.redemptions
        ALTER COLUMN quote_decimals SET DEFAULT 6,
        ALTER COLUMN quote_decimals SET NOT NULL;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
           WHERE conrelid = 'app.redemptions'::regclass
             AND conname = 'redemptions_quote_decimals_check'
        ) THEN
          ALTER TABLE app.redemptions
            ADD CONSTRAINT redemptions_quote_decimals_check
            CHECK (quote_decimals BETWEEN 0 AND 30);
        END IF;
      END
      $$;

      ALTER TABLE app.price_quotes
        DROP CONSTRAINT IF EXISTS price_quotes_currency_check,
        ADD CONSTRAINT price_quotes_currency_check
          CHECK (currency ~ '^[A-Z]{3,10}$');
      ALTER TABLE app.orders
        DROP CONSTRAINT IF EXISTS orders_quote_currency_check,
        ADD CONSTRAINT orders_quote_currency_check
          CHECK (quote_currency IS NULL OR quote_currency ~ '^[A-Z]{3,10}$');
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The repaired fields belong to migration 0009's canonical schema. Keeping
    // them is safer than making a repaired database drift again on rollback.
    await queryRunner.query('SELECT 1')
  }
}
