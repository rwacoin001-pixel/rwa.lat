import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'fees' })
@Check(`"status" = 'refunded' = ("reversed_at" IS NOT NULL)`)
export class Fee {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'varchar' })
  kind!: 'subscription' | 'transaction' | 'management' | 'penalty'

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  amount_atomic!: string

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string

  @Column({ type: 'varchar', default: 'accrued' })
  status!: 'accrued' | 'invoiced' | 'paid' | 'waived' | 'refunded'

  @Column({ type: 'varchar', nullable: true })
  ref_type?: string

  @Column({ type: 'uuid', nullable: true })
  ref_id?: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  effective_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  reversed_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
