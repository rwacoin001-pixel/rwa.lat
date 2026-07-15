import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ schema: 'app', name: 'admin_roles' })
export class AdminRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', unique: true })
  name!: string

  @Column({ type: 'varchar', default: '' })
  description!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null
}

@Entity({ schema: 'app', name: 'admin_role_permissions' })
export class AdminRolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId!: string

  @PrimaryColumn({ type: 'varchar' })
  permission!: string
}

@Entity({ schema: 'app', name: 'admin_users' })
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', unique: true })
  email!: string

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null

  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false })
  passwordHash!: string | null

  @Column({ name: 'failed_login_count', type: 'integer', default: 0 })
  failedLoginCount!: number

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null

  @Column({ name: 'password_updated_at', type: 'timestamptz', nullable: true })
  passwordUpdatedAt!: Date | null

  @Column({ name: 'mfa_state', type: 'varchar', default: 'disabled' })
  mfaState!: 'disabled' | 'pending' | 'enabled'

  @Column({ name: 'mfa_secret_ciphertext', type: 'text', nullable: true, select: false })
  mfaSecretCiphertext!: string | null
}

@Entity({ schema: 'app', name: 'admin_sessions' })
export class AdminSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId!: string

  @Column({ name: 'token_hash', type: 'bytea', select: false })
  tokenHash!: Buffer

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt!: Date

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null
}

export type ApprovalState = 'requested' | 'approved' | 'rejected'

@Entity({ schema: 'app', name: 'admin_approval_requests' })
export class AdminApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar' })
  action!: string

  @Column({ name: 'object_type', type: 'varchar' })
  objectType!: string

  @Column({ name: 'object_id', type: 'varchar', nullable: true })
  objectId!: string | null

  @Column({ name: 'payload_json', type: 'jsonb', default: () => "'{}'" })
  payloadJson!: Record<string, unknown>

  @Column({ type: 'varchar', default: 'requested' })
  state!: ApprovalState

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null

  @Column({ name: 'reason_code', type: 'varchar', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
