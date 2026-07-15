import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ schema: 'app', name: 'ticket_events' })
export class TicketEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  ticket_id!: string

  @Column({ type: 'varchar' })
  event_type!: 'created' | 'message_added' | 'status_changed' | 'assigned'

  @Column({ type: 'varchar' })
  actor_type!: 'user' | 'admin' | 'service'

  @Column({ type: 'uuid', nullable: true })
  actor_user_id?: string

  @Column({ type: 'varchar', nullable: true })
  previous_status?: string

  @Column({ type: 'varchar', nullable: true })
  next_status?: string

  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date
}
