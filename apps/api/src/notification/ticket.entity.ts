import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Check,
} from 'typeorm'

@Entity({ schema: 'app', name: 'tickets' })
@Check(`"status" = 'closed' = ("closed_at" IS NOT NULL)`)
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  author_user_id!: string

  @Column({ type: 'varchar' })
  subject!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'varchar', default: 'open' })
  status!: 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'

  @Column({ type: 'varchar', default: 'support' })
  category!: 'support' | 'dispute' | 'appeal' | 'scam_report'

  @Column({ type: 'uuid', nullable: true })
  order_id?: string

  @Column({ type: 'varchar', default: 'normal' })
  priority!: 'low' | 'normal' | 'high' | 'urgent'

  @Column({ type: 'varchar', nullable: true })
  assignee?: string

  @Column({ type: 'timestamptz', nullable: true })
  closed_at?: Date

  @Column({ type: 'timestamptz' })
  updated_at!: Date

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
