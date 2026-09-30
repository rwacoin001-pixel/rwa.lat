import { Column, Entity, PrimaryColumn } from 'typeorm'

export type TradingPairState = 'active' | 'paused' | 'delisted'
export type TradingOrderSide = 'buy' | 'sell'
export type TradingOrderType = 'limit' | 'market'
export type TradingOrderState = 'open' | 'partial' | 'filled' | 'cancelled' | 'rejected'

const numeric = {
  to: (value: number) => value,
  from: (value: string | number) => Number(value),
}

@Entity({ schema: 'app', name: 'trading_pairs' })
export class TradingPair {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'varchar' })
  symbol!: string

  @Column({ name: 'base_asset_id', type: 'uuid' })
  baseAssetId!: string

  @Column({ name: 'quote_asset_code', type: 'varchar', default: 'USDT' })
  quoteAssetCode!: string

  @Column({ name: 'quote_decimals', type: 'integer', default: 6 })
  quoteDecimals!: number

  @Column({ name: 'base_decimals', type: 'integer', default: 6 })
  baseDecimals!: number

  @Column({ name: 'tick_size', type: 'numeric', precision: 30, scale: 10, default: 0.0001, transformer: numeric })
  tickSize!: number

  @Column({ name: 'min_quantity', type: 'numeric', precision: 30, scale: 10, default: 1, transformer: numeric })
  minQuantity!: number

  @Column({ type: 'varchar', default: 'active' })
  state!: TradingPairState

  @Column({ name: 'last_price', type: 'numeric', precision: 30, scale: 10, nullable: true, transformer: numeric })
  lastPrice!: number | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity({ schema: 'app', name: 'trading_orders' })
export class TradingOrder {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'pair_id', type: 'uuid' })
  pairId!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar' })
  side!: TradingOrderSide

  @Column({ type: 'varchar', default: 'limit' })
  type!: TradingOrderType

  @Column({ type: 'numeric', precision: 30, scale: 10, nullable: true, transformer: numeric })
  price!: number | null

  @Column({ type: 'numeric', precision: 30, scale: 10, transformer: numeric })
  quantity!: number

  @Column({ name: 'filled_quantity', type: 'numeric', precision: 30, scale: 10, default: 0, transformer: numeric })
  filledQuantity!: number

  @Column({ type: 'varchar', default: 'open' })
  state!: TradingOrderState

  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}

@Entity({ schema: 'app', name: 'trading_fills' })
export class TradingFill {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'pair_id', type: 'uuid' })
  pairId!: string

  @Column({ type: 'numeric', precision: 30, scale: 10, transformer: numeric })
  price!: number

  @Column({ type: 'numeric', precision: 30, scale: 10, transformer: numeric })
  quantity!: number

  @Column({ name: 'buy_order_id', type: 'uuid' })
  buyOrderId!: string

  @Column({ name: 'sell_order_id', type: 'uuid' })
  sellOrderId!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
