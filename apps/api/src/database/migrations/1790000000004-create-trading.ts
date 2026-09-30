import type { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * 交易系统（二级市场）：交易对、订单与成交。
 */
export class CreateTrading1790000000004 implements MigrationInterface {
  name = 'CreateTrading1790000000004'

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.trading_pairs (
        id uuid PRIMARY KEY,
        symbol varchar NOT NULL UNIQUE,
        base_asset_id uuid NOT NULL,
        quote_asset_code varchar NOT NULL DEFAULT 'USDT',
        quote_decimals integer NOT NULL DEFAULT 6,
        base_decimals integer NOT NULL DEFAULT 6,
        tick_size numeric(30, 10) NOT NULL DEFAULT 0.0001,
        min_quantity numeric(30, 10) NOT NULL DEFAULT 1,
        state varchar NOT NULL DEFAULT 'active',
        last_price numeric(30, 10) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trading_pairs_state_check CHECK (state IN ('active', 'paused', 'delisted'))
      )
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.trading_orders (
        id uuid PRIMARY KEY,
        pair_id uuid NOT NULL REFERENCES app.trading_pairs(id),
        user_id uuid NOT NULL,
        side varchar NOT NULL,
        type varchar NOT NULL DEFAULT 'limit',
        price numeric(30, 10) NULL,
        quantity numeric(30, 10) NOT NULL,
        filled_quantity numeric(30, 10) NOT NULL DEFAULT 0,
        state varchar NOT NULL DEFAULT 'open',
        idempotency_key varchar NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trading_orders_side_check CHECK (side IN ('buy', 'sell')),
        CONSTRAINT trading_orders_type_check CHECK (type IN ('limit', 'market')),
        CONSTRAINT trading_orders_state_check CHECK (state IN ('open', 'partial', 'filled', 'cancelled', 'rejected')),
        CONSTRAINT trading_orders_quantity_check CHECK (quantity > 0)
      )
    `)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_trading_orders_idem
        ON app.trading_orders (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trading_orders_book
        ON app.trading_orders (pair_id, side, state, price, created_at)
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trading_orders_user
        ON app.trading_orders (user_id, created_at DESC)
    `)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app.trading_fills (
        id uuid PRIMARY KEY,
        pair_id uuid NOT NULL REFERENCES app.trading_pairs(id),
        price numeric(30, 10) NOT NULL,
        quantity numeric(30, 10) NOT NULL,
        buy_order_id uuid NOT NULL REFERENCES app.trading_orders(id),
        sell_order_id uuid NOT NULL REFERENCES app.trading_orders(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trading_fills_quantity_check CHECK (quantity > 0)
      )
    `)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trading_fills_pair
        ON app.trading_fills (pair_id, created_at DESC)
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app.trading_fills`)
    await queryRunner.query(`DROP TABLE IF EXISTS app.trading_orders`)
    await queryRunner.query(`DROP TABLE IF EXISTS app.trading_pairs`)
  }
}
