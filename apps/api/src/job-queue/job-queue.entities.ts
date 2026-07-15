import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

export type JobState = 'pending' | 'running' | 'completed' | 'dead'

@Entity({ name: 'job_queue', schema: 'app' })
export class JobQueueEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'queue_name', type: 'varchar' })
  queueName!: string

  @Column({ name: 'payload', type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>

  @Column({ name: 'state', type: 'varchar', default: 'pending' })
  state!: JobState

  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts!: number

  @Column({ name: 'max_attempts', type: 'integer', default: 5 })
  maxAttempts!: number

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null

  @Column({ name: 'dedup_key', type: 'text', nullable: true })
  dedupKey?: string | null

  @Column({ name: 'run_at', type: 'timestamptz', default: () => 'now()' })
  runAt!: Date

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null

  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt?: Date | null

  @Column({ name: 'worker_id', type: 'varchar', length: 128, nullable: true })
  workerId?: string | null
}

@Entity({ name: 'inbound_callback_events', schema: 'app' })
export class InboundCallbackEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'partner', type: 'varchar' })
  partner!: string

  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: string

  @Column({ name: 'external_id', type: 'varchar' })
  externalId!: string

  @Column({ name: 'payload', type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>

  @Column({ name: 'signature_ok', type: 'boolean', default: false })
  signatureOk!: boolean

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt!: Date

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null
}
