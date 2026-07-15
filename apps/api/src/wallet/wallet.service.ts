import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { In, Repository } from 'typeorm'
import { Device } from '../identity/device.entity'
import { IdentityCrypto } from '../identity/identity-crypto.service'
import { AuditLog } from '../security/audit-log.entity'
import { SecurityService, type SecurityActor } from '../security/security.service'
import type { CustodyAdapter } from './custody-adapter.interface'
import { CustodyWebhookVerifier } from './custody-webhook.verifier'
import type {
  AddWithdrawalAddressDto,
  CreateTransferDto,
  CreateWithdrawalDto,
  DepositCallbackDto,
  WithdrawalCallbackDto,
  WithdrawalQuoteDto,
} from './dto/wallet.dto'
import { WALLET_ERROR_CODES } from './wallet.errors'
import { WalletLedgerBridge } from './wallet-ledger.bridge'
import { LedgerService } from '../ledger/ledger.service'
import { WalletNetworkRegistry } from './wallet-network.registry'
import { FundsOperationalSwitchService } from './funds-operational-switch.service'
import {
  ChainTransaction,
  CustodyWallet,
  Deposit,
  InternalTransfer,
  LedgerAccount,
  LedgerAccountBalance,
  WalletAddress,
  Withdrawal,
  WithdrawalAddressBookEntry,
  WithdrawalApprovalDecision,
  type WalletNetwork,
  type WithdrawalState,
} from './wallet.entities'

@Injectable()
export class WalletService {
  private readonly executionRequested: boolean
  private readonly demoCreditEnabled: boolean
  private readonly demoOperationsEnabled: boolean
  private readonly financialMode: boolean
  private readonly addressCooldownSeconds: number
  private readonly newDeviceCooldownSeconds: number
  private readonly approvalsRequired: number
  private readonly executionLeaseSeconds: number
  private readonly perTransactionLimitAtomic: string | null
  private readonly dailyLimitAtomic: string | null

  constructor(
    @InjectRepository(CustodyWallet) private readonly wallets: Repository<CustodyWallet>,
    @InjectRepository(WalletAddress) private readonly addresses: Repository<WalletAddress>,
    @InjectRepository(ChainTransaction) private readonly chainTransactions: Repository<ChainTransaction>,
    @InjectRepository(Deposit) private readonly deposits: Repository<Deposit>,
    @InjectRepository(Withdrawal) private readonly withdrawals: Repository<Withdrawal>,
    @InjectRepository(InternalTransfer) private readonly transfers: Repository<InternalTransfer>,
    @InjectRepository(LedgerAccount) private readonly ledgerAccounts: Repository<LedgerAccount>,
    @InjectRepository(LedgerAccountBalance) private readonly balances: Repository<LedgerAccountBalance>,
    @InjectRepository(WithdrawalAddressBookEntry) private readonly withdrawalAddresses: Repository<WithdrawalAddressBookEntry>,
    @InjectRepository(WithdrawalApprovalDecision) private readonly withdrawalApprovals: Repository<WithdrawalApprovalDecision>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(AuditLog) private readonly auditLogs: Repository<AuditLog>,
    @Inject('CustodyAdapter') private readonly custody: CustodyAdapter,
    private readonly networkRegistry: WalletNetworkRegistry,
    private readonly webhookVerifier: CustodyWebhookVerifier,
    private readonly ledger: WalletLedgerBridge,
    private readonly ledgerService: LedgerService,
    private readonly crypto: IdentityCrypto,
    private readonly security: SecurityService,
    private readonly fundsSwitch: FundsOperationalSwitchService,
    config: ConfigService,
  ) {
    this.executionRequested = config.get<string>('WALLET_EXECUTION_ENABLED') === 'true'
    this.demoCreditEnabled = config.get<string>('APP_ENV') !== 'production'
      && config.get<string>('DEMO_WALLET_CREDIT_ENABLED') === 'true'
    this.demoOperationsEnabled = config.get<string>('APP_ENV') !== 'production'
      && config.get<string>('DEMO_OPERATIONS_ENABLED') === 'true'
    this.financialMode = config.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
    this.addressCooldownSeconds = readPositiveInteger(config.get<string>('WITHDRAWAL_ADDRESS_COOLDOWN_SECONDS'), 86_400)
    this.newDeviceCooldownSeconds = readPositiveInteger(config.get<string>('WITHDRAWAL_NEW_DEVICE_COOLDOWN_SECONDS'), 86_400)
    this.approvalsRequired = readPositiveInteger(config.get<string>('WITHDRAWAL_ADMIN_APPROVALS_REQUIRED'), 2)
    this.executionLeaseSeconds = readPositiveInteger(config.get<string>('WITHDRAWAL_EXECUTION_LEASE_SECONDS'), 120)
    this.perTransactionLimitAtomic = readOptionalAtomic(config.get<string>('WITHDRAWAL_PER_TRANSACTION_LIMIT_ATOMIC'))
    this.dailyLimitAtomic = readOptionalAtomic(config.get<string>('WITHDRAWAL_DAILY_LIMIT_ATOMIC'))
    if (this.financialMode && this.custody.mode !== 'live') {
      throw new Error('Financial production cannot start until a live CustodyAdapter implementation is installed')
    }
  }

  listNetworks() {
    return {
      networks: this.networkRegistry.list(),
      integration: this.integrationState(),
    }
  }

  async overview(userId: string) {
    const [wallet, accounts, deposits, withdrawals, transfers] = await Promise.all([
      this.wallets.findOne({ where: { userId, state: 'active' } }),
      this.ledgerAccounts.find({ where: { userId, assetCode: 'USDT', state: 'active' } }),
      this.deposits.find({ where: { userId }, order: { detectedAt: 'DESC' }, take: 10 }),
      this.withdrawals.find({ where: { userId }, order: { requestedAt: 'DESC' }, take: 10 }),
      this.transfers.find({ where: [{ senderUserId: userId }, { recipientUserId: userId }], order: { requestedAt: 'DESC' }, take: 10 }),
    ])
    const balanceRows = accounts.length
      ? await this.balances.find({ where: { accountId: In(accounts.map((account) => account.id)) } })
      : []
    const balanceByAccount = new Map(balanceRows.map((balance) => [balance.accountId, balance.currentAtomicBalance]))
    const balanceByPurpose = Object.fromEntries(
      accounts.map((account) => [account.purpose, balanceByAccount.get(account.id) ?? '0']),
    )
    return {
      asset: { code: 'USDT', decimals: 6 },
      balances: {
        availableAtomic: balanceByPurpose.available ?? '0',
        lockedAtomic: balanceByPurpose.locked ?? '0',
        pendingAtomic: balanceByPurpose.pending ?? '0',
        investedAtomic: balanceByPurpose.invested_cost ?? '0',
        rewardPayableAtomic: balanceByPurpose.reward_payable ?? '0',
        asOf: balanceRows.reduce<Date | null>((latest, row) => !latest || row.updatedAt > latest ? row.updatedAt : latest, null),
      },
      wallet: wallet ? { id: wallet.id, state: wallet.state, provider: wallet.provider } : null,
      recentActivity: [
        ...deposits.map((item) => ({ kind: 'deposit', id: item.id, state: item.state, atomicAmount: item.atomicAmount, at: item.detectedAt })),
        ...withdrawals.map((item) => ({ kind: 'withdrawal', id: item.id, state: item.state, atomicAmount: item.atomicAmount, at: item.requestedAt })),
        ...transfers.map((item) => ({ kind: 'transfer', id: item.id, state: item.state, atomicAmount: item.atomicAmount, at: item.requestedAt })),
      ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 15),
      integration: this.integrationState(),
    }
  }

  async listWithdrawalAddressBook(userId: string) {
    const entries = await this.withdrawalAddresses.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    })
    const now = new Date()
    const activatable = entries.filter((entry) => (
      entry.state === 'pending'
      && entry.riskState === 'clear'
      && entry.cooldownUntil <= now
    ))
    for (const entry of activatable) {
      entry.state = 'active'
      entry.activatedAt = now
    }
    if (activatable.length) await this.withdrawalAddresses.save(activatable)
    return {
      entries: entries.map((entry) => this.withdrawalAddressResponse(entry)),
      policy: {
        cooldownSeconds: this.addressCooldownSeconds,
        financialMode: this.financialMode,
      },
    }
  }

  async addWithdrawalAddress(actor: SecurityActor, dto: AddWithdrawalAddressDto, requestId: string) {
    if (!this.canDemoExecute()) this.security.assertRecentStepUp(actor, dto.reauthentication)
    if (this.financialMode) await this.assertEligibleDevice(actor)
    this.assertAddress(dto.network, dto.destination)
    const normalized = this.normalizeAddress(dto.network, dto.destination)
    const addressHash = this.crypto.hmac(normalized)
    const screening = await this.custody.screenAddress(dto.network, dto.destination)
    if (screening.decision === 'blocked') {
      throw new ForbiddenException({
        code: WALLET_ERROR_CODES.ADDRESS_REVIEW_REQUIRED,
        message: 'The destination address was blocked by the configured screening provider.',
      })
    }
    const now = new Date()
    const encrypted = this.crypto.encrypt(dto.destination)
    let entry = await this.withdrawalAddresses.findOne({
      where: { userId: actor.userId, network: dto.network, assetCode: 'USDT', addressHash },
    })
    if (entry && entry.state !== 'revoked') return this.withdrawalAddressResponse(entry)

    const values = {
      userId: actor.userId,
      network: dto.network,
      assetCode: 'USDT',
      label: dto.label.trim(),
      addressHash,
      addressCiphertext: encrypted.ciphertext,
      encryptionKeyVersion: encrypted.keyVersion,
      state: 'pending' as const,
      riskState: screening.decision,
      reasonCode: screening.reasonCode ?? null,
      cooldownUntil: new Date(now.getTime() + this.addressCooldownSeconds * 1_000),
      createdFromDeviceId: actor.deviceId,
      createdAt: now,
      activatedAt: null,
      revokedAt: null,
    }
    if (entry) {
      Object.assign(entry, values)
    } else {
      entry = this.withdrawalAddresses.create({ id: randomUUID(), ...values })
    }
    entry = await this.withdrawalAddresses.save(entry)
    await this.auditUser(actor.userId, requestId, 'wallet.withdrawal_address.added', 'withdrawal_address_book', entry.id, {
      network: entry.network,
      riskState: entry.riskState,
      cooldownUntil: entry.cooldownUntil,
      deviceId: actor.deviceId,
    })
    return this.withdrawalAddressResponse(entry)
  }

  async revokeWithdrawalAddress(actor: SecurityActor, addressBookId: string, reauthentication: string, requestId: string) {
    if (!this.canDemoExecute()) this.security.assertRecentStepUp(actor, reauthentication)
    const entry = await this.withdrawalAddresses.findOne({ where: { id: addressBookId, userId: actor.userId } })
    if (!entry) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.ADDRESS_NOT_FOUND, message: 'Withdrawal address was not found.' })
    }
    if (entry.state !== 'revoked') {
      entry.state = 'revoked'
      entry.revokedAt = new Date()
      entry.activatedAt = null
      await this.withdrawalAddresses.save(entry)
      await this.auditUser(actor.userId, requestId, 'wallet.withdrawal_address.revoked', 'withdrawal_address_book', entry.id, {
        network: entry.network,
      })
    }
    return { id: entry.id, state: entry.state, revokedAt: entry.revokedAt }
  }

  async depositAddress(userId: string, network: WalletNetwork) {
    const config = this.networkRegistry.get(network)
    const wallet = await this.ensureWallet(userId)
    let address = await this.addresses.findOne({ where: { walletId: wallet.id, userId, network, assetCode: 'USDT', state: 'active' } })
    if (!address) {
      // Stub references are deterministically derived from the user ID. Deriving
      // them again avoids relying on legacy demo seed ciphertext, which cannot be
      // encrypted with an environment-specific runtime key in a SQL migration.
      const providerWalletReference = this.custody.mode === 'stub'
        ? (await this.custody.provisionWallet(userId)).providerReference
        : this.crypto.decrypt(wallet.providerWalletCiphertext)
      const provisioned = await this.custody.provisionAddress(providerWalletReference, network, 'USDT')
      this.assertAddress(network, provisioned.address)
      const encryptedAddress = this.crypto.encrypt(provisioned.address)
      const encryptedMemo = provisioned.memo ? this.crypto.encrypt(provisioned.memo) : null
      address = await this.addresses.save(this.addresses.create({
        id: randomUUID(), walletId: wallet.id, userId, network, assetCode: 'USDT', assetDecimals: 6,
        addressHash: this.crypto.hmac(this.normalizeAddress(network, provisioned.address)), addressCiphertext: encryptedAddress.ciphertext,
        memoCiphertext: encryptedMemo?.ciphertext ?? null, encryptionKeyVersion: encryptedAddress.keyVersion,
        state: 'active', disabledAt: null,
      }))
    }
    return {
      id: address.id,
      network,
      assetCode: 'USDT',
      address: this.crypto.decrypt(address.addressCiphertext),
      memo: address.memoCiphertext ? this.crypto.decrypt(address.memoCiphertext) : null,
      requiredConfirmations: config.requiredConfirmations,
      minimumDepositAtomic: config.minimumDepositAtomic,
      estimatedArrivalMinutes: config.estimatedArrivalMinutes,
      warning: config.warning,
      integration: this.integrationState(),
    }
  }

  async quoteWithdrawal(userId: string, dto: WithdrawalQuoteDto) {
    const config = this.networkRegistry.get(dto.network)
    this.assertAtomicAmount(dto.atomicAmount)
    if (BigInt(dto.atomicAmount) < BigInt(config.minimumWithdrawalAtomic)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.AMOUNT_BELOW_MINIMUM, message: 'Withdrawal amount is below the configured network minimum.' })
    }
    const account = await this.ledgerAccounts.findOne({ where: { userId, purpose: 'available', assetCode: 'USDT', state: 'active' } })
    const balance = account ? await this.balances.findOne({ where: { accountId: account.id } }) : null
    const available = BigInt(balance?.currentAtomicBalance ?? '0')
    const total = BigInt(dto.atomicAmount) + BigInt(config.withdrawalFeeAtomic)
    return {
      network: dto.network,
      assetCode: 'USDT',
      assetDecimals: 6,
      atomicAmount: dto.atomicAmount,
      feeAtomicAmount: config.withdrawalFeeAtomic,
      totalDebitAtomic: total.toString(),
      availableAtomic: available.toString(),
      sufficientBalance: available >= total,
      requiresStepUp: true,
      requiresAddressScreening: true,
      expiresAt: new Date(Date.now() + 60_000),
      integration: this.integrationState(),
    }
  }

  async createWithdrawal(actor: SecurityActor, dto: CreateWithdrawalDto, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey)
    this.assertExecutionEnabled()
    if (!this.canDemoExecute()) this.security.assertRecentStepUp(actor, dto.reauthentication ?? '')
    if (this.financialMode) await this.assertEligibleDevice(actor)
    const addressBookEntry = dto.addressBookId
      ? await this.resolveWithdrawalAddress(actor.userId, dto.addressBookId, dto.network)
      : null
    if (this.financialMode && !addressBookEntry) {
      throw new BadRequestException({
        code: WALLET_ERROR_CODES.ADDRESS_BOOK_REQUIRED,
        message: 'Financial production requires an active, screened withdrawal address-book entry.',
      })
    }
    const destination = addressBookEntry
      ? this.crypto.decrypt(addressBookEntry.addressCiphertext)
      : dto.destination
    if (!destination) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: 'A withdrawal destination is required.' })
    }
    this.assertAddress(dto.network, destination)
    const quote = await this.quoteWithdrawal(actor.userId, dto)
    if (!quote.sufficientBalance) {
      throw new ConflictException({ code: WALLET_ERROR_CODES.INSUFFICIENT_BALANCE, message: 'Available USDT balance is insufficient.' })
    }
    const existing = await this.withdrawals.findOne({ where: { userId: actor.userId, idempotencyKey } })
    if (existing) return this.withdrawalResponse(existing, false)
    const wallet = await this.wallets.findOne({ where: { userId: actor.userId, state: 'active' } })
    if (!wallet) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'An active custody wallet is required.' })
    const screening = await this.custody.screenAddress(dto.network, destination)
    if (screening.decision === 'blocked') {
      throw new ForbiddenException({ code: WALLET_ERROR_CODES.CALLBACK_PAYLOAD_INVALID, message: 'The destination address did not pass risk screening.' })
    }
    const encrypted = this.crypto.encrypt(destination)
    const id = randomUUID()
    const state: Extract<WithdrawalState, 'risk_review' | 'approved'> = this.financialMode || screening.decision !== 'clear'
      ? 'risk_review'
      : 'approved'
    const policySnapshot = {
      version: 1,
      financialMode: this.financialMode,
      addressCooldownSeconds: this.addressCooldownSeconds,
      newDeviceCooldownSeconds: this.newDeviceCooldownSeconds,
      perTransactionLimitAtomic: this.perTransactionLimitAtomic,
      dailyLimitAtomic: this.dailyLimitAtomic,
      approvalsRequired: this.financialMode ? this.approvalsRequired : 0,
      screeningDecision: screening.decision,
    }
    const result = await this.ledger.createWithdrawalWithLock({
      id, userId: actor.userId, walletId: wallet.id, network: dto.network,
      atomicAmount: dto.atomicAmount, feeAtomicAmount: quote.feeAtomicAmount,
      destinationHash: this.crypto.hmac(this.normalizeAddress(dto.network, destination)), destinationCiphertext: encrypted.ciphertext,
      encryptionKeyVersion: encrypted.keyVersion, idempotencyKey, state,
      addressBookEntryId: addressBookEntry?.id ?? null,
      policySnapshot,
      perTransactionLimitAtomic: this.perTransactionLimitAtomic,
      dailyLimitAtomic: this.dailyLimitAtomic,
      reasonCode: screening.reasonCode ?? (this.financialMode ? 'awaiting_admin_approvals' : null), requestId,
    })
    const withdrawal = await this.withdrawals.findOne({ where: { id: result.id, userId: actor.userId } })
    if (!withdrawal) throw new ServiceUnavailableException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal state could not be read after creation.' })
    return this.withdrawalResponse(withdrawal, result.created)
  }

  async createTransfer(actor: SecurityActor, dto: CreateTransferDto, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey)
    this.assertExecutionEnabled()
    if (!this.canDemoExecute()) this.security.assertRecentStepUp(actor, dto.reauthentication ?? '')
    this.assertAtomicAmount(dto.atomicAmount)
    if (actor.userId === dto.recipientUserId) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.CALLBACK_PAYLOAD_INVALID, message: 'Sender and recipient must differ.' })
    }
    const result = await this.ledger.postInternalTransfer({
      id: randomUUID(), senderUserId: actor.userId, recipientUserId: dto.recipientUserId,
      atomicAmount: dto.atomicAmount, idempotencyKey, requestId,
    })
    const transfer = await this.transfers.findOne({ where: { id: result.id, senderUserId: actor.userId } })
    if (!transfer) throw new ServiceUnavailableException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Transfer state could not be read after posting.' })
    return { ...transfer, created: result.created, integration: this.integrationState() }
  }

  async listWithdrawalReviews(limit = 50) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const withdrawals = await this.withdrawals.find({
      where: { state: 'risk_review' },
      order: { requestedAt: 'ASC' },
      take: safeLimit,
    })
    return Promise.all(withdrawals.map(async (withdrawal) => ({
      id: withdrawal.id,
      userId: withdrawal.userId,
      network: withdrawal.network,
      assetCode: withdrawal.assetCode,
      atomicAmount: withdrawal.atomicAmount,
      feeAtomicAmount: withdrawal.feeAtomicAmount,
      state: withdrawal.state,
      reasonCode: withdrawal.reasonCode,
      requestedAt: withdrawal.requestedAt,
      approvals: await this.withdrawalApprovals.count({
        where: { withdrawalId: withdrawal.id, decision: 'approved' },
      }),
      approvalsRequired: this.financialMode ? this.approvalsRequired : 1,
      policySnapshot: withdrawal.policySnapshot,
    })))
  }

  async decideWithdrawal(
    withdrawalId: string,
    adminId: string,
    approve: boolean,
    reasonCode: string | undefined,
    requestId: string,
  ) {
    const withdrawal = await this.withdrawals.findOne({ where: { id: withdrawalId } })
    if (!withdrawal) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal was not found.' })
    }
    if (withdrawal.state !== 'risk_review') {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
        message: `Withdrawal cannot be reviewed from ${withdrawal.state}.`,
      })
    }
    const existingDecision = await this.withdrawalApprovals.findOne({ where: { withdrawalId, adminUserId: adminId } })
    if (existingDecision) {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.WITHDRAWAL_APPROVAL_CONFLICT,
        message: 'This administrator has already decided this withdrawal.',
      })
    }
    const required = this.financialMode ? this.approvalsRequired : 1
    if (approve) {
      return this.ledger.recordWithdrawalApproval({
        withdrawalId,
        adminId,
        approvalsRequired: required,
        enqueueExecution: this.financialMode,
        reasonCode: reasonCode?.trim() || null,
        requestId,
      })
    }
    const rejectionReason = reasonCode?.trim() || 'admin_withdrawal_rejected'
    const result = await this.ledger.recordWithdrawalRejection({
      withdrawalId,
      adminId,
      reasonCode: rejectionReason,
      requestId,
    })
    return { ...result, approvalsRequired: required }
  }

  async executeApprovedWithdrawal(withdrawalId: string, adminId: string, requestId: string) {
    if (this.financialMode) {
      const executorDecision = await this.withdrawalApprovals.findOne({ where: { withdrawalId, adminUserId: adminId } })
      if (executorDecision) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_EXECUTOR_CONFLICT,
          message: 'An administrator who reviewed this withdrawal cannot execute it.',
        })
      }
    }
    return this.executeWithdrawal(withdrawalId, { type: 'admin', id: adminId }, requestId)
  }

  async executeQueuedWithdrawal(withdrawalId: string, workerId: string, requestId: string) {
    return this.executeWithdrawal(withdrawalId, { type: 'service', id: workerId }, requestId)
  }

  async canProcessExecutionQueue() {
    return this.canExecute() && (!this.financialMode || await this.fundsSwitch.isWithdrawalExecutionEnabled())
  }

  private async executeWithdrawal(
    withdrawalId: string,
    actor: { type: 'admin' | 'service'; id: string },
    requestId: string,
  ) {
    this.assertExecutionEnabled()
    if (this.financialMode && !await this.fundsSwitch.isWithdrawalExecutionEnabled()) {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
        message: 'Withdrawal execution is paused by the operational funds switch.',
      })
    }
    const withdrawal = await this.withdrawals.findOne({ where: { id: withdrawalId } })
    if (!withdrawal) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal was not found.' })
    }
    if (withdrawal.state === 'broadcast' || withdrawal.state === 'confirming' || withdrawal.state === 'completed') {
      return this.withdrawalResponse(withdrawal, false)
    }
    if (this.financialMode) {
      const approvalCount = await this.withdrawalApprovals.count({
        where: { withdrawalId, decision: 'approved' },
      })
      if (approvalCount < this.approvalsRequired) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_APPROVALS_INCOMPLETE,
          message: 'The required distinct administrator approvals have not been recorded.',
        })
      }
    }
    const claimed = await this.ledger.claimWithdrawalExecution(withdrawalId, this.executionLeaseSeconds)
    if (!claimed) {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
        message: 'Withdrawal is not approved, or another execution lease is active.',
      })
    }
    try {
      const result = await this.custody.broadcastWithdrawal({
        withdrawalId: claimed.id,
        network: claimed.network,
        assetCode: claimed.assetCode,
        atomicAmount: claimed.atomicAmount,
        destination: this.crypto.decrypt(claimed.destinationCiphertext),
      })
      const persisted = await this.ledger.recordWithdrawalBroadcast({
        withdrawalId: claimed.id,
        network: claimed.network,
        transactionHash: result.transactionHash,
        providerReferenceHash: this.crypto.hmac(result.providerReference).toString('hex'),
        requestId,
      })
      await this.auditExecutionActor(actor, requestId, 'wallet.withdrawal.execution_requested', withdrawalId, {
        chainTransactionId: persisted.chainTransactionId,
        executionAttemptCount: claimed.executionAttemptCount,
      })
      const updated = await this.withdrawals.findOneOrFail({ where: { id: withdrawalId } })
      return this.withdrawalResponse(updated, false)
    } catch (error) {
      await this.ledger.releaseWithdrawalExecutionLease(withdrawalId, 'broadcast_retry_required')
      throw error
    }
  }

  async processWithdrawalCallback(
    eventId: string,
    timestamp: string,
    signature: string,
    dto: WithdrawalCallbackDto,
  ) {
    this.webhookVerifier.verify(eventId, timestamp, signature, dto)
    const withdrawal = await this.withdrawals.findOne({ where: { id: dto.withdrawalId, network: dto.network } })
    if (!withdrawal) {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal was not found.' })
    }
    if (withdrawal.state === 'completed') {
      return { accepted: true, duplicate: true, withdrawal: this.withdrawalResponse(withdrawal, false) }
    }
    if (dto.state === 'failed') {
      if (!['broadcast', 'confirming', 'signing'].includes(withdrawal.state)) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
          message: `A failed callback is invalid from ${withdrawal.state}.`,
        })
      }
      await this.ledgerService.refundWithdrawal(
        withdrawal.id,
        dto.reasonCode ?? 'custody_withdrawal_failed',
        eventId,
      )
      const failed = await this.withdrawals.findOneOrFail({ where: { id: withdrawal.id } })
      return { accepted: true, duplicate: false, withdrawal: this.withdrawalResponse(failed, false) }
    }

    let chain = await this.chainTransactions.findOne({
      where: { network: dto.network, transactionHash: dto.transactionHash },
    })
    if (withdrawal.chainTransactionId && chain && withdrawal.chainTransactionId !== chain.id) {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.CALLBACK_PAYLOAD_INVALID,
        message: 'Callback transaction does not match the withdrawal broadcast record.',
      })
    }
    const network = this.networkRegistry.get(dto.network)
    const confirmed = dto.state === 'confirmed' || dto.confirmations >= network.requiredConfirmations
    if (!chain) {
      chain = this.chainTransactions.create({
        id: randomUUID(),
        network: dto.network,
        transactionHash: dto.transactionHash,
        state: confirmed ? 'confirmed' : 'confirming',
        blockNumber: dto.blockNumber ?? null,
        confirmationCount: dto.confirmations,
        confirmedAt: confirmed ? new Date() : null,
        rawReference: { eventId, direction: 'withdrawal', withdrawalId: withdrawal.id },
      })
    } else {
      chain.confirmationCount = Math.max(chain.confirmationCount, dto.confirmations)
      chain.blockNumber ??= dto.blockNumber ?? null
      chain.state = confirmed ? 'confirmed' : 'confirming'
      if (confirmed) chain.confirmedAt ??= new Date()
      chain.rawReference = { ...chain.rawReference, latestEventId: eventId }
    }
    chain = await this.chainTransactions.save(chain)
    withdrawal.chainTransactionId = chain.id
    withdrawal.state = confirmed ? 'confirming' : dto.state === 'broadcast' ? 'broadcast' : 'confirming'
    withdrawal.reasonCode = null
    await this.withdrawals.save(withdrawal)
    if (confirmed) await this.ledgerService.settleWithdrawal(withdrawal.id, chain.id, eventId)
    const updated = await this.withdrawals.findOneOrFail({ where: { id: withdrawal.id } })
    return { accepted: true, duplicate: false, withdrawal: this.withdrawalResponse(updated, false) }
  }

  async completeDemoWithdrawal(withdrawalId: string, requestId: string) {
    this.assertDemoOperations()
    const withdrawal = await this.withdrawals.findOne({ where: { id: withdrawalId } })
    if (!withdrawal) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal was not found.' })
    if (withdrawal.state === 'completed') return this.withdrawalResponse(withdrawal, false)
    if (!['approved', 'risk_review', '2fa_verified', 'requested'].includes(withdrawal.state)) {
      throw new ConflictException({ code: WALLET_ERROR_CODES.EXECUTION_DISABLED, message: `Withdrawal cannot be completed from ${withdrawal.state}.` })
    }
    const network = this.networkRegistry.get(withdrawal.network)
    const chain = await this.chainTransactions.save(this.chainTransactions.create({
      id: randomUUID(), network: withdrawal.network,
      transactionHash: `demo-withdrawal-${withdrawal.id}-${randomUUID()}`,
      state: 'confirmed', blockNumber: null, confirmationCount: network.requiredConfirmations,
      firstSeenAt: new Date(), confirmedAt: new Date(), rawReference: { mode: 'demo', withdrawalId },
    }))
    withdrawal.state = 'confirming'
    withdrawal.chainTransactionId = chain.id
    await this.withdrawals.save(withdrawal)
    await this.ledgerService.settleWithdrawal(withdrawal.id, chain.id, requestId)
    const completed = await this.withdrawals.findOneOrFail({ where: { id: withdrawal.id } })
    return this.withdrawalResponse(completed, true)
  }

  async rejectDemoWithdrawal(withdrawalId: string, reasonCode: string, requestId: string) {
    this.assertDemoOperations()
    const withdrawal = await this.withdrawals.findOne({ where: { id: withdrawalId } })
    if (!withdrawal) throw new NotFoundException({ code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE, message: 'Withdrawal was not found.' })
    if (withdrawal.state === 'completed') {
      throw new ConflictException({ code: WALLET_ERROR_CODES.EXECUTION_DISABLED, message: 'Completed withdrawals cannot be rejected.' })
    }
    await this.ledgerService.refundWithdrawal(withdrawalId, reasonCode, requestId)
    await this.withdrawals.update({ id: withdrawalId }, { state: 'rejected', reasonCode, completedAt: null })
    const rejected = await this.withdrawals.findOneOrFail({ where: { id: withdrawalId } })
    return this.withdrawalResponse(rejected, true)
  }

  async processDepositCallback(
    eventId: string,
    timestamp: string,
    signature: string,
    dto: DepositCallbackDto,
  ) {
    this.webhookVerifier.verify(eventId, timestamp, signature, dto)
    const network = this.networkRegistry.get(dto.network)
    this.assertAtomicAmount(dto.atomicAmount)
    this.assertAddress(dto.network, dto.destinationAddress)
    const address = await this.addresses.findOne({
      where: { network: dto.network, addressHash: this.crypto.hmac(this.normalizeAddress(dto.network, dto.destinationAddress)), assetCode: 'USDT', state: 'active' },
    })
    if (!address) throw new NotFoundException({ code: WALLET_ERROR_CODES.ADDRESS_NOT_FOUND, message: 'Callback destination is not a recognized active deposit address.' })
    let chain = await this.chainTransactions.findOne({ where: { network: dto.network, transactionHash: dto.transactionHash } })
    const confirmed = dto.confirmations >= network.requiredConfirmations
    if (!chain) {
      chain = this.chainTransactions.create({
        id: randomUUID(), network: dto.network, transactionHash: dto.transactionHash,
        state: confirmed ? 'confirmed' : 'confirming', blockNumber: dto.blockNumber ?? null,
        confirmationCount: dto.confirmations, confirmedAt: confirmed ? new Date() : null,
        rawReference: { eventId },
      })
    } else {
      chain.confirmationCount = Math.max(chain.confirmationCount, dto.confirmations)
      chain.blockNumber = chain.blockNumber ?? dto.blockNumber ?? null
      if (confirmed) {
        chain.state = 'confirmed'
        chain.confirmedAt ??= new Date()
      }
    }
    chain = await this.chainTransactions.save(chain)
    const outputIndex = dto.outputIndex ?? 0
    let deposit = await this.deposits.findOne({ where: { chainTransactionId: chain.id, outputIndex, assetCode: 'USDT' } })
    if (!deposit) {
      deposit = await this.deposits.save(this.deposits.create({
        id: randomUUID(), userId: address.userId, walletAddressId: address.id, chainTransactionId: chain.id,
        outputIndex, assetCode: 'USDT', assetDecimals: 6, atomicAmount: dto.atomicAmount,
        requiredConfirmations: network.requiredConfirmations, state: 'detected', reasonCode: null, creditedAt: null,
      }))
    }
    if (deposit.state !== 'credited' && deposit.state !== 'rejected') {
      if (BigInt(dto.atomicAmount) < BigInt(network.minimumDepositAtomic)) {
        deposit.state = 'manual_review'
        deposit.reasonCode = 'below_minimum_deposit'
      } else if (dto.riskDecision !== 'clear') {
        deposit.state = 'manual_review'
        deposit.reasonCode = dto.riskDecision === 'blocked' ? 'address_risk_blocked' : 'address_risk_review'
      } else if (confirmed && !this.canCreditDeposit()) {
        deposit.state = 'manual_review'
        deposit.reasonCode = 'deposit_crediting_disabled'
      } else {
        deposit.state = dto.confirmations > 0 ? 'confirming' : 'detected'
        deposit.reasonCode = null
      }
      deposit = await this.deposits.save(deposit)
    }
    if (confirmed && dto.riskDecision === 'clear' && deposit.state === 'confirming' && this.canCreditDeposit()) {
      await this.ledger.creditDeposit(deposit.id, deposit.userId, dto.network, deposit.atomicAmount, eventId)
      deposit = await this.deposits.findOneOrFail({ where: { id: deposit.id } })
    }
    return {
      accepted: true,
      eventId,
      deposit: { id: deposit.id, state: deposit.state, reasonCode: deposit.reasonCode, requiredConfirmations: deposit.requiredConfirmations },
      retryPolicy: { providerShouldRetryOnHttp5xx: true, duplicateEventsAreIdempotent: true },
      integration: this.integrationState(),
    }
  }

  private async ensureWallet(userId: string) {
    const existing = await this.wallets.findOne({ where: { userId, state: 'active' } })
    if (existing) return existing
    const provisioned = await this.custody.provisionWallet(userId)
    const encrypted = this.crypto.encrypt(provisioned.providerReference)
    return this.wallets.save(this.wallets.create({
      id: randomUUID(), userId, provider: this.custody.name,
      providerWalletHash: this.crypto.hmac(provisioned.providerReference),
      providerWalletCiphertext: encrypted.ciphertext, encryptionKeyVersion: encrypted.keyVersion,
      state: 'active', activatedAt: new Date(), closedAt: null,
    }))
  }

  private async resolveWithdrawalAddress(userId: string, id: string, network: WalletNetwork) {
    const entry = await this.withdrawalAddresses.findOne({ where: { id, userId, network, assetCode: 'USDT' } })
    if (!entry || entry.state === 'revoked') {
      throw new NotFoundException({ code: WALLET_ERROR_CODES.ADDRESS_NOT_FOUND, message: 'Withdrawal address was not found.' })
    }
    if (entry.riskState !== 'clear') {
      throw new ConflictException({
        code: WALLET_ERROR_CODES.ADDRESS_REVIEW_REQUIRED,
        message: 'Withdrawal address has not received a clear screening decision.',
      })
    }
    if (entry.state === 'pending') {
      if (entry.cooldownUntil > new Date()) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.ADDRESS_COOLDOWN_ACTIVE,
          message: 'Withdrawal address cooldown has not completed.',
        })
      }
      entry.state = 'active'
      entry.activatedAt = new Date()
      await this.withdrawalAddresses.save(entry)
    }
    return entry
  }

  private async assertEligibleDevice(actor: SecurityActor) {
    if (!actor.deviceId) {
      throw new ForbiddenException({
        code: WALLET_ERROR_CODES.DEVICE_NOT_ELIGIBLE,
        message: 'A recognized trusted device is required for financial withdrawals.',
      })
    }
    const device = await this.devices.findOne({ where: { id: actor.deviceId, userId: actor.userId } })
    const eligibleBefore = Date.now() - this.newDeviceCooldownSeconds * 1_000
    if (!device || device.trustState !== 'trusted' || device.firstSeenAt.getTime() > eligibleBefore) {
      throw new ForbiddenException({
        code: WALLET_ERROR_CODES.DEVICE_NOT_ELIGIBLE,
        message: 'The current device must be trusted and older than the configured withdrawal cooldown.',
      })
    }
  }

  private assertAtomicAmount(value: string) {
    if (!/^[1-9]\d{0,77}$/.test(value)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.AMOUNT_INVALID, message: 'Amount must be a positive integer in the asset smallest unit.' })
    }
  }

  private assertIdempotencyKey(value: string) {
    if (!value || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED, message: 'Idempotency-Key must contain 8 to 128 characters.' })
    }
  }

  private assertAddress(network: WalletNetwork, value: string) {
    const valid = network === 'tron'
      ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)
      : /^0x[a-fA-F0-9]{40}$/.test(value)
    if (!valid) {
      throw new BadRequestException({ code: WALLET_ERROR_CODES.ADDRESS_INVALID, message: `Address is not valid for ${network}.` })
    }
  }

  private normalizeAddress(network: WalletNetwork, value: string) {
    return network === 'tron' ? value : value.toLowerCase()
  }

  private canExecute() {
    return this.executionRequested && this.custody.mode === 'live'
  }

  private canCreditDeposit() {
    return this.canExecute() || (this.custody.mode === 'stub' && this.demoCreditEnabled)
  }

  private canDemoExecute() {
    return this.custody.mode === 'stub' && this.demoOperationsEnabled
  }

  private assertExecutionEnabled() {
    if (!this.canExecute() && !this.canDemoExecute()) {
      throw new ServiceUnavailableException({
        code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
        message: 'Wallet execution is disabled until either local Demo operations or a live custody partner is explicitly enabled.',
      })
    }
  }

  private assertDemoOperations() {
    if (!this.canDemoExecute()) {
      throw new ForbiddenException({
        code: WALLET_ERROR_CODES.EXECUTION_DISABLED,
        message: 'Demo wallet administration is disabled outside an explicitly enabled local Demo environment.',
      })
    }
  }

  private integrationState() {
    return {
      custodyProvider: this.custody.name,
      adapterMode: this.custody.mode,
      executionEnabled: this.canExecute(),
      demoCreditEnabled: this.custody.mode === 'stub' && this.demoCreditEnabled,
      demoExecutionEnabled: this.canDemoExecute(),
      realFunds: this.canExecute(),
      financialMode: this.financialMode,
      withdrawalControls: {
        addressBookRequired: this.financialMode,
        addressCooldownSeconds: this.addressCooldownSeconds,
        newDeviceCooldownSeconds: this.newDeviceCooldownSeconds,
        approvalsRequired: this.financialMode ? this.approvalsRequired : 0,
        perTransactionLimitAtomic: this.perTransactionLimitAtomic,
        dailyLimitAtomic: this.dailyLimitAtomic,
      },
    }
  }

  private withdrawalResponse(withdrawal: Withdrawal, created: boolean) {
    return {
      id: withdrawal.id, state: withdrawal.state, network: withdrawal.network,
      atomicAmount: withdrawal.atomicAmount, feeAtomicAmount: withdrawal.feeAtomicAmount,
      reasonCode: withdrawal.reasonCode, created, integration: this.integrationState(),
    }
  }

  private withdrawalAddressResponse(entry: WithdrawalAddressBookEntry) {
    return {
      id: entry.id,
      network: entry.network,
      assetCode: entry.assetCode,
      label: entry.label,
      destination: this.crypto.decrypt(entry.addressCiphertext),
      state: entry.state,
      riskState: entry.riskState,
      reasonCode: entry.reasonCode,
      cooldownUntil: entry.cooldownUntil,
      createdAt: entry.createdAt,
      activatedAt: entry.activatedAt,
      revokedAt: entry.revokedAt,
    }
  }

  private async auditUser(
    userId: string,
    requestId: string,
    action: string,
    objectType: string,
    objectId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.insert({
      id: randomUUID(),
      actorType: 'user',
      actorId: userId,
      userId,
      action,
      objectType,
      objectId,
      requestId,
      reasonCode: null,
      metadata: metadata as never,
    })
  }

  private async auditExecutionActor(
    actor: { type: 'admin' | 'service'; id: string },
    requestId: string,
    action: string,
    withdrawalId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.insert({
      id: randomUUID(),
      actorType: actor.type,
      actorId: actor.type === 'admin' ? actor.id : null,
      userId: null,
      action,
      objectType: 'withdrawal',
      objectId: withdrawalId,
      requestId,
      reasonCode: null,
      metadata: { ...metadata, workerId: actor.type === 'service' ? actor.id : undefined } as never,
    })
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readOptionalAtomic(value: string | undefined): string | null {
  return value && /^[1-9]\d{0,77}$/.test(value) ? value : null
}
