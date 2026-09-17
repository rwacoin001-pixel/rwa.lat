import { Column, Entity, PrimaryColumn } from 'typeorm'
import type { WalletNetwork } from '../wallet.entities'

export type DepositPoolAddressState = 'available' | 'assigned' | 'disabled'
export type DepositPoolAddressSource = 'generated' | 'imported'
export type WithdrawalWhitelistState = 'active' | 'revoked'

@Entity({ schema: 'app', name: 'deposit_pool_addresses' })
export class DepositPoolAddress {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'text' })
  network!: WalletNetwork

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ name: 'asset_decimals', type: 'smallint' })
  assetDecimals!: number

  @Column({ name: 'address_hash', type: 'bytea' })
  addressHash!: Buffer

  @Column({ name: 'address_ciphertext', type: 'bytea' })
  addressCiphertext!: Buffer

  @Column({ name: 'private_key_ciphertext', type: 'bytea', nullable: true })
  privateKeyCiphertext!: Buffer | null

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ name: 'key_held', type: 'boolean' })
  keyHeld!: boolean

  @Column({ type: 'text' })
  state!: DepositPoolAddressState

  @Column({ type: 'text' })
  source!: DepositPoolAddressSource

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId!: string | null

  @Column({ name: 'assigned_at', type: 'timestamptz', nullable: true })
  assignedAt!: Date | null

  @Column({ type: 'varchar', nullable: true })
  label!: string | null

  @Column({ type: 'text', nullable: true })
  note!: string | null

  @Column({ name: 'last_scan_at', type: 'timestamptz', nullable: true })
  lastScanAt!: Date | null

  @Column({ name: 'last_seen_timestamp', type: 'bigint', nullable: true })
  lastSeenTimestamp!: string | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null

  @Column({ name: 'disabled_reason', type: 'varchar', nullable: true })
  disabledReason!: string | null
}

@Entity({ schema: 'app', name: 'withdrawal_whitelist_entries' })
export class WithdrawalWhitelistEntry {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'text' })
  network!: WalletNetwork

  @Column({ type: 'text' })
  state!: WithdrawalWhitelistState

  @Column({ type: 'varchar', nullable: true })
  note!: string | null

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy!: string | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null

  @Column({ name: 'revoke_reason', type: 'varchar', nullable: true })
  revokeReason!: string | null
}
