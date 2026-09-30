import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'

/**
 * 预测市场投注单（路线 A 内部盘）。
 * 下注时从用户 available 余额划出 stake 到平台池；开奖后按份额派彩或落定。
 */
@Entity({ schema: 'app', name: 'prediction_bets' })
@Unique('prediction_bets_user_idempotency_key', ['userId', 'idempotencyKey'])
export class PredictionBet {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'market_mapping_id', type: 'uuid' })
  marketMappingId!: string

  @Column({ name: 'token_id', type: 'text' })
  tokenId!: string

  /** 'YES' | 'NO'（镜像 Polymarket outcome 名） */
  @Column({ type: 'text' })
  side!: string

  /** 投注金额（USDT atomic，6 位小数）—— 用户被扣的全部金额（含下注费） */
  @Column({ name: 'stake_atomic', type: 'numeric', precision: 78, scale: 0 })
  stakeAtomic!: string

  /** 下注费（USDT atomic）：从 stakeAtomic 中扣除、即时计入平台收入的部分 */
  @Column({ name: 'fee_atomic', type: 'numeric', precision: 78, scale: 0, default: 0 })
  feeAtomic!: string

  /** 派彩费（USDT atomic）：赢家派彩时从毛派彩扣除；非赢家恒为 0 */
  @Column({ name: 'payout_fee_atomic', type: 'numeric', precision: 78, scale: 0, default: 0 })
  payoutFeeAtomic!: string

  /** 获得份额（18 位小数：(stake − fee) / price） */
  @Column({ type: 'numeric', precision: 38, scale: 18 })
  shares!: string

  /** 下注时锁定的价格（18 位小数，0~1） */
  @Column({ type: 'numeric', precision: 38, scale: 18 })
  price!: string

  /** placed | won | lost | void */
  @Column({ type: 'text', default: 'placed' })
  status!: string

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}

/**
 * 结算批次：每个市场只结算一次（幂等），留痕可审计。
 */
@Entity({ schema: 'app', name: 'prediction_settlement_runs' })
export class PredictionSettlementRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'market_mapping_id', type: 'uuid', unique: true })
  marketMappingId!: string

  /** 赢家 token；void 时为 null */
  @Column({ name: 'winning_token_id', type: 'text', nullable: true })
  winningTokenId!: string | null

  /** resolved | void */
  @Column({ type: 'text' })
  outcome!: string

  @Column({ name: 'bets_settled', type: 'integer' })
  betsSettled!: number

  @Column({ name: 'total_stake_atomic', type: 'numeric', precision: 78, scale: 0 })
  totalStakeAtomic!: string

  @Column({ name: 'total_paid_atomic', type: 'numeric', precision: 78, scale: 0 })
  totalPaidAtomic!: string

  /** 本批次结算抽取的派彩费合计（USDT atomic） */
  @Column({ name: 'total_fee_atomic', type: 'numeric', precision: 78, scale: 0, default: 0 })
  totalFeeAtomic!: string

  @CreateDateColumn({ name: 'executed_at', type: 'timestamptz' })
  executedAt!: Date
}

/**
 * 对冲决策（路线 A 庄家盘第 2 期）。
 *
 * 内部盘是固定赔率对赌池，庄家承担方向风险；本表记录"某市场应下多少对冲单"的
 * 计算结果与敞口前后快照。`mode = 'dry_run'` 只落决策、不碰 CLOB。
 */
@Entity({ schema: 'app', name: 'prediction_hedge_decisions' })
export class PredictionHedgeDecision {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'market_mapping_id', type: 'uuid' })
  marketMappingId!: string

  @Column({ name: 'token_mapping_id', type: 'uuid', nullable: true })
  tokenMappingId!: string | null

  /** 要买入的 outcome token id */
  @Column({ name: 'token_id', type: 'text' })
  tokenId!: string

  @Column({ type: 'text' })
  outcome!: string

  @Column({ type: 'text' })
  side!: 'BUY' | 'SELL'

  /** 目标买入份额（18 位小数），base 单位与 CLOB 一致 */
  @Column({ name: 'target_shares', type: 'numeric', precision: 38, scale: 18 })
  targetShares!: string

  /** 限价（18 位小数，0~1） */
  @Column({ name: 'limit_price', type: 'numeric', precision: 38, scale: 18 })
  limitPrice!: string

  /** 预估花费（USDT atomic） */
  @Column({ name: 'est_cost_atomic', type: 'numeric', precision: 78, scale: 0, default: 0 })
  estCostAtomic!: string

  /** 上游最小下单量（18 位小数），用于判断该单是否可执行 */
  @Column({ name: 'min_order_size', type: 'numeric', precision: 38, scale: 18, nullable: true })
  minOrderSize!: string | null

  /** 对冲比例（基点），10000 = 完全对冲为无方向风险 */
  @Column({ name: 'hedge_ratio_bps', type: 'integer', default: 10_000 })
  hedgeRatioBps!: number

  @Column({ type: 'text', default: 'dry_run' })
  mode!: 'dry_run' | 'live'

  @Column({ type: 'text', default: 'planned' })
  state!: 'planned' | 'skipped' | 'submitted' | 'filled' | 'failed' | 'cancelled'

  /** state = 'skipped' 时的原因（低于最小单 / 盘口太薄 / 未超阈值 …） */
  @Column({ name: 'skip_reason', type: 'text', nullable: true })
  skipReason!: string | null

  @Column({ name: 'exposure_before', type: 'jsonb', default: () => "'{}'::jsonb" })
  exposureBefore!: Record<string, unknown>

  @Column({ name: 'exposure_after', type: 'jsonb', default: () => "'{}'::jsonb" })
  exposureAfter!: Record<string, unknown>

  @Column({ name: 'provider_order_id', type: 'text', nullable: true })
  providerOrderId!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
