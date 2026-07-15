import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'position_snapshots' })
@Check(`"quantity_atomic_amount" >= 0`)
@Check(`"unit_price_atomic_amount" >= 0`)
export class PositionSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'uuid' })
  product_id!: string

  @Column({ type: 'varchar' })
  asset_code!: string

  @Column({ type: 'smallint' })
  asset_decimals!: number

  @Column('numeric', { precision: 78, scale: 0 })
  quantity_atomic_amount!: string

  @Column('numeric', { precision: 78, scale: 0 })
  unit_price_atomic_amount!: string

  @Column({ type: 'uuid', nullable: true })
  price_snapshot_id?: string

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string

  @Column({ type: 'timestamptz' })
  valued_at!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  captured_at!: Date
}

@Entity({ schema: 'app', name: 'redemptions' })
@Check(`"quantity_atomic_amount" > 0`)
@Check(`"estimated_unit_price_atomic_amount" >= 0`)
@Check(`("state" = 'executing') = ("executed_at" IS NOT NULL)`)
@Check(`("state" = 'completed') = ("executed_at" IS NOT NULL)`)
@Check(`("state" = 'canceled') = ("canceled_at" IS NOT NULL)`)
@Check(`("state" = 'failed') = ("failed_at" IS NOT NULL)`)
@Check(`"state" <> 'failed' OR "reason_code" IS NOT NULL`)
export class Redemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'uuid' })
  product_id!: string

  @Column({ type: 'varchar' })
  asset_code!: string

  @Column({ type: 'smallint' })
  asset_decimals!: number

  @Column('numeric', { precision: 78, scale: 0 })
  quantity_atomic_amount!: string

  @Column('numeric', { precision: 78, scale: 0 })
  estimated_unit_price_atomic_amount!: string

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string

  @Column({ type: 'text', nullable: true })
  destination_address?: string

  @Column({ type: 'varchar', default: 'requested' })
  state!: 'requested' | 'queued' | 'executing' | 'completed' | 'failed' | 'canceled'

  @Column({ type: 'uuid', nullable: true })
  order_id?: string

  @Column({ type: 'timestamptz' })
  requested_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  executed_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  failed_at?: Date

  @Column({ type: 'text', nullable: true })
  reason_code?: string

  @Column({ type: 'text' })
  request_id!: string
}
