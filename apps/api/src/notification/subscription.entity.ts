import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'subscriptions' })
@Check(`"current_period_end" > "current_period_start"`)
@Check(`"state" = 'canceled' = ("canceled_at" IS NOT NULL)`)
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'varchar' })
  plan!: string

  @Column({ type: 'integer', default: 1 })
  version!: number

  @Column({ type: 'varchar', default: 'active' })
  state!: 'active' | 'canceled' | 'expired' | 'past_due'

  @Column({ type: 'timestamptz' })
  current_period_start!: Date

  @Column({ type: 'timestamptz' })
  current_period_end!: Date

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
