import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type PolymarketMarketState =
  | 'discovered'
  | 'active'
  | 'closed'
  | 'resolved'
  | 'archived'
  | 'suspended'

@Entity({ schema: 'app', name: 'polymarket_market_mappings' })
export class PolymarketMarketMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'product_id', type: 'uuid', nullable: true, unique: true })
  productId!: string | null

  @Column({ name: 'gamma_market_id', type: 'text', unique: true })
  gammaMarketId!: string

  @Column({ name: 'condition_id', type: 'text', nullable: true, unique: true })
  conditionId!: string | null

  @Column({ type: 'text' })
  slug!: string

  @Column({ type: 'text' })
  question!: string

  @Column({ type: 'text', default: 'discovered' })
  state!: PolymarketMarketState

  @Column({ type: 'boolean', default: false })
  restricted!: boolean

  @Column({ name: 'enable_order_book', type: 'boolean', default: false })
  enableOrderBook!: boolean

  @Column({ name: 'resolution_source', type: 'text', nullable: true })
  resolutionSource!: string | null

  @Column({ name: 'market_start_at', type: 'timestamptz', nullable: true })
  marketStartAt!: Date | null

  @Column({ name: 'market_end_at', type: 'timestamptz', nullable: true })
  marketEndAt!: Date | null

  @Column({ name: 'provider_updated_at', type: 'timestamptz', nullable: true })
  providerUpdatedAt!: Date | null

  @Column({ name: 'last_synced_at', type: 'timestamptz' })
  lastSyncedAt!: Date

  @Column({ name: 'raw_payload', type: 'jsonb', default: () => "'{}'::jsonb" })
  rawPayload!: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

export type PolymarketTokenState = 'active' | 'inactive' | 'resolved'

@Entity({ schema: 'app', name: 'polymarket_token_mappings' })
export class PolymarketTokenMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'market_mapping_id', type: 'uuid' })
  marketMappingId!: string

  @Column({ name: 'token_id', type: 'text', unique: true })
  tokenId!: string

  @Column({ type: 'text' })
  outcome!: string

  @Column({ name: 'outcome_index', type: 'smallint' })
  outcomeIndex!: number

  @Column({ type: 'text', default: 'active' })
  state!: PolymarketTokenState

  @Column({ name: 'tick_size', type: 'numeric', precision: 38, scale: 18, nullable: true })
  tickSize!: string | null

  @Column({ name: 'min_order_size', type: 'numeric', precision: 38, scale: 18, nullable: true })
  minOrderSize!: string | null

  @Column({ name: 'last_book_hash', type: 'text', nullable: true })
  lastBookHash!: string | null

  @Column({ name: 'last_book_at', type: 'timestamptz', nullable: true })
  lastBookAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

export type PolymarketSyncState = 'idle' | 'running' | 'degraded' | 'paused'

@Entity({ schema: 'app', name: 'polymarket_sync_watermarks' })
export class PolymarketSyncWatermark {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text', default: 'polymarket' })
  provider!: string

  @Column({ type: 'text' })
  stream!: 'gamma_markets' | 'clob_market' | 'clob_user' | 'data_positions' | 'settlements'

  @Column({ type: 'text', nullable: true })
  cursor!: string | null

  @Column({ type: 'text', default: 'idle' })
  state!: PolymarketSyncState

  @Column({ name: 'last_event_at', type: 'timestamptz', nullable: true })
  lastEventAt!: Date | null

  @Column({ name: 'last_success_at', type: 'timestamptz', nullable: true })
  lastSuccessAt!: Date | null

  @Column({ name: 'consecutive_failures', type: 'integer', default: 0 })
  consecutiveFailures!: number

  @Column({ name: 'last_error_code', type: 'text', nullable: true })
  lastErrorCode!: string | null

  @Column({ name: 'last_error_at', type: 'timestamptz', nullable: true })
  lastErrorAt!: Date | null

  @Column({ name: 'lease_owner', type: 'text', nullable: true })
  leaseOwner!: string | null

  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt!: Date | null

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity({ schema: 'app', name: 'polymarket_order_mappings' })
export class PolymarketOrderMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'local_order_id', type: 'uuid', unique: true })
  localOrderId!: string

  @Column({ name: 'market_mapping_id', type: 'uuid' })
  marketMappingId!: string

  @Column({ name: 'token_mapping_id', type: 'uuid' })
  tokenMappingId!: string

  @Column({ type: 'text', default: 'polymarket' })
  provider!: string

  @Column({ name: 'external_order_id', type: 'text', nullable: true })
  externalOrderId!: string | null

  @Column({ name: 'client_order_key', type: 'text', unique: true })
  clientOrderKey!: string

  @Column({ type: 'text' })
  side!: 'BUY' | 'SELL'

  @Column({ name: 'order_type', type: 'text' })
  orderType!: 'GTC' | 'GTD' | 'FOK' | 'FAK'

  @Column({ type: 'text', default: 'awaiting_user_signature' })
  state!: string

  @Column({ name: 'original_size', type: 'numeric', precision: 38, scale: 18 })
  originalSize!: string

  @Column({ name: 'matched_size', type: 'numeric', precision: 38, scale: 18, default: '0' })
  matchedSize!: string

  @Column({ name: 'limit_price', type: 'numeric', precision: 38, scale: 18 })
  limitPrice!: string

  @Column({ type: 'integer', default: 0 })
  revision!: number

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null

  @Column({ name: 'provider_updated_at', type: 'timestamptz', nullable: true })
  providerUpdatedAt!: Date | null

  @Column({ name: 'last_reconciled_at', type: 'timestamptz', nullable: true })
  lastReconciledAt!: Date | null

  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity({ schema: 'app', name: 'polymarket_external_events' })
@Index(['provider', 'channel', 'externalEventKey'], { unique: true })
export class PolymarketExternalEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'text', default: 'polymarket' })
  provider!: string

  @Column({ type: 'text' })
  channel!: 'market' | 'user' | 'rest_reconciliation'

  @Column({ name: 'external_event_key', type: 'text' })
  externalEventKey!: string

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string

  @Column({ name: 'market_condition_id', type: 'text', nullable: true })
  marketConditionId!: string | null

  @Column({ name: 'external_order_id', type: 'text', nullable: true })
  externalOrderId!: string | null

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>

  @Column({ name: 'payload_sha256', type: 'bytea' })
  payloadSha256!: Buffer

  @Column({ name: 'processing_state', type: 'text', default: 'received' })
  processingState!: 'received' | 'processing' | 'processed' | 'ignored' | 'failed'

  @Column({ name: 'processing_attempts', type: 'integer', default: 0 })
  processingAttempts!: number

  @Column({ name: 'last_error_code', type: 'text', nullable: true })
  lastErrorCode!: string | null

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null
}

@Entity({ schema: 'app', name: 'polymarket_settlement_mappings' })
export class PolymarketSettlementMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'market_mapping_id', type: 'uuid', unique: true })
  marketMappingId!: string

  @Column({ type: 'text', default: 'polymarket' })
  provider!: string

  @Column({ name: 'external_settlement_id', type: 'text' })
  externalSettlementId!: string

  @Column({ name: 'winning_token_mapping_id', type: 'uuid', nullable: true })
  winningTokenMappingId!: string | null

  @Column({ type: 'text' })
  outcome!: string

  @Column({ type: 'text', default: 'observed' })
  state!: 'observed' | 'confirmed' | 'disputed' | 'reversed'

  @Column({ name: 'payout_value', type: 'numeric', precision: 38, scale: 18 })
  payoutValue!: string

  @Column({ name: 'resolved_at', type: 'timestamptz' })
  resolvedAt!: Date

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload!: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity({ schema: 'app', name: 'polymarket_reconciliation_cases' })
export class PolymarketReconciliationCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'market_mapping_id', type: 'uuid', nullable: true })
  marketMappingId!: string | null

  @Column({ name: 'local_order_id', type: 'uuid', nullable: true })
  localOrderId!: string | null

  @Column({ name: 'order_mapping_id', type: 'uuid', nullable: true })
  orderMappingId!: string | null

  @Column({ name: 'case_type', type: 'text' })
  caseType!: string

  @Column({ type: 'text' })
  severity!: 'low' | 'medium' | 'high' | 'critical'

  @Column({ type: 'text', default: 'open' })
  state!: 'open' | 'investigating' | 'resolved' | 'ignored'

  @Column({ name: 'external_reference', type: 'text', nullable: true })
  externalReference!: string | null

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  expected!: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  actual!: Record<string, unknown>

  @CreateDateColumn({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null

  @Column({ name: 'resolution_code', type: 'text', nullable: true })
  resolutionCode!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
