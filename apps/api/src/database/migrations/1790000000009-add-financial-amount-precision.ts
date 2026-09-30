import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Make the decimal scale of quoted prices and financial order values explicit.
 * Existing quote producers and order arithmetic have always treated prices as
 * six-decimal amounts, so existing quotes are backfilled at that scale.
 * Legacy position snapshots did not persist their quote scale, so that field
 * stays NULL until a new, correctly scaled snapshot is captured.
 */
export class AddFinancialAmountPrecision1790000000009 implements MigrationInterface {
  name = 'AddFinancialAmountPrecision1790000000009'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.price_quotes
        ADD COLUMN unit_price_decimals smallint NOT NULL DEFAULT 6
          CHECK (unit_price_decimals BETWEEN 0 AND 30);
      ALTER TABLE app.price_quotes
        DROP CONSTRAINT IF EXISTS price_quotes_currency_check,
        ADD CONSTRAINT price_quotes_currency_check
          CHECK (currency ~ '^[A-Z]{3,10}$');
      ALTER TABLE app.price_snapshots
        ADD COLUMN unit_price_decimals smallint NOT NULL DEFAULT 6
          CHECK (unit_price_decimals BETWEEN 0 AND 30);
      ALTER TABLE app.position_snapshots
        ADD COLUMN unit_price_decimals smallint
          CHECK (unit_price_decimals IS NULL OR unit_price_decimals BETWEEN 0 AND 30),
        ADD COLUMN snapshot_batch_id uuid,
        ALTER COLUMN currency TYPE varchar(10);
      CREATE INDEX position_snapshots_batch_idx
        ON app.position_snapshots (user_id, snapshot_batch_id, captured_at DESC)
        WHERE snapshot_batch_id IS NOT NULL;
      CREATE UNIQUE INDEX position_snapshots_batch_product_uq
        ON app.position_snapshots (user_id, snapshot_batch_id, product_id)
        WHERE snapshot_batch_id IS NOT NULL;

      ALTER TABLE app.redemptions
        ADD COLUMN quote_decimals smallint NOT NULL DEFAULT 6
          CHECK (quote_decimals BETWEEN 0 AND 30),
        ALTER COLUMN currency TYPE varchar(10);

      ALTER TABLE app.orders
        ADD COLUMN product_asset_code text,
        ADD COLUMN product_asset_decimals smallint,
        ADD COLUMN quote_currency text,
        ADD COLUMN quote_decimals smallint;

      UPDATE app.orders o
         SET product_asset_code = p.asset_code,
             product_asset_decimals = p.asset_decimals
        FROM app.products p
       WHERE p.id = o.product_id;

      WITH matching_quotes AS (
        SELECT DISTINCT ON (o.id)
               o.id AS order_id, q.currency, q.unit_price_decimals
          FROM app.orders o
          JOIN app.price_quotes q
            ON q.product_id = o.product_id
           AND q.unit_price_atomic_amount = o.unit_price_atomic_amount
           AND q.captured_at <= o.submitted_at
         ORDER BY o.id, q.captured_at DESC, q.id DESC
      )
      UPDATE app.orders o
         SET quote_currency = q.currency,
             quote_decimals = q.unit_price_decimals
        FROM matching_quotes q
       WHERE q.order_id = o.id;

      -- Before this migration the order quantity formula implicitly used a
      -- six-decimal quote scale. Preserve that exact interpretation for legacy
      -- orders whose original quote row is no longer available.
      UPDATE app.orders SET quote_decimals = 6 WHERE quote_decimals IS NULL;

      ALTER TABLE app.orders
        ALTER COLUMN product_asset_code SET NOT NULL,
        ALTER COLUMN product_asset_decimals SET NOT NULL,
        ALTER COLUMN quote_decimals SET NOT NULL,
        ADD CONSTRAINT orders_product_asset_decimals_check
          CHECK (product_asset_decimals BETWEEN 0 AND 30),
        ADD CONSTRAINT orders_quote_decimals_check
          CHECK (quote_decimals BETWEEN 0 AND 30),
        ADD CONSTRAINT orders_quote_currency_check
          CHECK (quote_currency IS NULL OR quote_currency ~ '^[A-Z]{3,10}$');
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM app.price_quotes WHERE currency !~ '^[A-Z]{3}$')
          OR EXISTS (SELECT 1 FROM app.price_quotes WHERE unit_price_decimals <> 6)
          OR EXISTS (SELECT 1 FROM app.price_snapshots WHERE unit_price_decimals <> 6)
          OR EXISTS (SELECT 1 FROM app.position_snapshots WHERE unit_price_decimals IS NOT NULL AND unit_price_decimals <> 6)
          OR EXISTS (SELECT 1 FROM app.position_snapshots WHERE snapshot_batch_id IS NOT NULL)
          OR EXISTS (SELECT 1 FROM app.redemptions WHERE currency !~ '^[A-Z]{3}$' OR currency NOT IN ('USD', 'USDT') OR quote_decimals <> 6)
          OR EXISTS (SELECT 1 FROM app.orders WHERE quote_decimals <> 6 OR (quote_currency IS NOT NULL AND (quote_currency !~ '^[A-Z]{3}$' OR quote_currency NOT IN ('USD', 'USDT'))))
        THEN
          RAISE EXCEPTION 'Cannot revert AddFinancialAmountPrecision1790000000009: data uses batch snapshots, unsupported quote currencies, or non-six-decimal price scales.';
        END IF;
      END
      $$;
      ALTER TABLE app.orders
        DROP CONSTRAINT IF EXISTS orders_quote_currency_check,
        DROP CONSTRAINT IF EXISTS orders_quote_decimals_check,
        DROP CONSTRAINT IF EXISTS orders_product_asset_decimals_check,
        DROP COLUMN quote_decimals,
        DROP COLUMN quote_currency,
        DROP COLUMN product_asset_decimals,
        DROP COLUMN product_asset_code;
      ALTER TABLE app.redemptions
        DROP CONSTRAINT IF EXISTS redemptions_quote_decimals_check,
        DROP COLUMN quote_decimals,
        ALTER COLUMN currency TYPE text;
      DROP INDEX IF EXISTS app.position_snapshots_batch_product_uq;
      DROP INDEX IF EXISTS app.position_snapshots_batch_idx;
      ALTER TABLE app.position_snapshots
        DROP COLUMN snapshot_batch_id,
        DROP COLUMN unit_price_decimals,
        ALTER COLUMN currency TYPE text;
      ALTER TABLE app.price_quotes
        DROP CONSTRAINT IF EXISTS price_quotes_currency_check,
        ADD CONSTRAINT price_quotes_currency_check CHECK (currency ~ '^[A-Z]{3}$');
      ALTER TABLE app.price_snapshots DROP COLUMN unit_price_decimals;
      ALTER TABLE app.price_quotes DROP COLUMN unit_price_decimals;
    `)
  }
}
