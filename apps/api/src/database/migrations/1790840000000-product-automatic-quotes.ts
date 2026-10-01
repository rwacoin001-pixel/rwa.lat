import { MigrationInterface, QueryRunner } from 'typeorm'

export class ProductAutomaticQuotes1790840000000 implements MigrationInterface {
  name = 'ProductAutomaticQuotes1790840000000'
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE app.products
      ADD COLUMN quote_binding_json jsonb,
      ADD COLUMN quote_sync_checked_at timestamptz,
      ADD COLUMN quote_sync_error text,
      ADD CONSTRAINT products_quote_binding_object CHECK (quote_binding_json IS NULL OR jsonb_typeof(quote_binding_json)='object')`)
    await q.query(`CREATE UNIQUE INDEX price_quotes_automatic_source_timestamp
      ON app.price_quotes(product_id, source, captured_at) WHERE source LIKE 'automatic:%'`)
  }
  async down(q: QueryRunner): Promise<void> {
    const [row] = await q.query(`SELECT EXISTS(SELECT 1 FROM app.products WHERE quote_binding_json IS NOT NULL) AS used`)
    if (row.used) throw new Error('Cannot remove configured automatic quote bindings')
    await q.query(`DROP INDEX app.price_quotes_automatic_source_timestamp;
      ALTER TABLE app.products DROP CONSTRAINT products_quote_binding_object,
      DROP COLUMN quote_binding_json, DROP COLUMN quote_sync_checked_at, DROP COLUMN quote_sync_error`)
  }
}
