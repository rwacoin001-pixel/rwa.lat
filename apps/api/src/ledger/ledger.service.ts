import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import type { WalletNetwork } from '../wallet/wallet.entities'
import { LEDGER_ERROR_CODES } from './ledger.errors'

interface ReconcileCustodyInput {
  provider: string
  network: WalletNetwork
  observedAtomicBalance: string
  periodStart: Date
  periodEnd: Date
  sourceReference: string
  requestId: string
  adminId?: string
  partnerEventId?: string
}

interface CreateLedgerAdjustmentInput {
  ledgerAccountId: string
  side: 'debit' | 'credit'
  atomicAmount: string
  reasonCode: string
  evidence: Record<string, unknown>
  adminId: string
  requestId: string
}

@Injectable()
export class LedgerService {
  constructor(private readonly dataSource: DataSource) {}

  async listUserBalances(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT a.id AS "accountId", a.purpose, a.asset_code AS "assetCode",
              a.asset_decimals AS "assetDecimals", a.state,
              COALESCE(b.current_atomic_balance, 0)::text AS "atomicBalance",
              b.last_entry_id AS "lastEntryId", b.updated_at AS "updatedAt"
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.user_id = $1
       ORDER BY a.asset_code, a.purpose`,
      [userId],
    )
    return { accounts: rows, source: 'immutable-ledger-projection' }
  }

  async listUserTransactions(userId: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const rows = await this.dataSource.query(
      `SELECT t.id, t.transaction_type AS "transactionType", t.reference_type AS "referenceType",
              t.reference_id AS "referenceId", t.effective_at AS "effectiveAt", t.created_at AS "createdAt",
              jsonb_agg(jsonb_build_object(
                'entryId', e.id,
                'accountId', a.id,
                'purpose', a.purpose,
                'side', e.side,
                'atomicAmount', e.atomic_amount::text,
                'assetCode', a.asset_code,
                'assetDecimals', a.asset_decimals
              ) ORDER BY e.created_at, e.id) AS entries
       FROM app.ledger_transactions t
       JOIN app.ledger_entries e ON e.transaction_id = t.id
       JOIN app.ledger_accounts a ON a.id = e.account_id
       WHERE a.user_id = $1
       GROUP BY t.id
       ORDER BY t.effective_at DESC, t.id DESC
       LIMIT $2`,
      [userId, safeLimit],
    )
    return { transactions: rows, limit: safeLimit }
  }

  async settleWithdrawal(withdrawalId: string, chainTransactionId: string, requestId: string) {
    return this.transaction(async (runner) => {
      const [withdrawal] = await runner.query(`SELECT * FROM app.withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId])
      if (!withdrawal) throw new NotFoundException({ code: LEDGER_ERROR_CODES.WITHDRAWAL_NOT_FOUND, message: 'Withdrawal not found.' })
      if (withdrawal.state === 'completed') return { withdrawalId, state: 'completed', duplicate: true }
      if (!['broadcast', 'confirming'].includes(withdrawal.state as string)) {
        throw new ConflictException({ code: LEDGER_ERROR_CODES.WITHDRAWAL_STATE_INVALID, message: 'Withdrawal is not ready for settlement.' })
      }
      const [chain] = await runner.query(
        `SELECT id FROM app.chain_transactions WHERE id = $1 AND state = 'confirmed'`,
        [chainTransactionId],
      )
      if (!chain) throw new ConflictException({ code: LEDGER_ERROR_CODES.CHAIN_TRANSACTION_UNCONFIRMED, message: 'Chain transaction is not confirmed.' })
      const locked = await this.userAccount(runner, withdrawal.user_id as string, 'locked')
      const settlement = await this.systemSettlementAccount(runner, withdrawal.network as WalletNetwork)
      const transactionId = await this.ledgerTransaction(
        runner, 'withdrawal_settlement', `withdrawal-settlement:${withdrawalId}`,
        requestId, 'withdrawal', withdrawalId, 'partner', null,
      )
      if (transactionId) {
        const total = (BigInt(withdrawal.atomic_amount as string) + BigInt(withdrawal.fee_atomic_amount as string)).toString()
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, locked, settlement, total],
        )
      }
      await runner.query(
        `UPDATE app.withdrawals
         SET state = 'completed', chain_transaction_id = $2, completed_at = COALESCE(completed_at, now()), reason_code = NULL
         WHERE id = $1`,
        [withdrawalId, chainTransactionId],
      )
      await this.audit(runner, withdrawal.user_id as string, requestId, 'ledger.withdrawal.settled', withdrawalId, { chainTransactionId })
      return { withdrawalId, state: 'completed', duplicate: transactionId === null, ledgerTransactionId: transactionId }
    })
  }

  async refundWithdrawal(withdrawalId: string, reasonCode: string, requestId: string) {
    if (!reasonCode.trim()) throw new BadRequestException({ code: LEDGER_ERROR_CODES.WITHDRAWAL_STATE_INVALID, message: 'Refund reason is required.' })
    return this.transaction(async (runner) => {
      const [withdrawal] = await runner.query(`SELECT * FROM app.withdrawals WHERE id = $1 FOR UPDATE`, [withdrawalId])
      if (!withdrawal) throw new NotFoundException({ code: LEDGER_ERROR_CODES.WITHDRAWAL_NOT_FOUND, message: 'Withdrawal not found.' })
      if (withdrawal.state === 'completed') {
        throw new ConflictException({ code: LEDGER_ERROR_CODES.WITHDRAWAL_STATE_INVALID, message: 'A completed withdrawal cannot be refunded.' })
      }
      const locked = await this.userAccount(runner, withdrawal.user_id as string, 'locked')
      const available = await this.userAccount(runner, withdrawal.user_id as string, 'available')
      const transactionId = await this.ledgerTransaction(
        runner, 'withdrawal_refund', `withdrawal-refund:${withdrawalId}`,
        requestId, 'withdrawal', withdrawalId, 'service', null,
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
         SET state = 'failed', reason_code = $2, completed_at = NULL
         WHERE id = $1`,
        [withdrawalId, reasonCode],
      )
      await this.audit(runner, withdrawal.user_id as string, requestId, 'ledger.withdrawal.refunded', withdrawalId, { reasonCode })
      return { withdrawalId, state: 'failed', refunded: true, duplicate: transactionId === null, ledgerTransactionId: transactionId }
    })
  }

  async reconcileCustody(input: ReconcileCustodyInput) {
    this.assertAtomic(input.observedAtomicBalance)
    if (!(input.periodStart instanceof Date) || !(input.periodEnd instanceof Date) || input.periodEnd <= input.periodStart) {
      throw new BadRequestException({ code: LEDGER_ERROR_CODES.RECONCILIATION_INPUT_INVALID, message: 'Reconciliation period is invalid.' })
    }
    return this.transaction(async (runner) => {
      const accountId = await this.systemSettlementAccount(runner, input.network)
      const [balance] = await runner.query(
        `SELECT COALESCE(current_atomic_balance, 0)::text AS amount
         FROM app.ledger_account_balances WHERE account_id = $1`,
        [accountId],
      )
      const expected = BigInt(balance?.amount ?? '0')
      const observed = BigInt(input.observedAtomicBalance)
      const difference = observed - expected
      const state = difference === 0n ? 'matched' : 'differences_found'
      const runId = randomUUID()
      const inserted = await runner.query(
        `INSERT INTO app.reconciliation_runs
          (id, provider, network, asset_code, asset_decimals, period_start, period_end,
           expected_atomic_balance, observed_atomic_balance, difference_atomic_amount,
           state, source_reference, request_id, completed_at)
         VALUES ($1, $2, $3, 'USDT', 6, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (provider, network, asset_code, period_start, period_end, source_reference)
         DO NOTHING RETURNING id`,
        [
          runId, input.provider, input.network, input.periodStart, input.periodEnd,
          expected.toString(), observed.toString(), difference.toString(), state,
          input.sourceReference, input.requestId,
        ],
      )
      if (!inserted.length) {
        const [existing] = await runner.query(
          `SELECT id, state, difference_atomic_amount::text AS difference
           FROM app.reconciliation_runs
           WHERE provider = $1 AND network = $2 AND asset_code = 'USDT'
             AND period_start = $3 AND period_end = $4 AND source_reference = $5`,
          [input.provider, input.network, input.periodStart, input.periodEnd, input.sourceReference],
        )
        return { runId: existing.id as string, state: existing.state as string, differenceAtomicAmount: existing.difference as string, duplicate: true }
      }
      let caseId: string | null = null
      if (difference !== 0n) {
        caseId = randomUUID()
        await runner.query(
          `INSERT INTO app.reconciliation_cases
            (id, reconciliation_run_id, ledger_account_id, difference_atomic_amount,
             reason_code, evidence)
           VALUES ($1, $2, $3, $4, 'custody_balance_mismatch', $5)`,
          [caseId, runId, accountId, difference.toString(), JSON.stringify({ sourceReference: input.sourceReference })],
        )
      }
      if (input.adminId) {
        await this.auditAdmin(runner, input.adminId, input.requestId, 'ledger.reconciliation.completed', runId, {
          provider: input.provider,
          network: input.network,
          state,
          differenceAtomicAmount: difference.toString(),
          caseId,
        }, 'reconciliation_run')
      } else {
        await this.auditPartner(runner, input.requestId, 'ledger.reconciliation.completed', runId, {
          provider: input.provider,
          network: input.network,
          state,
          differenceAtomicAmount: difference.toString(),
          caseId,
          partnerEventId: input.partnerEventId ?? null,
        })
      }
      return { runId, state, expectedAtomicBalance: expected.toString(), observedAtomicBalance: observed.toString(), differenceAtomicAmount: difference.toString(), caseId, duplicate: false }
    })
  }

  async listLedgerAdjustments(state?: 'requested' | 'approved' | 'rejected' | 'posted', limit = 50) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const params: unknown[] = []
    const filter = state ? `WHERE r.state = $${params.push(state)}` : ''
    params.push(safeLimit)
    const rows = await this.dataSource.query(
      `SELECT r.id, r.ledger_account_id AS "ledgerAccountId", r.side,
              r.atomic_amount::text AS "atomicAmount", r.reason_code AS "reasonCode",
              r.evidence, r.state, r.requested_by AS "requestedBy",
              r.approved_by AS "approvedBy", r.request_id AS "requestId",
              r.posted_ledger_transaction_id AS "postedLedgerTransactionId",
              r.requested_at AS "requestedAt", r.decided_at AS "decidedAt", r.posted_at AS "postedAt",
              a.owner_type AS "ownerType", a.user_id AS "userId", a.owner_reference AS "ownerReference",
              a.purpose, a.asset_code AS "assetCode", a.asset_decimals AS "assetDecimals", a.network
       FROM app.ledger_adjustment_requests r
       JOIN app.ledger_accounts a ON a.id = r.ledger_account_id
       ${filter}
       ORDER BY r.requested_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return { adjustments: rows, limit: safeLimit }
  }

  async listReconciliationRuns(state?: 'running' | 'matched' | 'differences_found' | 'failed', limit = 50) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const params: unknown[] = []
    const filter = state ? `WHERE r.state = $${params.push(state)}` : ''
    params.push(safeLimit)
    const rows = await this.dataSource.query(
      `SELECT r.id, r.provider, r.network, r.asset_code AS "assetCode",
              r.asset_decimals AS "assetDecimals", r.period_start AS "periodStart",
              r.period_end AS "periodEnd", r.expected_atomic_balance::text AS "expectedAtomicBalance",
              r.observed_atomic_balance::text AS "observedAtomicBalance",
              r.difference_atomic_amount::text AS "differenceAtomicAmount", r.state,
              r.source_reference AS "sourceReference", r.request_id AS "requestId",
              r.created_at AS "createdAt", r.completed_at AS "completedAt", r.error_code AS "errorCode",
              COALESCE(jsonb_agg(jsonb_build_object(
                'id', c.id,
                'ledgerAccountId', c.ledger_account_id,
                'differenceAtomicAmount', c.difference_atomic_amount::text,
                'state', c.state,
                'reasonCode', c.reason_code,
                'evidence', c.evidence,
                'openedAt', c.opened_at,
                'resolvedAt', c.resolved_at
              ) ORDER BY c.opened_at) FILTER (WHERE c.id IS NOT NULL), '[]'::jsonb) AS cases
       FROM app.reconciliation_runs r
       LEFT JOIN app.reconciliation_cases c ON c.reconciliation_run_id = r.id
       ${filter}
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return { runs: rows, limit: safeLimit }
  }

  async createLedgerAdjustment(input: CreateLedgerAdjustmentInput) {
    if (!/^[1-9]\d{0,77}$/.test(input.atomicAmount)) {
      throw new BadRequestException({
        code: LEDGER_ERROR_CODES.RECONCILIATION_INPUT_INVALID,
        message: 'Adjustment amount must be a positive smallest-unit integer.',
      })
    }
    if (!input.reasonCode.trim()) {
      throw new BadRequestException({
        code: LEDGER_ERROR_CODES.ADJUSTMENT_STATE_INVALID,
        message: 'Adjustment reason code is required.',
      })
    }
    return this.transaction(async (runner) => {
      const [account] = await runner.query(
        `SELECT id, state FROM app.ledger_accounts WHERE id = $1 FOR SHARE`,
        [input.ledgerAccountId],
      )
      if (!account) {
        throw new NotFoundException({ code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND, message: 'Ledger account not found.' })
      }
      if (account.state !== 'active') {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ADJUSTMENT_STATE_INVALID,
          message: 'Only an active ledger account can receive an adjustment request.',
        })
      }
      const id = randomUUID()
      const [created] = await runner.query(
        `INSERT INTO app.ledger_adjustment_requests
          (id, ledger_account_id, side, atomic_amount, reason_code, evidence,
           requested_by, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, state, requested_at AS "requestedAt"`,
        [
          id,
          input.ledgerAccountId,
          input.side,
          input.atomicAmount,
          input.reasonCode.trim(),
          JSON.stringify(input.evidence),
          input.adminId,
          input.requestId,
        ],
      )
      await this.auditAdmin(runner, input.adminId, input.requestId, 'ledger.adjustment.requested', id, {
        ledgerAccountId: input.ledgerAccountId,
        side: input.side,
        atomicAmount: input.atomicAmount,
        reasonCode: input.reasonCode.trim(),
      })
      return { id, state: created.state as string, requestedAt: created.requestedAt as Date }
    })
  }

  async decideLedgerAdjustment(
    adjustmentId: string,
    adminId: string,
    approve: boolean,
    decisionReason: string | undefined,
    requestId: string,
  ) {
    return this.transaction(async (runner) => {
      const [adjustment] = await runner.query(
        `SELECT * FROM app.ledger_adjustment_requests WHERE id = $1 FOR UPDATE`,
        [adjustmentId],
      )
      if (!adjustment) {
        throw new NotFoundException({ code: LEDGER_ERROR_CODES.ADJUSTMENT_NOT_FOUND, message: 'Ledger adjustment request not found.' })
      }
      if (adjustment.state !== 'requested') {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ADJUSTMENT_STATE_INVALID,
          message: `Ledger adjustment cannot be decided from ${adjustment.state}.`,
        })
      }
      if (adjustment.requested_by === adminId) {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ADJUSTMENT_SELF_APPROVAL_FORBIDDEN,
          message: 'The administrator who requested an adjustment cannot decide it.',
        })
      }
      const state = approve ? 'approved' : 'rejected'
      const [updated] = await runner.query(
        `UPDATE app.ledger_adjustment_requests
         SET state = $2, approved_by = $3, decided_at = now(),
             evidence = evidence || $4::jsonb
         WHERE id = $1
         RETURNING id, state, approved_by AS "approvedBy", decided_at AS "decidedAt"`,
        [
          adjustmentId,
          state,
          adminId,
          JSON.stringify(decisionReason?.trim() ? { decisionReason: decisionReason.trim() } : {}),
        ],
      )
      await this.auditAdmin(
        runner,
        adminId,
        requestId,
        approve ? 'ledger.adjustment.approved' : 'ledger.adjustment.rejected',
        adjustmentId,
        { requestedBy: adjustment.requested_by as string, decisionReason: decisionReason?.trim() ?? null },
      )
      return updated
    })
  }

  async postLedgerAdjustment(adjustmentId: string, adminId: string, requestId: string) {
    return this.transaction(async (runner) => {
      const [adjustment] = await runner.query(
        `SELECT * FROM app.ledger_adjustment_requests WHERE id = $1 FOR UPDATE`,
        [adjustmentId],
      )
      if (!adjustment) {
        throw new NotFoundException({ code: LEDGER_ERROR_CODES.ADJUSTMENT_NOT_FOUND, message: 'Ledger adjustment request not found.' })
      }
      if (adjustment.state === 'posted') {
        return {
          id: adjustmentId,
          state: 'posted',
          ledgerTransactionId: adjustment.posted_ledger_transaction_id as string,
          duplicate: true,
        }
      }
      if (adjustment.state !== 'approved' || !adjustment.approved_by) {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ADJUSTMENT_STATE_INVALID,
          message: 'Only an independently approved ledger adjustment can be posted.',
        })
      }
      const [target] = await runner.query(
        `SELECT id, owner_type, asset_code, asset_decimals, network, state
         FROM app.ledger_accounts WHERE id = $1 FOR SHARE`,
        [adjustment.ledger_account_id],
      )
      if (!target || target.state !== 'active') {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND,
          message: 'Adjustment target account is missing or inactive.',
        })
      }
      await runner.query(
        `INSERT INTO app.ledger_accounts
          (owner_type, owner_reference, purpose, asset_code, asset_decimals, network,
           normal_side, allow_negative)
         VALUES ('platform', 'ledger-adjustments', 'custody_difference', $1, $2, $3, 'debit', true)
         ON CONFLICT DO NOTHING`,
        [target.asset_code, target.asset_decimals, target.network],
      )
      const [contra] = await runner.query(
        `SELECT id FROM app.ledger_accounts
         WHERE owner_type = 'platform' AND owner_reference = 'ledger-adjustments'
           AND purpose = 'custody_difference' AND asset_code = $1
           AND COALESCE(network, '') = COALESCE($2, '')`,
        [target.asset_code, target.network],
      )
      if (!contra) throw new Error('Adjustment contra account could not be resolved')

      const transactionId = randomUUID()
      const inserted = await runner.query(
        `INSERT INTO app.ledger_transactions
          (id, transaction_type, idempotency_key, request_id, reference_type,
           reference_id, reason_code, actor_type, actor_id, effective_at, metadata)
         VALUES ($1, 'adjustment', $2, $3, 'ledger_adjustment_request', $4, $5,
                 'admin', $6, now(), $7)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
          transactionId,
          `ledger-adjustment:${adjustmentId}`,
          requestId,
          adjustmentId,
          adjustment.reason_code,
          adminId,
          JSON.stringify({ approvedBy: adjustment.approved_by, requestedBy: adjustment.requested_by }),
        ],
      )
      let persistedTransactionId: string = transactionId
      if (inserted.length) {
        const oppositeSide = adjustment.side === 'debit' ? 'credit' : 'debit'
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, $3, $5), ($1, $4, $6, $5)`,
          [
            transactionId,
            adjustment.ledger_account_id,
            adjustment.side,
            contra.id,
            adjustment.atomic_amount,
            oppositeSide,
          ],
        )
      } else {
        const [existing] = await runner.query(
          `SELECT id FROM app.ledger_transactions WHERE idempotency_key = $1`,
          [`ledger-adjustment:${adjustmentId}`],
        )
        persistedTransactionId = existing.id as string
      }
      await runner.query(
        `UPDATE app.ledger_adjustment_requests
         SET state = 'posted', posted_ledger_transaction_id = $2, posted_at = now()
         WHERE id = $1`,
        [adjustmentId, persistedTransactionId],
      )
      await this.auditAdmin(runner, adminId, requestId, 'ledger.adjustment.posted', adjustmentId, {
        ledgerTransactionId: persistedTransactionId,
        approvedBy: adjustment.approved_by as string,
      })
      return { id: adjustmentId, state: 'posted', ledgerTransactionId: persistedTransactionId, duplicate: !inserted.length }
    })
  }

  private async userAccount(runner: QueryRunner, userId: string, purpose: 'available' | 'locked') {
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'user' AND user_id = $1 AND purpose = $2
         AND asset_code = 'USDT' AND network IS NULL AND state = 'active'`,
      [userId, purpose],
    )
    if (!account) throw new NotFoundException({ code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND, message: `Active ${purpose} ledger account not found.` })
    return account.id as string
  }

  private async systemSettlementAccount(runner: QueryRunner, network: WalletNetwork) {
    const reference = `custody:${network}`
    await runner.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side)
       VALUES ('custody_provider', $1, 'settlement', 'USDT', 6, $2, 'debit') ON CONFLICT DO NOTHING`,
      [reference, network],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'custody_provider' AND owner_reference = $1
         AND purpose = 'settlement' AND asset_code = 'USDT' AND network = $2`,
      [reference, network],
    )
    return account.id as string
  }

  private async ledgerTransaction(
    runner: QueryRunner,
    transactionType: string,
    idempotencyKey: string,
    requestId: string,
    referenceType: string,
    referenceId: string,
    actorType: 'service' | 'partner',
    actorId: string | null,
  ): Promise<string | null> {
    const rows = await runner.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id,
         actor_type, actor_id, effective_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [transactionType, idempotencyKey, requestId, referenceType, referenceId, actorType, actorId],
    )
    return (rows[0]?.id as string | undefined) ?? null
  }

  private async audit(runner: QueryRunner, userId: string, requestId: string, action: string, withdrawalId: string, metadata: Record<string, unknown>) {
    await runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, user_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'service', $2, $3, 'withdrawal', $4, $5, $6)`,
      [randomUUID(), userId, action, withdrawalId, requestId, JSON.stringify(metadata)],
    )
  }

  private async auditAdmin(
    runner: QueryRunner,
    adminId: string,
    requestId: string,
    action: string,
    adjustmentId: string,
    metadata: Record<string, unknown>,
    objectType = 'ledger_adjustment_request',
  ) {
    await runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), adminId, action, objectType, adjustmentId, requestId, JSON.stringify(metadata)],
    )
  }

  private async auditPartner(
    runner: QueryRunner,
    requestId: string,
    action: string,
    reconciliationRunId: string,
    metadata: Record<string, unknown>,
  ) {
    await runner.query(
      `INSERT INTO app.audit_logs
        (id, actor_type, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'partner', $2, 'reconciliation_run', $3, $4, $5)`,
      [randomUUID(), action, reconciliationRunId, requestId, JSON.stringify(metadata)],
    )
  }

  private assertAtomic(value: string) {
    if (!/^(0|[1-9]\d{0,77})$/.test(value)) {
      throw new BadRequestException({ code: LEDGER_ERROR_CODES.RECONCILIATION_INPUT_INVALID, message: 'Observed balance must be a non-negative smallest-unit integer.' })
    }
  }

  private async transaction<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      const result = await work(runner)
      await runner.commitTransaction()
      return result
    } catch (error) {
      await runner.rollbackTransaction()
      throw error
    } finally {
      await runner.release()
    }
  }
}
