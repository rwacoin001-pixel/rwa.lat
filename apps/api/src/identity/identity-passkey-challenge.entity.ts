import { Column, Entity, PrimaryColumn } from 'typeorm'

export type IdentityPasskeyChallengeKind = 'passkey_login'

@Entity({ schema: 'app', name: 'identity_passkey_challenges' })
export class IdentityPasskeyChallenge {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'varchar', default: 'passkey_login' })
  kind!: IdentityPasskeyChallengeKind

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
