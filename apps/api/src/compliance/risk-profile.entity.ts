import { Column, Entity, PrimaryColumn } from 'typeorm'

export type RiskBand = 'conservative' | 'balanced' | 'growth' | 'aggressive'

@Entity({ schema: 'app', name: 'risk_profiles' })
export class RiskProfile {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'answers_json', type: 'jsonb' })
  answersJson!: Record<string, number>

  @Column({ type: 'integer' })
  score!: number

  @Column({ type: 'varchar' })
  band!: RiskBand

  @Column({ name: 'questionnaire_version', type: 'varchar' })
  questionnaireVersion!: string

  @Column({ name: 'completed_at', type: 'timestamptz', default: () => 'now()' })
  completedAt!: Date

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date
}
