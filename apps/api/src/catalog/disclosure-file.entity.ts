import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

export type DisclosureKind = 'prospectus' | 'risk_disclosure' | 'terms' | 'regulatory'
export type DisclosureState = 'active' | 'superseded' | 'removed'

@Entity({ schema: 'app', name: 'disclosure_files' })
@Check(`"state" = 'superseded' = ("superseded_at" IS NOT NULL)`)
export class DisclosureFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  product_id!: string

  @Column({ type: 'varchar' })
  kind!: DisclosureKind

  @Column({ type: 'varchar', length: 5 })
  locale!: string

  @Column({ type: 'varchar' })
  title!: string

  @Column({ type: 'varchar' })
  storage_ref!: string

  @Column({ type: 'bytea' })
  content_hash!: Buffer

  @Column({ type: 'varchar', default: 'active' })
  state!: DisclosureState

  @CreateDateColumn({ type: 'timestamptz' })
  published_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  superseded_at?: Date
}
