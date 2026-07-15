import { Column, Entity, PrimaryColumn } from 'typeorm'

export type TotpFactorState = 'pending' | 'active' | 'revoked'

@Entity({ schema: 'app', name: 'totp_factors' })
export class TotpFactor {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar' })
  state!: TotpFactorState

  @Column({ type: 'varchar' })
  label!: string

  @Column({ name: 'secret_ciphertext', type: 'bytea' })
  secretCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ name: 'recovery_code_hashes', type: 'jsonb' })
  recoveryCodeHashes!: string[]

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null
}
