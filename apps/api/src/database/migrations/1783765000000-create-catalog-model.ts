import type { MigrationInterface, QueryRunner } from 'typeorm'

// DB-004: 资产、产品、披露文件、报价与价格快照模型
// 四类资产（rwa / compute / stocks / prediction）共用核心状态模型；
// 产品配置可版本化；报价带新鲜度窗口，过期不能用于下单。
export class CreateCatalogModel1783765000000 implements MigrationInterface {
  name = 'CreateCatalogModel1783765000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.asset_classes (
        id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{1,31}$'),
        display_name text NOT NULL,
        description text,
        state text NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'deprecated')),
        created_at timestamptz NOT NULL DEFAULT now(),
        deprecated_at timestamptz,
        CHECK ((state = 'deprecated') = (deprecated_at IS NOT NULL))
      );

      CREATE TABLE app.products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_class_id text NOT NULL REFERENCES app.asset_classes(id) ON DELETE RESTRICT,
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        external_ref text,
        display_name text NOT NULL,
        summary text,
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        asset_decimals smallint NOT NULL CHECK (asset_decimals BETWEEN 0 AND 30),
        network text CHECK (network IN ('tron', 'ethereum', 'arbitrum', 'polygon', 'solana')),
        min_order_atomic_amount app.atomic_unit_amount,
        max_order_atomic_amount app.atomic_unit_amount,
        state text NOT NULL DEFAULT 'draft'
          CHECK (state IN ('draft', 'published', 'suspended', 'retired')),
        published_at timestamptz,
        retired_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (asset_class_id, external_ref),
        UNIQUE (id, version),
        CHECK ((state = 'published') = (published_at IS NOT NULL)),
        CHECK ((state = 'retired') = (retired_at IS NOT NULL)),
        CHECK (min_order_atomic_amount IS NULL OR max_order_atomic_amount IS NULL
               OR min_order_atomic_amount <= max_order_atomic_amount)
      );

      CREATE INDEX products_asset_class_state_idx
        ON app.products(asset_class_id, state, published_at DESC);

      CREATE TABLE app.disclosure_files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('prospectus', 'risk_disclosure', 'terms', 'regulatory')),
        locale text NOT NULL CHECK (locale ~ '^[a-z]{2}(_[A-Z]{2})?$'),
        title text NOT NULL,
        storage_ref text NOT NULL,
        content_hash bytea NOT NULL,
        state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'superseded', 'removed')),
        published_at timestamptz NOT NULL DEFAULT now(),
        superseded_at timestamptz,
        CHECK ((state = 'superseded') = (superseded_at IS NOT NULL))
      );

      CREATE INDEX disclosure_files_product_idx
        ON app.disclosure_files(product_id, state, published_at DESC);

      CREATE TABLE app.price_quotes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
        asset_code text NOT NULL CHECK (asset_code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
        unit_price_atomic_amount app.atomic_unit_amount NOT NULL CHECK (unit_price_atomic_amount > 0),
        currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
        source text NOT NULL,
        valid_until timestamptz NOT NULL,
        captured_at timestamptz NOT NULL DEFAULT now(),
        CHECK (valid_until > captured_at),
        UNIQUE (product_id, source, captured_at)
      );

      CREATE INDEX price_quotes_product_valid_idx
        ON app.price_quotes(product_id, valid_until DESC);

      CREATE TABLE app.price_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
        quote_id uuid NOT NULL REFERENCES app.price_quotes(id) ON DELETE RESTRICT,
        unit_price_atomic_amount app.atomic_unit_amount NOT NULL,
        currency text NOT NULL,
        captured_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX price_snapshots_product_captured_idx
        ON app.price_snapshots(product_id, captured_at DESC);
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS app.price_snapshots;
      DROP TABLE IF EXISTS app.price_quotes;
      DROP TABLE IF EXISTS app.disclosure_files;
      DROP TABLE IF EXISTS app.products;
      DROP TABLE IF EXISTS app.asset_classes;
    `)
  }
}
