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

export interface UserBalanceAdjustmentInput {
  userId: string
  adminId: string
  operationId: string
  mode: 'credit' | 'debit' | 'set'
  amount: string
  expectedAtomicBalance: string
  reason: string
  requestId: string
}

interface LedgerTransactionCursor {
  effectiveAt: string
  id: string
}

const LEDGER_TRANSACTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function decodeLedgerTransactionCursor(cursor: string | undefined): LedgerTransactionCursor | null {
  if (!cursor) return null
  try {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('invalid encoding')
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>
    if (typeof value.effectiveAt !== 'string' || !Number.isFinite(Date.parse(value.effectiveAt))) throw new Error('invalid timestamp')
    if (typeof value.id !== 'string' || !LEDGER_TRANSACTION_ID.test(value.id)) throw new Error('invalid id')
    return { effectiveAt: new Date(value.effectiveAt).toISOString(), id: value.id }
  } catch {
    throw new BadRequestException({
      code: LEDGER_ERROR_CODES.TRANSACTION_CURSOR_INVALID,
      message: 'The ledger page cursor is invalid.',
    })
  }
}

function encodeLedgerTransactionCursor(row: { effectiveAt: string | Date; id: string }): string {
  const effectiveAt = row.effectiveAt instanceof Date ? row.effectiveAt.toISOString() : new Date(row.effectiveAt).toISOString()
  return Buffer.from(JSON.stringify({ effectiveAt, id: row.id }), 'utf8').toString('base64url')
}

interface BasketSettlementTransferInput {
  userId: string
  portfolioId: string
  direction: 'subscription' | 'redemption'
  /** USDT 原子单位（正整数字符串） */
  atomicAmount: string
  referenceType: 'basket_subscription' | 'basket_redemption'
  referenceId: string
  requestId: string
}

interface BasketInvestmentTransferInput {
  portfolioId: string
  direction: 'invest' | 'divest'
  /** USDT 原子单位（正整数字符串） */
  atomicAmount: string
  /** 调仓订单 id（幂等键 basket_rebalance:<orderId>） */
  referenceId: string
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

  async listUserTransactions(userId: string, limit = 50, rawCursor?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const cursor = decodeLedgerTransactionCursor(rawCursor)
    const rows = await this.dataSource.query(
      `SELECT t.id, t.transaction_type AS "transactionType", t.reference_type AS "referenceType",
              t.reference_id AS "referenceId", t.effective_at AS "effectiveAt", t.created_at AS "createdAt",
              jsonb_agg(jsonb_build_object(
                'entryId', e.id,
                'accountId', a.id,
                'purpose', a.purpose,
                'normalSide', a.normal_side,
                'side', e.side,
                'atomicAmount', e.atomic_amount::text,
                'assetCode', a.asset_code,
                'assetDecimals', a.asset_decimals
              ) ORDER BY e.created_at, e.id) AS entries
       FROM app.ledger_transactions t
       JOIN app.ledger_entries e ON e.transaction_id = t.id
       JOIN app.ledger_accounts a ON a.id = e.account_id
       WHERE a.user_id = $1
         AND ($2::timestamptz IS NULL OR (t.effective_at, t.id) < ($2::timestamptz, $3::uuid))
       GROUP BY t.id
       ORDER BY t.effective_at DESC, t.id DESC
       LIMIT $4`,
      [userId, cursor?.effectiveAt ?? null, cursor?.id ?? null, safeLimit + 1],
    )
    const transactions = rows.slice(0, safeLimit)
    const last = transactions[transactions.length - 1]
    const nextCursor = rows.length > safeLimit && last
      ? encodeLedgerTransactionCursor({ effectiveAt: last.effectiveAt as string | Date, id: last.id as string })
      : null
    return { transactions, limit: safeLimit, nextCursor }
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
    return this.transaction((runner) => this.postAdjustment(runner, adjustmentId, adminId, requestId))
  }

  /** One explicit administrator confirmation; all request, approval and posting writes commit together. */
  async adjustUserBalance(input: UserBalanceAdjustmentInput) {
    const invalid = () => new BadRequestException({ code: 'USER_ADJUSTMENT_INVALID', message: '请输入有效金额（最多 6 位小数）、操作编号和至少 3 个字的调整原因。' })
    if (!/^(0|[1-9]\d{0,71})(?:\.\d{1,6})?$/.test(input.amount)
      || !/^(0|[1-9]\d{0,77})$/.test(input.expectedAtomicBalance)
      || !LEDGER_TRANSACTION_ID.test(input.operationId) || !['credit', 'debit', 'set'].includes(input.mode)
      || input.reason.trim().length < 3 || input.reason.trim().length > 240) throw invalid()
    const [whole, fraction = ''] = input.amount.split('.')
    const amount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))
    if (input.mode !== 'set' && amount === 0n) throw invalid()
    return this.transaction(async (runner) => {
      await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`admin-user-balance:${input.adminId}:${input.operationId}`])
      const [existing] = await runner.query(`SELECT id, state, evidence, posted_ledger_transaction_id
        FROM app.ledger_adjustment_requests WHERE requested_by = $1 AND request_id = $2
          AND evidence->>'origin' = 'admin-user-management' LIMIT 1`, [input.adminId, input.operationId])
      if (existing) {
        const e = existing.evidence
        if (existing.state !== 'posted' || e.userId !== input.userId || e.mode !== input.mode
          || e.amountAtomic !== amount.toString() || e.reason !== input.reason.trim() || e.beforeAtomic !== input.expectedAtomicBalance) {
          throw new ConflictException({ code: 'USER_ADJUSTMENT_DUPLICATE_CONFLICT', message: '此操作编号已用于另一笔调整，请刷新后重试。' })
        }
        return { id: existing.id, userId: input.userId, state: 'posted', ledgerTransactionId: existing.posted_ledger_transaction_id,
          beforeAtomic: e.beforeAtomic, afterAtomic: e.afterAtomic, duplicate: true }
      }
      const [user] = await runner.query('SELECT id, status FROM app.users WHERE id = $1 FOR SHARE', [input.userId])
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: '用户不存在。' })
      if (user.status !== 'active') throw new ConflictException({ code: 'USER_ADJUSTMENT_UNAVAILABLE', message: '只能调整状态正常的用户。' })
      await runner.query(`INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
        VALUES ('user', $1, 'available', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`, [input.userId])
      const [account] = await runner.query(`SELECT id, normal_side, asset_decimals, state FROM app.ledger_accounts
        WHERE owner_type = 'user' AND user_id = $1 AND purpose = 'available' AND asset_code = 'USDT' AND network IS NULL FOR SHARE`, [input.userId])
      if (!account || account.state !== 'active' || account.asset_decimals !== 6) {
        throw new ConflictException({ code: 'USER_ADJUSTMENT_UNAVAILABLE', message: '用户的 USDT 可用账户不可调账。' })
      }
      await runner.query(`INSERT INTO app.ledger_account_balances (account_id)
        SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM app.ledger_entries WHERE account_id = $1) ON CONFLICT DO NOTHING`, [account.id])
      const [balance] = await runner.query('SELECT current_atomic_balance::text AS "atomicBalance" FROM app.ledger_account_balances WHERE account_id = $1 FOR UPDATE', [account.id])
      if (!balance) throw new ConflictException({ code: 'USER_ADJUSTMENT_UNAVAILABLE', message: '账本余额投影缺失，请先完成账本核对。' })
      const before = BigInt(balance.atomicBalance)
      if (before.toString() !== input.expectedAtomicBalance) {
        throw new ConflictException({ code: 'USER_BALANCE_CHANGED', message: '用户余额已变化，请刷新并重新核对金额。' })
      }
      const delta = input.mode === 'set' ? amount - before : input.mode === 'credit' ? amount : -amount
      const after = before + delta
      if (after < 0n) throw new ConflictException({ code: 'USER_BALANCE_INSUFFICIENT', message: '扣减金额超过当前可用余额。' })
      if (after.toString().length > 78) throw invalid()
      if (delta === 0n) throw new BadRequestException({ code: 'USER_ADJUSTMENT_NO_CHANGE', message: '目标余额与当前余额相同，无需调账。' })
      const side = delta > 0n ? account.normal_side : account.normal_side === 'credit' ? 'debit' : 'credit'
      const atomicAmount = (delta < 0n ? -delta : delta).toString()
      const reasonCode = input.mode === 'set' ? 'manual_set_balance' : `manual_${input.mode}`
      const evidence = { origin: 'admin-user-management', userId: input.userId, mode: input.mode, amountAtomic: amount.toString(),
        reason: input.reason.trim(), beforeAtomic: before.toString(), afterAtomic: after.toString() }
      const id = randomUUID()
      await runner.query(`INSERT INTO app.ledger_adjustment_requests
        (id, ledger_account_id, side, atomic_amount, reason_code, evidence, requested_by, request_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, state`,
      [id, account.id, side, atomicAmount, reasonCode, JSON.stringify(evidence), input.adminId, input.operationId])
      await this.auditAdmin(runner, input.adminId, input.requestId, 'ledger.adjustment.requested', id, { ...evidence, ledgerAccountId: account.id, side, atomicAmount })
      await runner.query(`UPDATE app.ledger_adjustment_requests SET state = 'approved', approved_by = $2, decided_at = now() WHERE id = $1`, [id, input.adminId])
      await this.auditAdmin(runner, input.adminId, input.requestId, 'ledger.adjustment.approved', id, { singleOperator: true, requestedBy: input.adminId })
      const posted = await this.postAdjustment(runner, id, input.adminId, input.requestId)
      return { ...posted, userId: input.userId, beforeAtomic: before.toString(), afterAtomic: after.toString() }
    })
  }

  private async postAdjustment(runner: QueryRunner, adjustmentId: string, adminId: string, requestId: string) {
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
        `SELECT id, owner_type, user_id, purpose, asset_code, asset_decimals, network, state
         FROM app.ledger_accounts WHERE id = $1 FOR SHARE`,
        [adjustment.ledger_account_id],
      )
      if (!target || target.state !== 'active') {
        throw new ConflictException({
          code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND,
          message: 'Adjustment target account is missing or inactive.',
        })
      }
      // A user-targeted adjustment must still match the confirmed account and balance at posting.
      if (adjustment.evidence?.origin === 'admin-user-management') {
        if (target.owner_type !== 'user' || target.user_id !== adjustment.evidence.userId || target.purpose !== 'available'
          || target.asset_code !== 'USDT' || target.asset_decimals !== 6 || target.network !== null) {
          throw new ConflictException({ code: 'USER_ADJUSTMENT_UNAVAILABLE', message: '调整目标账户已变化。' })
        }
        const [balance] = await runner.query('SELECT current_atomic_balance::text AS "atomicBalance" FROM app.ledger_account_balances WHERE account_id = $1 FOR UPDATE', [target.id])
        if (!balance || balance.atomicBalance !== adjustment.evidence.beforeAtomic) {
          throw new ConflictException({ code: 'USER_BALANCE_CHANGED', message: '用户余额已变化，请重新核对金额。' })
        }
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
  }

  /**
   * Basket 申赎资金划转（Phase 10）：用户可用账户 ↔ 组合结算账户（platform/basket_settlement）。
   * - 幂等：idempotency_key = `${referenceType}:${referenceId}`
   * - 订阅：用户可用 debit → 组合 credit；赎回：组合 debit → 用户可用 credit
   * - 余额不足由账本触发器拒绝（用户账户 allow_negative=false）
   */
  async transferBasketSettlement(
    input: BasketSettlementTransferInput,
  ): Promise<{ ledgerTransactionId: string | null; duplicate: boolean }> {
    if (!/^[1-9]\d{0,77}$/.test(input.atomicAmount)) {
      throw new BadRequestException({
        code: LEDGER_ERROR_CODES.RECONCILIATION_INPUT_INVALID,
        message: 'Basket transfer amount must be a positive smallest-unit integer.',
      })
    }
    return this.transaction(async (runner) => {
      const user = await this.userAccount(runner, input.userId, 'available')
      const basket = await this.basketSettlementAccount(runner, input.portfolioId)
      const idempotencyKey = `${input.referenceType}:${input.referenceId}`
      const transactionId = await this.ledgerTransaction(
        runner,
        input.referenceType,
        idempotencyKey,
        input.requestId,
        input.referenceType,
        input.referenceId,
        'service',
        null,
      )
      if (transactionId) {
        const [debitAccount, creditAccount] = input.direction === 'subscription' ? [user, basket] : [basket, user]
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, debitAccount, creditAccount, input.atomicAmount],
        )
        return { ledgerTransactionId: transactionId, duplicate: false }
      }
      const [existing] = await runner.query(`SELECT id FROM app.ledger_transactions WHERE idempotency_key = $1`, [idempotencyKey])
      return { ledgerTransactionId: (existing?.id as string | undefined) ?? null, duplicate: true }
    })
  }

  /**
   * Basket 内部投资腿（Phase 13-14）：组合现金 ↔ 组合投资（invested_cost 账户）。
   * 买入成交 = invest（现金减、投资增）；卖出成交 = divest（投资减、现金增）。
   * 幂等键 basket_rebalance:<orderId>（每张调仓订单一条现金流）。
   */
  async transferBasketInvestment(
    input: BasketInvestmentTransferInput,
  ): Promise<{ ledgerTransactionId: string | null; duplicate: boolean }> {
    if (!/^[1-9]\d{0,77}$/.test(input.atomicAmount)) {
      throw new BadRequestException({
        code: LEDGER_ERROR_CODES.RECONCILIATION_INPUT_INVALID,
        message: 'Basket investment amount must be a positive smallest-unit integer.',
      })
    }
    return this.transaction(async (runner) => {
      const basket = await this.basketSettlementAccount(runner, input.portfolioId)
      const invested = await this.basketInvestedAccount(runner, input.portfolioId)
      const idempotencyKey = `basket_rebalance:${input.referenceId}`
      const transactionId = await this.ledgerTransaction(
        runner,
        'basket_rebalance',
        idempotencyKey,
        input.requestId,
        'basket_rebalance',
        input.referenceId,
        'service',
        null,
      )
      if (transactionId) {
        const [debitAccount, creditAccount] = input.direction === 'invest' ? [basket, invested] : [invested, basket]
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, debitAccount, creditAccount, input.atomicAmount],
        )
        return { ledgerTransactionId: transactionId, duplicate: false }
      }
      const [existing] = await runner.query(`SELECT id FROM app.ledger_transactions WHERE idempotency_key = $1`, [idempotencyKey])
      return { ledgerTransactionId: (existing?.id as string | undefined) ?? null, duplicate: true }
    })
  }

  /** 组合投资账户（幂等创建；owner_reference = basket:<portfolioId>:invested） */
  private async basketInvestedAccount(runner: QueryRunner, portfolioId: string): Promise<string> {
    const reference = `basket:${portfolioId}:invested`
    await runner.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side)
       VALUES ('platform', $1, 'invested_cost', 'USDT', 6, NULL, 'credit') ON CONFLICT DO NOTHING`,
      [reference],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'platform' AND owner_reference = $1
         AND purpose = 'invested_cost' AND asset_code = 'USDT' AND network IS NULL`,
      [reference],
    )
    if (!account) {
      throw new NotFoundException({ code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND, message: 'Basket invested account could not be resolved.' })
    }
    return account.id as string
  }

  /** 组合结算账户（幂等创建；owner_reference = basket:<portfolioId>） */
  private async basketSettlementAccount(runner: QueryRunner, portfolioId: string): Promise<string> {
    const reference = `basket:${portfolioId}`
    await runner.query(
      `INSERT INTO app.ledger_accounts
        (owner_type, owner_reference, purpose, asset_code, asset_decimals, network, normal_side)
       VALUES ('platform', $1, 'basket_settlement', 'USDT', 6, NULL, 'credit') ON CONFLICT DO NOTHING`,
      [reference],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts
       WHERE owner_type = 'platform' AND owner_reference = $1
         AND purpose = 'basket_settlement' AND asset_code = 'USDT' AND network IS NULL`,
      [reference],
    )
    if (!account) {
      throw new NotFoundException({ code: LEDGER_ERROR_CODES.ACCOUNT_NOT_FOUND, message: 'Basket settlement account could not be resolved.' })
    }
    return account.id as string
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
