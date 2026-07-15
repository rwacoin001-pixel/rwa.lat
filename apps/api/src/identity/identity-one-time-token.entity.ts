import { Column, Entity, PrimaryColumn } from 'typeorm'

export type IdentityOneTimeTokenPurpose = 'email_verification' | 'account_recovery'

@Entity({ schema: 'app', name: 'identity_one_time_tokens' })
export class IdentityOneTimeToken {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar' })
  purpose!: IdentityOneTimeTokenPurpose

  @Column({ name: 'token_hash', type: 'bytea' })
  tokenHash!: Buffer

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date
}
