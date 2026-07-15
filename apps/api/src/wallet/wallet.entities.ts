import { Column, Entity, PrimaryColumn } from 'typeorm'

export type WalletNetwork = 'tron' | 'ethereum' | 'arbitrum'
export type DepositState = 'detected' | 'confirming' | 'credited' | 'rejected' | 'manual_review'
export type WithdrawalState =
  | 'requested'
  | '2fa_verified'
  | 'risk_review'
  | 'approved'
  | 'signing'
  | 'broadcast'
  | 'confirming'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled'

export type WithdrawalAddressBookState = 'pending' | 'active' | 'revoked'
export type WithdrawalAddressRiskState = 'clear' | 'manual_review' | 'blocked'

@Entity({ schema: 'app', name: 'custody_wallets' })
export class CustodyWallet {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'text' })
  provider!: string

  @Column({ name: 'provider_wallet_hash', type: 'bytea' })
  providerWalletHash!: Buffer

  @Column({ name: 'provider_wallet_ciphertext', type: 'bytea' })
  providerWalletCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ type: 'text' })
  state!: 'provisioning' | 'active' | 'restricted' | 'closed'

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null
}

@Entity({ schema: 'app', name: 'wallet_addresses' })
export class WalletAddress {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

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

  @Column({ name: 'memo_ciphertext', type: 'bytea', nullable: true })
  memoCiphertext!: Buffer | null

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ type: 'text' })
  state!: 'active' | 'disabled' | 'quarantined'

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null
}

@Entity({ schema: 'app', name: 'chain_transactions' })
export class ChainTransaction {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ type: 'text' })
  network!: WalletNetwork

  @Column({ name: 'transaction_hash', type: 'text' })
  transactionHash!: string

  @Column({ type: 'text' })
  state!: 'detected' | 'confirming' | 'confirmed' | 'failed' | 'reorged'

  @Column({ name: 'block_number', type: 'numeric', nullable: true })
  blockNumber!: string | null

  @Column({ name: 'confirmation_count', type: 'integer' })
  confirmationCount!: number

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt!: Date

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null

  @Column({ name: 'raw_reference', type: 'jsonb' })
  rawReference!: Record<string, unknown>
}

@Entity({ schema: 'app', name: 'deposits' })
export class Deposit {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'wallet_address_id', type: 'uuid' })
  walletAddressId!: string

  @Column({ name: 'chain_transaction_id', type: 'uuid' })
  chainTransactionId!: string

  @Column({ name: 'output_index', type: 'integer' })
  outputIndex!: number

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ name: 'asset_decimals', type: 'smallint' })
  assetDecimals!: number

  @Column({ name: 'atomic_amount', type: 'numeric' })
  atomicAmount!: string

  @Column({ name: 'required_confirmations', type: 'integer' })
  requiredConfirmations!: number

  @Column({ type: 'text' })
  state!: DepositState

  @Column({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date

  @Column({ name: 'credited_at', type: 'timestamptz', nullable: true })
  creditedAt!: Date | null
}

@Entity({ schema: 'app', name: 'withdrawals' })
export class Withdrawal {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string

  @Column({ type: 'text' })
  network!: WalletNetwork

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ name: 'asset_decimals', type: 'smallint' })
  assetDecimals!: number

  @Column({ name: 'atomic_amount', type: 'numeric' })
  atomicAmount!: string

  @Column({ name: 'fee_atomic_amount', type: 'numeric' })
  feeAtomicAmount!: string

  @Column({ name: 'destination_hash', type: 'bytea' })
  destinationHash!: Buffer

  @Column({ name: 'destination_ciphertext', type: 'bytea' })
  destinationCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ name: 'address_book_entry_id', type: 'uuid', nullable: true })
  addressBookEntryId!: string | null

  @Column({ name: 'policy_snapshot', type: 'jsonb', default: () => "'{}'" })
  policySnapshot!: Record<string, unknown>

  @Column({ type: 'text' })
  state!: WithdrawalState

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Column({ name: 'chain_transaction_id', type: 'uuid', nullable: true })
  chainTransactionId!: string | null

  @Column({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null

  @Column({ name: 'execution_lease_until', type: 'timestamptz', nullable: true })
  executionLeaseUntil!: Date | null

  @Column({ name: 'execution_attempt_count', type: 'integer', default: 0 })
  executionAttemptCount!: number

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null
}

@Entity({ schema: 'app', name: 'withdrawal_address_book' })
export class WithdrawalAddressBookEntry {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'text' })
  network!: WalletNetwork

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ type: 'varchar' })
  label!: string

  @Column({ name: 'address_hash', type: 'bytea' })
  addressHash!: Buffer

  @Column({ name: 'address_ciphertext', type: 'bytea' })
  addressCiphertext!: Buffer

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number

  @Column({ type: 'text' })
  state!: WithdrawalAddressBookState

  @Column({ name: 'risk_state', type: 'text' })
  riskState!: WithdrawalAddressRiskState

  @Column({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'cooldown_until', type: 'timestamptz' })
  cooldownUntil!: Date

  @Column({ name: 'created_from_device_id', type: 'uuid', nullable: true })
  createdFromDeviceId!: string | null

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null
}

@Entity({ schema: 'app', name: 'withdrawal_approval_decisions' })
export class WithdrawalApprovalDecision {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'withdrawal_id', type: 'uuid' })
  withdrawalId!: string

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId!: string

  @Column({ type: 'text' })
  decision!: 'approved' | 'rejected'

  @Column({ name: 'reason_code', type: 'varchar', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}

@Entity({ schema: 'app', name: 'internal_transfers' })
export class InternalTransfer {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'sender_user_id', type: 'uuid' })
  senderUserId!: string

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId!: string

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ name: 'asset_decimals', type: 'smallint' })
  assetDecimals!: number

  @Column({ name: 'atomic_amount', type: 'numeric' })
  atomicAmount!: string

  @Column({ type: 'text' })
  state!: 'requested' | 'risk_review' | 'posted' | 'rejected' | 'reversed'

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Column({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode!: string | null

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt!: Date | null
}

@Entity({ schema: 'app', name: 'ledger_accounts' })
export class LedgerAccount {
  @PrimaryColumn({ type: 'uuid' })
  id!: string

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null

  @Column({ type: 'text' })
  purpose!: 'available' | 'locked' | 'pending' | 'settlement' | 'fee_revenue' | 'reward_payable' | 'invested_cost' | 'custody_difference'

  @Column({ name: 'asset_code', type: 'text' })
  assetCode!: string

  @Column({ name: 'asset_decimals', type: 'smallint' })
  assetDecimals!: number

  @Column({ type: 'text' })
  state!: 'active' | 'frozen' | 'closed'
}

@Entity({ schema: 'app', name: 'ledger_account_balances' })
export class LedgerAccountBalance {
  @PrimaryColumn({ name: 'account_id', type: 'uuid' })
  accountId!: string

  @Column({ name: 'current_atomic_balance', type: 'numeric' })
  currentAtomicBalance!: string

  @Column({ name: 'last_entry_id', type: 'uuid', nullable: true })
  lastEntryId!: string | null

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
