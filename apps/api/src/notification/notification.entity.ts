import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity({ schema: 'app', name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index()
  @Column({ type: 'uuid' })
  recipient_user_id!: string

  @Column({ type: 'varchar' })
  channel!: 'in_app' | 'email' | 'sms' | 'push'

  @Column({ type: 'varchar' })
  kind!: string

  @Column({ type: 'varchar' })
  title!: string

  @Column({ type: 'text', nullable: true })
  body?: string

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>

  @Column({ type: 'varchar', length: 5, nullable: true })
  locale?: string

  @Column({ type: 'timestamptz', nullable: true })
  read_at?: Date

  @Column({ type: 'timestamptz', nullable: true })
  sent_at?: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date

  @Column({ type: 'timestamptz', nullable: true })
  expires_at?: Date
}
