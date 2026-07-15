import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm'

export type BackupDrillKind = 'full' | 'incremental' | 'point_in_time'
export type BackupDrillStatus = 'running' | 'succeeded' | 'failed'
export type DeletionSubjectType = 'user' | 'admin' | 'partner' | 'audit'
export type DeletionState = 'requested' | 'approved' | 'purged' | 'rejected'

@Entity({ name: 'backup_drills', schema: 'app' })
export class BackupDrill {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'kind', type: 'varchar', default: 'full' })
  kind!: BackupDrillKind

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date | null

  @Column({ name: 'status', type: 'varchar', default: 'running' })
  status!: BackupDrillStatus

  @Column({ name: 'target', type: 'varchar', default: 'rwa_lat' })
  target!: string

  @Column({ name: 'notes', type: 'text', default: '' })
  notes!: string

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy?: string | null
}

@Entity({ name: 'data_deletion_requests', schema: 'app' })
export class DataDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'subject_type', type: 'varchar' })
  subjectType!: DeletionSubjectType

  @Column({ name: 'subject_id', type: 'text' })
  subjectId!: string

  @Column({ name: 'reason_code', type: 'varchar', default: 'user_request' })
  reasonCode!: string

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string

  @Column({ name: 'state', type: 'varchar', default: 'requested' })
  state!: DeletionState

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string | null

  @Column({ name: 'retain_until', type: 'timestamptz' })
  retainUntil!: Date

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'now()' })
  requestedAt!: Date

  @Column({ name: 'purged_at', type: 'timestamptz', nullable: true })
  purgedAt?: Date | null

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date | null
}
