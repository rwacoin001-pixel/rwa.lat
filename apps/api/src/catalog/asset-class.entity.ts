import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Check,
} from 'typeorm'

export type AssetClassState = 'active' | 'deprecated'

@Entity({ schema: 'app', name: 'asset_classes' })
@Check(`"state" = 'deprecated' = ("deprecated_at" IS NOT NULL)`)
export class AssetClass {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id!: string

  @Column({ type: 'varchar' })
  display_name!: string

  @Column({ type: 'text', nullable: true })
  description?: string

  @Column({ type: 'varchar', default: 'active' })
  state!: AssetClassState

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  deprecated_at?: Date
}
