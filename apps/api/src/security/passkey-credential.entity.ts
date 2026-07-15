import { Column, Entity, PrimaryColumn } from 'typeorm'

export type PasskeyState = 'active' | 'revoked'

@Entity({ schema: 'app', name: 'passkey_credentials' })
export class PasskeyCredential {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'credential_id', type: 'varchar' })
  credentialId!: string

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey!: Buffer

  @Column({ type: 'bigint', transformer: { to: (value: number) => value, from: (value: string) => Number(value) } })
  counter!: number

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  transports!: string[]

  @Column({ type: 'varchar' })
  label!: string

  @Column({ type: 'varchar' })
  state!: PasskeyState

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null
}
