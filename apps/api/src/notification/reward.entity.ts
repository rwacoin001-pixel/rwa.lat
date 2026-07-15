import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'rewards' })
@Check(`"state" = 'redeemed' = ("redeemed_at" IS NOT NULL)`)
@Check(`"state" = 'expired' = ("expired_at" IS NOT NULL)`)
@Check(`"state" = 'revoked' = ("revoked_at" IS NOT NULL)`)
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'varchar' })
  kind!: 'referral' | 'loyalty' | 'promo' | 'cashback'

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  amount_atomic!: string

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string

  @Column({ type: 'varchar', default: 'earned' })
  state!: 'earned' | 'redeemed' | 'expired' | 'revoked'

  @Column({ type: 'varchar', nullable: true })
  ref_type?: string

  @Column({ type: 'uuid', nullable: true })
  ref_id?: string

  @Column({ type: 'timestamptz', default: () => 'now()' })
  earned_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  redeemed_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  expired_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
