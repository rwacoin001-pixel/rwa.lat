import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export type RwaAssetClass =
  | 'treasury'
  | 'money_market'
  | 'private_credit'
  | 'real_estate'
  | 'commodity'
  | 'equity'
  | 'bond'
  | 'fund'
  | 'currency'
  | 'stable_value'
  | 'other'

export type RwaAssetStatus = 'active' | 'paused' | 'delisted'
export type RwaEligibilityType = 'public' | 'accredited' | 'restricted' | 'unknown'
export type RwaRedemptionType = 'instant' | 'daily' | 'periodic' | 'restricted' | 'unknown'
export type RwaSyncStatus = 'pending' | 'ok' | 'partial' | 'failed'

@Entity({ schema: 'app', name: 'rwa_issuers' })
export class RwaIssuer {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 200 })
  name!: string

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string

  @Column({ type: 'text', nullable: true })
  description?: string | null

  @Column({ type: 'varchar', length: 8, nullable: true })
  country_code?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  website_url?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url?: string | null

  @Column({ type: 'boolean', default: false })
  verified!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_networks' })
export class RwaNetwork {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 120 })
  name!: string

  @Column({ type: 'varchar', length: 80, unique: true })
  slug!: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  chain_id?: string | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  native_symbol?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  explorer_url?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url?: string | null

  @Column({ type: 'boolean', default: true })
  active!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_assets' })
export class RwaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 160, unique: true })
  slug!: string

  @Column({ type: 'varchar', length: 200 })
  name!: string

  @Column({ type: 'varchar', length: 32, nullable: true })
  symbol?: string | null

  @Column({ type: 'varchar', length: 32 })
  asset_class!: RwaAssetClass

  @Column({ type: 'text', nullable: true })
  description?: string | null

  @Column({ type: 'uuid', nullable: true })
  issuer_id?: string | null

  @Column({ type: 'varchar', length: 8, nullable: true })
  country_code?: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  region?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  website_url?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url?: string | null

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: RwaAssetStatus

  @Column({ type: 'int', nullable: true })
  rwa_rank?: number | null

  @Column({ type: 'boolean', default: false })
  is_tokenized!: boolean

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean

  @Column({ type: 'boolean', default: false })
  is_featured!: boolean

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  eligibility_type!: RwaEligibilityType

  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  redemption_type!: RwaRedemptionType

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_asset_contracts' })
export class RwaAssetContract {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'uuid' })
  network_id!: string

  @Column({ type: 'varchar', length: 200 })
  contract_address!: string

  @Column({ type: 'varchar', length: 200, nullable: true })
  token_name?: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  token_symbol?: string | null

  @Column({ type: 'int', nullable: true })
  decimals?: number | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  token_standard?: string | null

  @Column({ type: 'boolean', default: false })
  verified!: boolean

  @Column({ type: 'boolean', default: false })
  transfer_restricted!: boolean

  @Column({ type: 'boolean', default: false })
  whitelist_required!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_asset_sources' })
export class RwaAssetSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'varchar', length: 40 })
  provider!: string

  @Column({ type: 'varchar', length: 120 })
  external_id!: string

  @Column({ type: 'varchar', length: 160, nullable: true })
  external_slug?: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  source_url?: string | null

  @Column({ type: 'timestamptz', nullable: true })
  last_synced_at?: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  last_successful_sync_at?: Date | null

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  sync_status!: RwaSyncStatus

  @Column({ type: 'jsonb', nullable: true })
  raw_metadata?: Record<string, unknown> | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_asset_metrics' })
export class RwaAssetMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid', unique: true })
  asset_id!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  price_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  market_cap_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  tokenized_market_cap_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  tvl_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  volume_24h_usd?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  apy?: string | null

  @Column({ type: 'bigint', nullable: true })
  holders?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  total_supply?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  change_24h_pct?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  change_7d_pct?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  change_30d_pct?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  liquidity_score?: string | null

  @Column({ type: 'timestamptz', nullable: true })
  data_timestamp?: Date | null

  @Column({ type: 'varchar', length: 40, nullable: true })
  source?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_asset_metric_history' })
export class RwaAssetMetricHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'date' })
  date!: string

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  price_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  market_cap_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  tvl_usd?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  volume_24h_usd?: string | null

  @Column({ type: 'numeric', precision: 18, scale: 8, nullable: true })
  apy?: string | null

  @Column({ type: 'bigint', nullable: true })
  holders?: string | null

  @Column({ type: 'numeric', precision: 36, scale: 18, nullable: true })
  total_supply?: string | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

@Entity({ schema: 'app', name: 'rwa_sync_runs' })
export class RwaSyncRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 40 })
  provider!: string

  @Column({ type: 'varchar', length: 32 })
  kind!: 'assets' | 'issuers' | 'metrics' | 'snapshot'

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: 'pending' | 'running' | 'success' | 'partial' | 'failed'

  @Column({ type: 'timestamptz', default: () => 'now()' })
  started_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  finished_at?: Date | null

  @Column({ type: 'int', nullable: true })
  items_total?: number | null

  @Column({ type: 'int', nullable: true })
  items_upserted?: number | null

  @Column({ type: 'int', nullable: true })
  items_failed?: number | null

  @Column({ type: 'text', nullable: true })
  error?: string | null

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
