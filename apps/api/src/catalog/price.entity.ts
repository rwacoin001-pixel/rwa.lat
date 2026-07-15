import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'price_quotes' })
@Check(`"valid_until" > "captured_at"`)
export class PriceQuote {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  product_id!: string

  @Column({ type: 'varchar', length: 16 })
  asset_code!: string

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  unit_price_atomic_amount!: string

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string

  @Column({ type: 'varchar' })
  source!: string

  @Column({ type: 'timestamptz' })
  valid_until!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  captured_at!: Date
}

@Entity({ schema: 'app', name: 'price_snapshots' })
export class PriceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  product_id!: string

  @Column({ type: 'uuid' })
  quote_id!: string

  @Column({ type: 'numeric', precision: 78, scale: 0 })
  unit_price_atomic_amount!: string

  @Column({ type: 'varchar', length: 3 })
  currency!: string

  @CreateDateColumn({ type: 'timestamptz' })
  captured_at!: Date
}
