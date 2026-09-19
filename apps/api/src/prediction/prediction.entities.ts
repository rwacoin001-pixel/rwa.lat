import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

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

  /** 投注金额（USDT atomic，6 位小数） */
  @Column({ name: 'stake_atomic', type: 'numeric', precision: 78, scale: 0 })
  stakeAtomic!: string

  /** 获得份额（18 位小数：stake / price） */
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

  @CreateDateColumn({ name: 'executed_at', type: 'timestamptz' })
  executedAt!: Date
}
