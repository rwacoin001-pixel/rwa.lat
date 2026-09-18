import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type RwaRiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** 量化评分（Quant Engine 产物；非 LLM 主观打分） */
@Entity({ schema: 'app', name: 'rwa_asset_scores' })
export class RwaAssetScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'varchar', length: 32 })
  score_version!: string

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  yield_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  liquidity_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  issuer_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  collateral_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  redemption_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  contract_risk_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  concentration_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  market_risk_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  data_quality_score?: string | null

  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true })
  overall_score?: string | null

  @Column({ type: 'varchar', length: 16, nullable: true })
  risk_level?: RwaRiskLevel | null

  @Column({ type: 'timestamptz', default: () => 'now()' })
  calculated_at!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}

/** LLM 研究输出（结构化摘要 + signals；不存 CoT） */
@Entity({ schema: 'app', name: 'rwa_ai_analysis' })
export class RwaAiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  asset_id!: string

  @Column({ type: 'varchar', length: 80 })
  model!: string

  @Column({ type: 'varchar', length: 32 })
  analysis_version!: string

  @Column({ type: 'text', nullable: true })
  summary?: string | null

  @Column({ type: 'text', nullable: true })
  bull_case?: string | null

  @Column({ type: 'text', nullable: true })
  bear_case?: string | null

  @Column({ type: 'text', nullable: true })
  risk_summary?: string | null

  @Column({ type: 'text', nullable: true })
  liquidity_analysis?: string | null

  @Column({ type: 'text', nullable: true })
  issuer_analysis?: string | null

  @Column({ type: 'text', nullable: true })
  redemption_analysis?: string | null

  @Column({ type: 'text', nullable: true })
  contract_analysis?: string | null

  @Column({ type: 'jsonb', nullable: true })
  structured_signals?: Record<string, unknown> | null

  @Column({ type: 'timestamptz', nullable: true })
  input_data_timestamp?: Date | null

  @Column({ type: 'timestamptz', default: () => 'now()' })
  generated_at!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
