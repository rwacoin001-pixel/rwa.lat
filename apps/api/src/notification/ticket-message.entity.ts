import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ schema: 'app', name: 'ticket_messages' })
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  ticket_id!: string

  @Column({ type: 'varchar' })
  actor_type!: 'user' | 'admin' | 'service'

  @Column({ type: 'uuid', nullable: true })
  actor_user_id?: string

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'jsonb', default: () => `'{}'` })
  attachments!: Record<string, unknown>

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
