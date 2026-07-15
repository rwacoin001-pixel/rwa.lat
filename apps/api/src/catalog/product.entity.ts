import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

export type ProductState = 'draft' | 'published' | 'suspended' | 'retired'

@Entity({ schema: 'app', name: 'products' })
@Check(`"state" = 'published' = ("published_at" IS NOT NULL)`)
@Check(`"state" = 'retired' = ("retired_at" IS NOT NULL)`)
@Check(`("min_order_atomic_amount" IS NULL OR "max_order_atomic_amount" IS NULL OR "min_order_atomic_amount" <= "max_order_atomic_amount")`)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'varchar', length: 32 })
  asset_class_id!: string

  @Column({ type: 'integer', default: 1 })
  version!: number

  @Column({ type: 'varchar', nullable: true })
  external_ref?: string

  @Column({ type: 'varchar' })
  display_name!: string

  @Column({ type: 'text', nullable: true })
  summary?: string

  @Column({ type: 'varchar', length: 16 })
  asset_code!: string

  @Column({ type: 'smallint' })
  asset_decimals!: number

  @Column({ type: 'varchar', nullable: true })
  network?: string

  @Column({
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  min_order_atomic_amount?: string

  @Column({
    type: 'numeric',
    precision: 78,
    scale: 0,
    nullable: true,
  })
  max_order_atomic_amount?: string

  @Column({ type: 'varchar', default: 'draft' })
  state!: ProductState

  @Column({ type: 'timestamptz', nullable: true })
  published_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  retired_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
