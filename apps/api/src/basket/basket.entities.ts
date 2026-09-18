import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export type BasketStrategyStatus = 'draft' | 'active' | 'paused' | 'retired'
export type BasketStrategyVersionStatus = 'draft' | 'active' | 'retired'
export type BasketPortfolioStatus = 'draft' | 'pilot' | 'active' | 'closed'
export type BasketRequestStatus =
  | 'pending'
  | 'accepted'
  | 'pricing'
  | 'investing'
  | 'settled'
  | 'failed'
  | 'cancelled'
export type BasketRebalanceTrigger = 'scheduled' | 'drift' | 'risk' | 'manual'
export type BasketRebalanceRunStatus = 'planned' | 'running' | 'completed' | 'failed' | 'cancelled'
export type BasketRebalanceOrderStatus =
  | 'planned'
  | 'quoted'
  | 'executing'
  | 'filled'
  | 'partial'
  | 'failed'
  | 'cancelled'
export type BasketExecutionRoute =
  | 'dex'
  | 'cex'
  | 'issuer_subscription'
  | 'issuer_redemption'
  | 'broker'
  | 'otc'
  | 'manual'

@Entity({ schema: 'app', name: 'basket_strategies' })
export class BasketStrategy {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string

  @Column({ type: 'varchar', length: 160 })
  name!: string

  @Column({ type: 'text', nullable: true })
  description?: string | null

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: BasketStrategyStatus

  @Column({ type: 'varchar', length: 16, nullable: true })
  risk_level?: 'low' | 'medium' | 'high' | null

  @Column({ type: 'varchar', length: 16, default: 'USDT' })
  base_currency!: string

  @Column({ type: 'varchar', length: 120, nullable: true })
  benchmark?: string | null

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  rebalance_mode!: 'manual' | 'auto'

  @Column({ type: 'varchar', length: 24, default: 'weekly' })
  rebalance_frequency!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  minimum_subscription_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  minimum_redemption_usd?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  cash_buffer_target_pct?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'basket_strategy_versions' })
export class BasketStrategyVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  strategy_id!: string

  @Column({ type: 'int' })
  version!: number

  @Column({ type: 'timestamptz', default: () => 'now()' })
  effective_from!: Date

  @Column({ type: 'timestamptz', nullable: true })
  effective_to?: Date | null

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: BasketStrategyVersionStatus

  @Column({ type: 'jsonb', nullable: true })
  methodology?: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  risk_rules?: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  scoring_weights?: Record<string, unknown> | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'basket_strategy_assets' })
export class BasketStrategyAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  strategy_version_id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'numeric', precision: 9, scale: 4 })
  target_weight_pct!: string

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  min_weight_pct?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  max_weight_pct?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  score?: string | null

  @Column({ type: 'text', nullable: true })
  inclusion_reason?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'basket_portfolios' })
export class BasketPortfolio {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  strategy_id!: string

  @Column({ type: 'uuid', nullable: true })
  strategy_version_id?: string | null

  @Column({ type: 'varchar', length: 160 })
  name!: string

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status!: BasketPortfolioStatus

  @Column({ type: 'varchar', length: 16, default: 'USDT' })
  base_currency!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, default: 0 })
  total_units!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  nav_per_unit?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  aum_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, default: 0 })
  cash_balance_usd!: string

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'basket_holdings' })
export class BasketHolding {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  portfolio_id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'uuid', nullable: true })
  network_id?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, default: 0 })
  quantity!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  cost_basis_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  market_value_usd?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  target_weight_pct?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  actual_weight_pct?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  unrealized_pnl_usd?: string | null

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'basket_nav_snapshots' })
export class BasketNavSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  portfolio_id!: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp!: Date

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  gross_asset_value_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  liabilities_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  net_asset_value_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  total_units?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  nav_per_unit?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  cash_usd?: string | null

  @Column({ type: 'varchar', length: 16, default: 'ok' })
  data_quality!: 'ok' | 'stale' | 'partial'

  @Column({ type: 'timestamptz', nullable: true })
  pricing_timestamp?: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'basket_subscriptions' })
export class BasketSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'uuid' })
  portfolio_id!: string

  @Column({ type: 'numeric', precision: 36, scale: 18 })
  amount_usd!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  nav_per_unit?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  units_issued?: string | null

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: BasketRequestStatus

  @Column({ type: 'timestamptz', default: () => 'now()' })
  requested_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  priced_at?: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  settled_at?: Date | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  ledger_reference?: string | null

  @Column({ type: 'varchar', length: 160, nullable: true, unique: true })
  idempotency_key?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'basket_redemptions' })
export class BasketRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'uuid' })
  portfolio_id!: string

  @Column({ type: 'numeric', precision: 36, scale: 18 })
  units!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  nav_per_unit?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  gross_amount_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  fees_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  net_amount_usd?: string | null

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: BasketRequestStatus

  @Column({ type: 'timestamptz', default: () => 'now()' })
  requested_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  priced_at?: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  settled_at?: Date | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  ledger_reference?: string | null

  @Column({ type: 'varchar', length: 160, nullable: true, unique: true })
  idempotency_key?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'basket_rebalance_runs' })
export class BasketRebalanceRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  portfolio_id!: string

  @Column({ type: 'uuid', nullable: true })
  strategy_version_id?: string | null

  @Column({ type: 'varchar', length: 16 })
  trigger_type!: BasketRebalanceTrigger

  @Column({ type: 'varchar', length: 16, default: 'planned' })
  status!: BasketRebalanceRunStatus

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  pre_nav?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  post_nav?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  estimated_turnover_pct?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  actual_turnover_pct?: string | null

  @Column({ type: 'text', nullable: true })
  reason?: string | null

  @Column({ type: 'uuid', nullable: true })
  ai_analysis_id?: string | null

  @Column({ type: 'jsonb', nullable: true })
  risk_evaluation?: Record<string, unknown> | null

  @Column({ type: 'timestamptz', nullable: true })
  started_at?: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  completed_at?: Date | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'basket_rebalance_orders' })
export class BasketRebalanceOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  rebalance_run_id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'varchar', length: 8 })
  side!: 'buy' | 'sell'

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  target_quantity?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  executed_quantity?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  estimated_price?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  average_fill_price?: string | null

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  max_slippage_pct?: string | null

  @Column({ type: 'varchar', length: 16, default: 'planned' })
  status!: BasketRebalanceOrderStatus

  @Column({ type: 'varchar', length: 32, nullable: true })
  execution_route?: BasketExecutionRoute | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  external_order_id?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'risk_disclosures' })
export class RiskDisclosure {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 32, default: 'basket' })
  product_type!: string

  @Column({ type: 'uuid', nullable: true })
  strategy_id?: string | null

  @Column({ type: 'int' })
  version!: number

  @Column({ type: 'varchar', length: 200 })
  title!: string

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  effective_from!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'user_risk_acknowledgements' })
export class UserRiskAcknowledgement {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'uuid' })
  disclosure_id!: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  accepted_at!: Date

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip_hash?: string | null

  @Column({ type: 'varchar', length: 300, nullable: true })
  user_agent?: string | null

  @Column({ type: 'int' })
  version!: number
}
