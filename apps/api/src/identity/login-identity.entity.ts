import { Column, Entity, PrimaryColumn } from 'typeorm'

export type LoginIdentityKind = 'email' | 'google' | 'github' | 'x' | 'external_wallet'
export type LoginIdentityState = 'pending' | 'verified' | 'revoked'

@Entity({ schema: 'app', name: 'login_identities' })
export class LoginIdentity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar' })
  kind!: LoginIdentityKind

  @Column({ type: 'varchar', default: 'pending' })
  state!: LoginIdentityState

  @Column({ name: 'identifier_hash', type: 'bytea' })
  identifierHash!: Buffer

  @Column({ name: 'identifier_ciphertext', type: 'bytea' })
  identifierCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'int' })
  encryptionKeyVersion!: number

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null
}
