import { ConflictException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import type { WalletNetwork, WithdrawalState } from './wallet.entities'
import { WALLET_ERROR_CODES } from './wallet.errors'

interface CreateWithdrawalInput {
  id: string
  userId: string
  walletId: string
  network: WalletNetwork
  atomicAmount: string
  feeAtomicAmount: string
  destinationHash: Buffer
  destinationCiphertext: Buffer
  encryptionKeyVersion: number
  addressBookEntryId: string | null
  policySnapshot: Record<string, unknown>
  perTransactionLimitAtomic: string | null
  dailyLimitAtomic: string | null
  idempotencyKey: string
  state: Extract<WithdrawalState, '2fa_verified' | 'risk_review' | 'approved'>
  reasonCode: string | null
  requestId: string
}

interface CreateTransferInput {
  id: string
  senderUserId: string
  recipientUserId: string
  atomicAmount: string
  idempotencyKey: string
  requestId: string
}

@Injectable()
export class WalletLedgerBridge {
  constructor(private readonly dataSource: DataSource) {}

  async creditDeposit(depositId: string, userId: string, network: WalletNetwork, atomicAmount: string, requestId: string) {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const available = await this.ensureUserAccount(runner, userId, 'available')
      const settlement = await this.ensureSystemAccount(runner, `custody:${network}`, 'settlement', network)
      const transactionId = await this.createLedgerTransaction(
        runner,
        'deposit',
        `deposit:${depositId}`,
        requestId,
        'deposit',
        depositId,
        'partner',
      )
      if (transactionId) {
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, settlement, available, atomicAmount],
        )
      }
      await runner.query(
        `UPDATE app.deposits SET state = 'credited', credited_at = COALESCE(credited_at, now()), reason_code = NULL
         WHERE id = $1 AND state IN ('detected', 'confirming')`,
        [depositId],
      )
      await runner.commitTransaction()
      return { credited: true, duplicate: transactionId === null }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async createWithdrawalWithLock(input: CreateWithdrawalInput): Promise<{ id: string; created: boolean }> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`withdrawal-policy:${input.userId}`])
      const [existing] = await runner.query(
        `SELECT id FROM app.withdrawals WHERE user_id = $1 AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey],
      )
      if (existing) {
        await runner.commitTransaction()
        return { id: existing.id as string, created: false }
      }

      const amount = BigInt(input.atomicAmount)
      if (input.perTransactionLimitAtomic && amount > BigInt(input.perTransactionLimitAtomic)) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.PER_TRANSACTION_LIMIT_EXCEEDED,
          message: 'Withdrawal exceeds the configured per-transaction limit.',
        })
      }
      if (input.dailyLimitAtomic) {
        const [usage] = await runner.query(
          `SELECT COALESCE(SUM(atomic_amount), 0)::text AS total
           FROM app.withdrawals
           WHERE user_id = $1
             AND requested_at >= now() - interval '24 hours'
             AND state NOT IN ('rejected', 'failed', 'cancelled')`,
          [input.userId],
        )
        if (BigInt(usage?.total ?? '0') + amount > BigInt(input.dailyLimitAtomic)) {
          throw new ConflictException({
            code: WALLET_ERROR_CODES.DAILY_LIMIT_EXCEEDED,
            message: 'Withdrawal exceeds the configured rolling 24-hour limit.',
          })
        }
      }

      const inserted = await runner.query(
        `INSERT INTO app.withdrawals
          (id, user_id, wallet_id, network, asset_code, asset_decimals, atomic_amount,
           fee_atomic_amount, destination_hash, destination_ciphertext, encryption_key_version,
           address_book_entry_id, policy_snapshot, state, idempotency_key, reason_code)
         VALUES ($1, $2, $3, $4, 'USDT', 6, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [
          input.id, input.userId, input.walletId, input.network, input.atomicAmount, input.feeAtomicAmount,
          input.destinationHash, input.destinationCiphertext, input.encryptionKeyVersion,
          input.addressBookEntryId, JSON.stringify(input.policySnapshot), input.state, input.idempotencyKey, input.reasonCode,
        ],
      )
      if (!inserted.length) {
        const [existing] = await runner.query(
          `SELECT id FROM app.withdrawals WHERE user_id = $1 AND idempotency_key = $2`,
          [input.userId, input.idempotencyKey],
        )
        await runner.commitTransaction()
        return { id: existing.id as string, created: false }
      }

      const available = await this.ensureUserAccount(runner, input.userId, 'available')
      const locked = await this.ensureUserAccount(runner, input.userId, 'locked')
      const transactionId = await this.createLedgerTransaction(
        runner,
        'withdrawal_lock',
        `withdrawal-lock:${input.id}`,
        input.requestId,
        'withdrawal',
        input.id,
        'user',
        input.userId,
      )
      const total = (BigInt(input.atomicAmount) + BigInt(input.feeAtomicAmount)).toString()
      if (!transactionId) throw new Error('new withdrawal lock unexpectedly collided')
      await runner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
        [transactionId, available, locked, total],
      )
      await this.audit(runner, input.userId, input.requestId, 'wallet.withdrawal.requested', 'withdrawal', input.id, {
        network: input.network,
        state: input.state,
      })
      await runner.commitTransaction()
      return { id: input.id, created: true }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async claimWithdrawalExecution(withdrawalId: string, leaseSeconds: number) {
    const rows = await this.dataSource.query(
      `UPDATE app.withdrawals
       SET state = 'signing',
           execution_lease_until = now() + make_interval(secs => $2),
           execution_attempt_count = execution_attempt_count + 1,
           reason_code = NULL
       WHERE id = $1
         AND (
           state = 'approved'
           OR (state = 'signing' AND (execution_lease_until IS NULL OR execution_lease_until <= now()))
         )
       RETURNING id, user_id AS "userId", network, asset_code AS "assetCode",
                 atomic_amount::text AS "atomicAmount", destination_ciphertext AS "destinationCiphertext",
                 encryption_key_version AS "encryptionKeyVersion", execution_attempt_count AS "executionAttemptCount"`,
      [withdrawalId, leaseSeconds],
    )
    return rows[0] as {
      id: string
      userId: string
      network: WalletNetwork
      assetCode: string
      atomicAmount: string
      destinationCiphertext: Buffer
      encryptionKeyVersion: number
      executionAttemptCount: number
    } | undefined
  }

  async recordWithdrawalBroadcast(input: {
    withdrawalId: string
    network: WalletNetwork
    transactionHash: string
    providerReferenceHash: string
    requestId: string
  }) {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const chainId = randomUUID()
      const rows = await runner.query(
        `INSERT INTO app.chain_transactions
          (id, network, transaction_hash, state, confirmation_count, raw_reference)
         VALUES ($1, $2, $3, 'detected', 0, $4)
         ON CONFLICT (network, transaction_hash)
         DO UPDATE SET raw_reference = app.chain_transactions.raw_reference || EXCLUDED.raw_reference
         RETURNING id`,
        [chainId, input.network, input.transactionHash, JSON.stringify({
          direction: 'withdrawal',
          withdrawalId: input.withdrawalId,
          providerReferenceHash: input.providerReferenceHash,
        })],
      )
      const persistedChainId = rows[0].id as string
      const updated = await runner.query(
        `UPDATE app.withdrawals
         SET state = 'broadcast', chain_transaction_id = $2,
             execution_lease_until = NULL, reason_code = NULL
         WHERE id = $1 AND state = 'signing'
         RETURNING user_id`,
        [input.withdrawalId, persistedChainId],
      )
      if (!updated.length) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
          message: 'Withdrawal is no longer in a broadcastable state.',
        })
      }
      await this.audit(
        runner,
        updated[0].user_id as string,
        input.requestId,
        'wallet.withdrawal.broadcast',
        'withdrawal',
        input.withdrawalId,
        { chainTransactionId: persistedChainId, transactionHash: input.transactionHash },
      )
      await runner.commitTransaction()
      return { chainTransactionId: persistedChainId }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async releaseWithdrawalExecutionLease(withdrawalId: string, reasonCode: string) {
    await this.dataSource.query(
      `UPDATE app.withdrawals
       SET execution_lease_until = now(), reason_code = $2
       WHERE id = $1 AND state = 'signing'`,
      [withdrawalId, reasonCode],
    )
  }

  async recordWithdrawalApproval(input: {
    withdrawalId: string
    adminId: string
    approvalsRequired: number
    enqueueExecution: boolean
    reasonCode: string | null
    requestId: string
  }) {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const [withdrawal] = await runner.query(
        `SELECT id, user_id, state FROM app.withdrawals WHERE id = $1 FOR UPDATE`,
        [input.withdrawalId],
      )
      if (!withdrawal) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE,
          message: 'Withdrawal was not found.',
        })
      }
      if (withdrawal.state !== 'risk_review') {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
          message: `Withdrawal cannot be reviewed from ${withdrawal.state}.`,
        })
      }
      const decisionId = randomUUID()
      const inserted = await runner.query(
        `INSERT INTO app.withdrawal_approval_decisions
          (id, withdrawal_id, admin_user_id, decision, reason_code)
         VALUES ($1, $2, $3, 'approved', $4)
         ON CONFLICT (withdrawal_id, admin_user_id) DO NOTHING
         RETURNING id`,
        [decisionId, input.withdrawalId, input.adminId, input.reasonCode],
      )
      if (!inserted.length) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_APPROVAL_CONFLICT,
          message: 'This administrator has already decided this withdrawal.',
        })
      }
      const [countRow] = await runner.query(
        `SELECT COUNT(*)::integer AS count
         FROM app.withdrawal_approval_decisions
         WHERE withdrawal_id = $1 AND decision = 'approved'`,
        [input.withdrawalId],
      )
      const approvalCount = Number(countRow.count)
      const approved = approvalCount >= input.approvalsRequired
      if (approved) {
        await runner.query(
          `UPDATE app.withdrawals
           SET state = 'approved', approved_at = now(), reason_code = NULL
           WHERE id = $1 AND state = 'risk_review'`,
          [input.withdrawalId],
        )
        if (input.enqueueExecution) {
          await runner.query(
            `INSERT INTO app.job_queue
              (queue_name, payload, dedup_key, max_attempts)
             VALUES ('wallet-withdrawal-execution', $1::jsonb, $2, 10)
             ON CONFLICT (dedup_key) DO NOTHING`,
            [
              JSON.stringify({ withdrawalId: input.withdrawalId }),
              `withdrawal-execution:${input.withdrawalId}`,
            ],
          )
        }
      }
      await runner.query(
        `INSERT INTO app.audit_logs
          (id, actor_type, actor_id, user_id, action, object_type, object_id, request_id, metadata)
         VALUES ($1, 'admin', $2, $3, 'wallet.withdrawal.approval_recorded',
                 'withdrawal', $4, $5, $6)`,
        [
          randomUUID(),
          input.adminId,
          withdrawal.user_id,
          input.withdrawalId,
          input.requestId,
          JSON.stringify({ decisionId, approvalCount, approvalsRequired: input.approvalsRequired }),
        ],
      )
      await runner.commitTransaction()
      return {
        id: input.withdrawalId,
        state: approved ? 'approved' : 'risk_review',
        approvalCount,
        approvalsRequired: input.approvalsRequired,
      }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async recordWithdrawalRejection(input: {
    withdrawalId: string
    adminId: string
    reasonCode: string
    requestId: string
  }) {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const [withdrawal] = await runner.query(
        `SELECT * FROM app.withdrawals WHERE id = $1 FOR UPDATE`,
        [input.withdrawalId],
      )
      if (!withdrawal) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WALLET_UNAVAILABLE,
          message: 'Withdrawal was not found.',
        })
      }
      if (withdrawal.state !== 'risk_review') {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_STATE_INVALID,
          message: `Withdrawal cannot be rejected from ${withdrawal.state}.`,
        })
      }
      const decisionId = randomUUID()
      const inserted = await runner.query(
        `INSERT INTO app.withdrawal_approval_decisions
          (id, withdrawal_id, admin_user_id, decision, reason_code)
         VALUES ($1, $2, $3, 'rejected', $4)
         ON CONFLICT (withdrawal_id, admin_user_id) DO NOTHING
         RETURNING id`,
        [decisionId, input.withdrawalId, input.adminId, input.reasonCode],
      )
      if (!inserted.length) {
        throw new ConflictException({
          code: WALLET_ERROR_CODES.WITHDRAWAL_APPROVAL_CONFLICT,
          message: 'This administrator has already decided this withdrawal.',
        })
      }
      const locked = await this.ensureUserAccount(runner, withdrawal.user_id as string, 'locked')
      const available = await this.ensureUserAccount(runner, withdrawal.user_id as string, 'available')
      const transactionId = await this.createLedgerTransaction(
        runner,
        'withdrawal_refund',
        `withdrawal-refund:${input.withdrawalId}`,
        input.requestId,
        'withdrawal',
        input.withdrawalId,
        'admin',
        input.adminId,
      )
      if (transactionId) {
        const total = (BigInt(withdrawal.atomic_amount as string) + BigInt(withdrawal.fee_atomic_amount as string)).toString()
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, locked, available, total],
        )
      }
      await runner.query(
        `UPDATE app.withdrawals
         SET state = 'rejected', reason_code = $2, execution_lease_until = NULL
         WHERE id = $1`,
        [input.withdrawalId, input.reasonCode],
      )
      await runner.query(
        `INSERT INTO app.audit_logs
          (id, actor_type, actor_id, user_id, action, object_type, object_id, request_id, reason_code, metadata)
         VALUES ($1, 'admin', $2, $3, 'wallet.withdrawal.rejected',
                 'withdrawal', $4, $5, $6, $7)`,
        [
          randomUUID(),
          input.adminId,
          withdrawal.user_id,
          input.withdrawalId,
          input.requestId,
          input.reasonCode,
          JSON.stringify({ decisionId, ledgerTransactionId: transactionId }),
        ],
      )
      await runner.commitTransaction()
      return { id: input.withdrawalId, state: 'rejected', refunded: true, duplicate: transactionId === null }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  async postInternalTransfer(input: CreateTransferInput): Promise<{ id: string; created: boolean }> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const inserted = await runner.query(
        `INSERT INTO app.internal_transfers
          (id, sender_user_id, recipient_user_id, asset_code, asset_decimals, atomic_amount,
           state, idempotency_key, posted_at)
         VALUES ($1, $2, $3, 'USDT', 6, $4, 'posted', $5, now())
         ON CONFLICT (sender_user_id, idempotency_key) DO NOTHING RETURNING id`,
        [input.id, input.senderUserId, input.recipientUserId, input.atomicAmount, input.idempotencyKey],
      )
      if (!inserted.length) {
        const [existing] = await runner.query(
          `SELECT id FROM app.internal_transfers WHERE sender_user_id = $1 AND idempotency_key = $2`,
          [input.senderUserId, input.idempotencyKey],
        )
        await runner.commitTransaction()
        return { id: existing.id as string, created: false }
      }
      const sender = await this.ensureUserAccount(runner, input.senderUserId, 'available')
      const recipient = await this.ensureUserAccount(runner, input.recipientUserId, 'available')
      const transactionId = await this.createLedgerTransaction(
        runner,
        'internal_transfer',
        `internal-transfer:${input.id}`,
        input.requestId,
        'internal_transfer',
        input.id,
        'user',
        input.senderUserId,
      )
      if (!transactionId) throw new Error('new internal transfer unexpectedly collided')
      await runner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
        [transactionId, sender, recipient, input.atomicAmount],
      )
      await this.audit(runner, input.senderUserId, input.requestId, 'wallet.transfer.posted', 'internal_transfer', input.id, {
        recipientUserId: input.recipientUserId,
      })
      await runner.commitTransaction()
      return { id: input.id, created: true }
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }

  private async ensureUserAccount(runner: QueryRunner, userId: string, purpose: 'available' | 'locked') {
    await runner.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, $2, 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
      [userId, purpose],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'user' AND user_id = $1 AND purpose = $2 AND asset_code = 'USDT' AND network IS NULL`,
      [userId, purpose],
    )
    return account.id as string
  }

  private async ensureSystemAccount(runner: QueryRunner, ownerReference: string, purpose: 'settlement', network: WalletNetwork) {
    await runner.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side)
       VALUES ('custody_provider', $1, $2, 'USDT', 6, $3, 'debit') ON CONFLICT DO NOTHING`,
      [ownerReference, purpose, network],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'custody_provider' AND owner_reference = $1 AND purpose = $2
         AND asset_code = 'USDT' AND network = $3`,
      [ownerReference, purpose, network],
    )
    return account.id as string
  }

  private async createLedgerTransaction(
    runner: QueryRunner,
    transactionType: string,
    idempotencyKey: string,
    requestId: string,
    referenceType: string,
    referenceId: string,
    actorType: 'user' | 'partner' | 'admin',
    actorId: string | null = null,
  ): Promise<string | null> {
    const rows = await runner.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id,
         actor_type, actor_id, effective_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [transactionType, idempotencyKey, requestId, referenceType, referenceId, actorType, actorId],
    )
    return rows[0]?.id as string | undefined ?? null
  }

  private async audit(
    runner: QueryRunner,
    userId: string,
    requestId: string,
    action: string,
    objectType: string,
    objectId: string,
    metadata: Record<string, unknown>,
  ) {
    await runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, actor_id, user_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'user', $2, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), userId, action, objectType, objectId, requestId, JSON.stringify(metadata)],
    )
  }
}
