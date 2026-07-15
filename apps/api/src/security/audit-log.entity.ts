import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ schema: 'app', name: 'audit_logs' })
export class AuditLog {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date

  @Column({ name: 'actor_type', type: 'varchar' })
  actorType!: 'user' | 'admin' | 'service' | 'partner'

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null

  @Column({ type: 'varchar' })
  action!: string

  @Column({ name: 'object_type', type: 'varchar' })
  objectType!: string

  @Column({ name: 'object_id', type: 'varchar', nullable: true })
  objectId!: string | null

  @Column({ name: 'request_id', type: 'varchar' })
  requestId!: string

  @Column({ name: 'reason_code', type: 'varchar', nullable: true })
  reasonCode!: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>
}
