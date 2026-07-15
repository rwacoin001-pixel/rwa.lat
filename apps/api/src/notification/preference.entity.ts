import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity({ schema: 'app', name: 'preferences' })
export class Preference {
  @PrimaryColumn({ type: 'uuid' })
  user_id!: string

  @Column({ type: 'varchar', length: 5, nullable: true })
  locale?: string

  @Column({ type: 'jsonb', default: () => "'{\"in_app\":true,\"email\":false,\"sms\":false,\"push\":false}'" })
  channels!: Record<string, boolean>

  @Column({ type: 'boolean', default: false })
  communication_consent!: boolean

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date
}
