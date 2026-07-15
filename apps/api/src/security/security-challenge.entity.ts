import { Column, Entity, PrimaryColumn } from 'typeorm'

export type SecurityChallengeKind = 'passkey_registration' | 'passkey_assertion'

@Entity({ schema: 'app', name: 'security_challenges' })
export class SecurityChallenge {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId!: string | null

  @Column({ type: 'varchar' })
  kind!: SecurityChallengeKind

  @Column({ name: 'challenge_hash', type: 'bytea' })
  challengeHash!: Buffer

  @Column({ name: 'challenge_ciphertext', type: 'bytea' })
  challengeCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null
}
