import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { format18, parse18 } from '../basket/basket.decimals'
import { LedgerService } from '../ledger/ledger.service'
import { addDays, localDateAndMinutes } from './quant.dates'
import { aggregateByUser, applyDay, dailyManagementRate, dayDeltas, planRedemptions, stepIndex, type LotDay, type QuantLot } from './quant.math'
import { parseUsdt, QuantService } from './quant.service'
import type { QuantUpdateProductDto } from './quant.dto'

type SettlementRow = {
  id: string; product_id: string; trade_date: string; gross_return_pct: string; status: string; note: string | null
  entered_by: string; approved_by: string | null; large_move_confirmed: boolean
}

const SETTLEMENT_COLUMNS = `id, product_id, trade_date::text AS trade_date, trim_scale(gross_return_pct)::text AS gross_return_pct, status, note, entered_by::text AS entered_by,
  approved_by::text AS approved_by, large_move_confirmed`

/**
 * Koala Quant, operator side. One trade date is settled in three steps (the same administrator may do all of them):
 *   1. enter  - the operator records the strategy's real gross return for the day (draft)
 *   2. approve - confirm it in a separate action (a move above the product's daily limit needs an explicit confirmation)
 *   3. post   - runs right after approval: applies the return to every lot, pays profits to users' available balance,
 *               books fees, pays due redemptions, advances the product index and closes the day. Safe to retry.
 * Days are settled strictly in order with no gaps, and a day can only be settled after it has ended in the product's timezone.
 */
@Injectable()
export class QuantSettlementService {
  private readonly log = new Logger(QuantSettlementService.name)

  constructor(
    private readonly ds: DataSource,
    private readonly ledger: LedgerService,
    private readonly quant: QuantService,
  ) {}

  async listProducts() {
    const rows = (await this.ds.query(`SELECT slug FROM app.quant_products ORDER BY created_at`)) as Array<{ slug: string }>
    return Promise.all(rows.map((row) => this.adminProduct(row.slug)))
  }

  async adminProduct(slug: string) {
    const product = await this.quant.getProductRow(slug)
    const [totals] = (await this.ds.query(
      `SELECT COALESCE(SUM(principal_atomic), 0)::text AS principal, COUNT(DISTINCT user_id)::int AS users FROM app.quant_lots WHERE product_id = $1 AND principal_atomic > 0`,
      [product.id],
    )) as Array<{ principal: string; users: number }>
    const balances = (await this.ds.query(
      `SELECT a.owner_reference AS ref, COALESCE(b.current_atomic_balance, 0)::text AS balance
       FROM app.ledger_accounts a LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.owner_type = 'platform' AND a.owner_reference IN ($1, $2, $3)`,
      [`quant:${product.id}`, `quant:${product.id}:fee`, `quant:${product.id}:treasury`],
    )) as Array<{ ref: string; balance: string }>
    const balance = (ref: string) => balances.find((row) => row.ref === ref)?.balance ?? '0'
    const poolAtomic = balance(`quant:${product.id}`)
    const next = product.last_settled_date ? addDays(product.last_settled_date, 1) : product.first_trade_date
    const [queue] = (await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE kind = 'redemption')::int AS redemptions FROM app.quant_orders WHERE product_id = $1 AND status = 'pending'`,
      [product.id],
    )) as Array<{ redemptions: number }>
    return {
      ...product,
      nextTradeDate: next,
      totals: { principalAtomic: totals.principal, users: totals.users, pendingRedemptions: queue.redemptions },
      // pool must equal the sum of lot principals; treasury below zero is what the platform has paid out of its own funds.
      ledger: { poolAtomic, poolMatchesLots: poolAtomic === totals.principal, feeAtomic: balance(`quant:${product.id}:fee`), treasuryAtomic: balance(`quant:${product.id}:treasury`) },
    }
  }

  async updateProduct(slug: string, dto: QuantUpdateProductDto, adminId: string) {
    const product = await this.quant.getProductRow(slug)
    const sets: string[] = []
    const values: unknown[] = []
    const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`) }
    if (dto.name !== undefined) add('name', dto.name)
    if (dto.summary !== undefined) add('summary', dto.summary)
    if (dto.mgmtFeeBps !== undefined) add('mgmt_fee_bps', dto.mgmtFeeBps)
    if (dto.perfFeeBps !== undefined) add('perf_fee_bps', dto.perfFeeBps)
    if (dto.minSubscriptionUsd !== undefined) add('min_subscription_atomic', parseUsdt(dto.minSubscriptionUsd).toString())
    if (dto.minRedemptionUsd !== undefined) add('min_redemption_atomic', parseUsdt(dto.minRedemptionUsd).toString())
    if (dto.maxDailyMovePct !== undefined) add('max_daily_move_pct', dto.maxDailyMovePct)
    if (dto.targetAnnualMinPct !== undefined) add('target_annual_min_pct', dto.targetAnnualMinPct)
    if (dto.targetAnnualMaxPct !== undefined) add('target_annual_max_pct', dto.targetAnnualMaxPct)
    if (dto.cutoffTime !== undefined) add('cutoff_time', dto.cutoffTime)
    if (dto.firstTradeDate !== undefined) {
      if (product.last_settled_date) throw new ConflictException({ code: 'QUANT_FIRST_DATE_LOCKED', message: 'The first trade date cannot change once a day has been settled.' })
      add('first_trade_date', dto.firstTradeDate)
    }
    if (dto.status !== undefined) {
      const firstDate = dto.firstTradeDate ?? product.first_trade_date
      if (['pilot', 'active'].includes(dto.status) && !firstDate) throw new BadRequestException({ code: 'QUANT_FIRST_DATE_REQUIRED', message: 'Set the first trade date before opening the product.' })
      add('status', dto.status)
    }
    if (!sets.length) return this.adminProduct(slug)
    await this.ds.transaction(async (manager) => {
      await manager.query(`UPDATE app.quant_products SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length + 1}`, [...values, product.id])
      await manager.query(
        `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata) VALUES ($1, 'admin', $2, 'quant.product.updated', 'quant_product', $3, $4, $5)`,
        [randomUUID(), adminId, product.id, `quant-product-${product.id}`, JSON.stringify(dto)],
      )
    })
    return this.adminProduct(slug)
  }

  async listSettlements(slug: string, limit = 60) {
    const product = await this.quant.getProductRow(slug)
    return this.ds.query(
      `SELECT id, trade_date::text AS "tradeDate", trim_scale(gross_return_pct)::text AS "grossReturnPct", trim_scale(net_return_pct)::text AS "netReturnPct", status, note,
              entered_by::text AS "enteredBy", approved_by::text AS "approvedBy", large_move_confirmed AS "largeMoveConfirmed", trim_scale(index_after)::text AS "indexAfter",
              users_count AS "usersCount", principal_atomic::text AS "principalAtomic", gross_atomic::text AS "grossAtomic", mgmt_fee_atomic::text AS "mgmtFeeAtomic",
              perf_fee_atomic::text AS "perfFeeAtomic", paid_atomic::text AS "paidAtomic", principal_loss_atomic::text AS "principalLossAtomic",
              redemption_principal_atomic::text AS "redemptionPrincipalAtomic", redemption_fee_atomic::text AS "redemptionFeeAtomic", posted_at AS "postedAt", created_at AS "createdAt"
       FROM app.quant_daily_settlements WHERE product_id = $1 ORDER BY trade_date DESC, created_at DESC LIMIT $2`,
      [product.id, Math.min(Math.max(limit, 1), 365)],
    )
  }

  /** Step 1: record the day's real gross return as a draft. */
  async enter(slug: string, input: { tradeDate: string; grossReturnPct: string; note?: string }, adminId: string) {
    const product = await this.quant.getProductRow(slug)
    if (!product.first_trade_date) throw new ConflictException({ code: 'QUANT_FIRST_DATE_REQUIRED', message: 'Set the first trade date first.' })
    const expected = product.last_settled_date ? addDays(product.last_settled_date, 1) : product.first_trade_date
    if (input.tradeDate !== expected) throw new ConflictException({ code: 'QUANT_TRADE_DATE_OUT_OF_ORDER', message: `The next trade date to settle is ${expected}.`, expected })
    if (input.tradeDate >= localDateAndMinutes(new Date(), product.timezone).date) throw new ConflictException({ code: 'QUANT_TRADE_DATE_NOT_ENDED', message: 'A trade date can only be settled after it has ended.' })
    if (Number(input.grossReturnPct) <= -100) throw new BadRequestException({ code: 'QUANT_RETURN_INVALID', message: 'A daily return of -100% or worse is not allowed.' })
    const [row] = (await this.ds.query(
      `INSERT INTO app.quant_daily_settlements (product_id, trade_date, gross_return_pct, note, entered_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id, trade_date) WHERE status <> 'voided' DO NOTHING RETURNING ${SETTLEMENT_COLUMNS}`,
      [product.id, input.tradeDate, input.grossReturnPct, input.note ?? null, adminId],
    )) as SettlementRow[]
    if (!row) throw new ConflictException({ code: 'QUANT_ALREADY_ENTERED', message: 'This trade date already has an entry. Void the draft first to re-enter it.' })
    await this.audit('quant.settlement.entered', row.id, adminId, { productId: product.id, tradeDate: input.tradeDate, grossReturnPct: input.grossReturnPct })
    return row
  }

  async voidDraft(settlementId: string, adminId: string) {
    const rows = (await this.ds.query(`UPDATE app.quant_daily_settlements SET status = 'voided' WHERE id = $1 AND status IN ('draft', 'approved') RETURNING id`, [settlementId])) as Array<{ id: string }>
    if (!rows.length) throw new ConflictException({ code: 'QUANT_NOT_VOIDABLE', message: 'Only a draft or approved-but-unposted entry can be voided.' })
    await this.audit('quant.settlement.voided', settlementId, adminId, {})
    return { id: settlementId, status: 'voided' }
  }

  /** Step 2 (+3): the entry is confirmed (by anyone with console access, including whoever entered it); posting follows immediately. */
  async approve(settlementId: string, adminId: string, confirmLargeMove: boolean, requestId: string) {
    const settlement = await this.getSettlement(settlementId)
    if (settlement.status === 'posted') return { ...settlement, duplicate: true }
    if (settlement.status === 'draft') {
      const product = await this.quant.getProductRow(settlement.product_id)
      const large = Math.abs(Number(settlement.gross_return_pct)) > Number(product.max_daily_move_pct)
      if (large && !confirmLargeMove) throw new ConflictException({ code: 'QUANT_LARGE_MOVE_UNCONFIRMED', message: `The move exceeds the ${product.max_daily_move_pct}% daily limit; confirm it explicitly.`, limitPct: product.max_daily_move_pct })
      const updated = (await this.ds.query(
        `UPDATE app.quant_daily_settlements SET status = 'approved', approved_by = $2, approved_at = now(), large_move_confirmed = $3 WHERE id = $1 AND status = 'draft' RETURNING id`,
        [settlementId, adminId, large],
      )) as Array<{ id: string }>
      if (!updated.length) throw new ConflictException({ code: 'QUANT_STATE_CHANGED', message: 'The entry changed while approving; reload it.' })
      await this.audit('quant.settlement.approved', settlementId, adminId, { largeMoveConfirmed: large })
    } else if (settlement.status !== 'approved') {
      throw new ConflictException({ code: 'QUANT_NOT_APPROVABLE', message: `An entry in status ${settlement.status} cannot be approved.` })
    }
    return this.post(settlementId, adminId, requestId)
  }

  /** Step 3: apply an approved day. Idempotent: ledger postings carry fixed keys and the database changes land in one transaction. */
  async post(settlementId: string, adminId: string, requestId: string) {
    const settlement = await this.getSettlement(settlementId)
    if (settlement.status === 'posted') return { ...settlement, duplicate: true }
    if (settlement.status !== 'approved') throw new ConflictException({ code: 'QUANT_NOT_APPROVED', message: 'Only an approved entry can be posted.' })
    const product = await this.quant.getProductRow(settlement.product_id)
    const expected = product.last_settled_date ? addDays(product.last_settled_date, 1) : product.first_trade_date
    if (settlement.trade_date !== expected) throw new ConflictException({ code: 'QUANT_TRADE_DATE_OUT_OF_ORDER', message: `The next trade date to settle is ${expected}.` })

    const lotRows = (await this.ds.query(
      `SELECT id, user_id::text AS "userId", principal_atomic::text AS principal, effective_date::text AS "effectiveDate"
       FROM app.quant_lots WHERE product_id = $1 AND principal_atomic > 0 AND effective_date <= $2 ORDER BY effective_date, id`,
      [product.id, settlement.trade_date],
    )) as Array<{ id: string; userId: string; principal: string; effectiveDate: string }>
    const lots: QuantLot[] = lotRows.map((row) => ({ id: row.id, userId: row.userId, principal: BigInt(row.principal), effectiveDate: row.effectiveDate }))
    const requests = (await this.ds.query(
      `SELECT id, user_id::text AS "userId", amount_atomic::text AS amount FROM app.quant_orders
       WHERE product_id = $1 AND kind = 'redemption' AND status = 'pending' AND effective_date <= $2 ORDER BY created_at, id`,
      [product.id, settlement.trade_date],
    )) as Array<{ id: string; userId: string; amount: string | null }>

    // ---- plan (pure) ----
    const grossReturn = parse18(settlement.gross_return_pct) / 100n
    const mgmtDaily = dailyManagementRate(product.mgmt_fee_bps)
    const indexBefore = parse18(product.index_value)
    const step = stepIndex({ grossReturn, mgmtDaily, perfFeeBps: product.perf_fee_bps, index: indexBefore, hwm: parse18(product.hwm_index) })
    const lotDays: LotDay[] = lots.map((lot) => applyDay(lot, grossReturn, mgmtDaily, step.perfFeeRate))
    const users = aggregateByUser(lotDays)
    const afterDay = lots.map((lot, i) => ({ ...lot, principal: lotDays[i].principalAfter }))
    const redemption = planRedemptions(afterDay, requests.map((r) => ({ orderId: r.id, userId: r.userId, amount: r.amount === null ? null : BigInt(r.amount) })), settlement.trade_date, product.redemption_fee_tiers)

    // ---- ledger (idempotent) ----
    const poolSide = { pool: 0n, fee: 0n, treasury: 0n }
    for (const user of users) {
      const d = dayDeltas(user)
      if (user.net > 0n) {
        await this.ledger.postQuantLegs({
          productId: product.id, idempotencyKey: `quant_day:${settlement.id}:u:${user.userId}`, transactionType: 'quant_daily_settlement', referenceType: 'quant_daily_settlement', referenceId: settlement.id, requestId,
          legs: [{ account: { kind: 'user', userId: user.userId }, delta: d.user }, { account: { kind: 'fee' }, delta: d.fee }, { account: { kind: 'treasury' }, delta: d.treasury }],
        })
      } else {
        poolSide.pool += d.pool; poolSide.fee += d.fee; poolSide.treasury += d.treasury
      }
    }
    await this.ledger.postQuantLegs({
      productId: product.id, idempotencyKey: `quant_day:${settlement.id}:pool`, transactionType: 'quant_daily_settlement', referenceType: 'quant_daily_settlement', referenceId: settlement.id, requestId,
      legs: [{ account: { kind: 'pool' }, delta: poolSide.pool }, { account: { kind: 'fee' }, delta: poolSide.fee }, { account: { kind: 'treasury' }, delta: poolSide.treasury }],
    })
    const redemptionLedger = new Map<string, string | null>()
    for (const result of redemption.results) {
      if (result.principal <= 0n) continue
      const posted = await this.ledger.postQuantLegs({
        productId: product.id, idempotencyKey: `quant_redemption:${result.orderId}`, transactionType: 'quant_redemption', referenceType: 'quant_redemption', referenceId: result.orderId, requestId,
        legs: [{ account: { kind: 'pool' }, delta: -result.principal }, { account: { kind: 'user', userId: result.userId }, delta: result.payout }, { account: { kind: 'fee' }, delta: result.fee }],
      })
      redemptionLedger.set(result.orderId, posted.ledgerTransactionId)
    }

    // ---- database (one transaction) ----
    const sum = (pick: (u: (typeof users)[number]) => bigint) => users.reduce((total, u) => total + pick(u), 0n)
    await this.ds.transaction(async (manager) => {
      const [locked] = (await manager.query(`SELECT status FROM app.quant_daily_settlements WHERE id = $1 FOR UPDATE`, [settlement.id])) as Array<{ status: string }>
      if (locked.status === 'posted') return
      if (locked.status !== 'approved') throw new ConflictException({ code: 'QUANT_STATE_CHANGED', message: 'The entry changed while posting.' })
      for (const [i, lot] of lots.entries()) {
        const principalAfter = redemption.lotsAfter.get(lot.id) ?? lotDays[i].principalAfter
        if (principalAfter !== lot.principal) await manager.query(`UPDATE app.quant_lots SET principal_atomic = $2, updated_at = now() WHERE id = $1`, [lot.id, principalAfter.toString()])
      }
      for (const user of users) {
        await manager.query(
          `INSERT INTO app.quant_payouts (settlement_id, product_id, user_id, trade_date, principal_before_atomic, gross_atomic, mgmt_fee_atomic, perf_fee_atomic, net_atomic, paid_atomic)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (settlement_id, user_id) DO NOTHING`,
          [settlement.id, product.id, user.userId, settlement.trade_date, user.principalBefore.toString(), user.gross.toString(), user.mgmtFee.toString(), user.perfFee.toString(), user.net.toString(), user.paid.toString()],
        )
      }
      for (const result of redemption.results) {
        if (result.principal <= 0n) {
          // Principal that has not started earning yet cannot be redeemed; keep the request for the day it can.
          const [waiting] = (await manager.query(
            `SELECT 1 AS ok FROM app.quant_lots WHERE user_id = $1 AND product_id = $2 AND principal_atomic > 0 AND effective_date > $3 LIMIT 1`,
            [result.userId, product.id, settlement.trade_date],
          )) as Array<{ ok: number }>
          if (!waiting) await manager.query(`UPDATE app.quant_orders SET status = 'rejected', reject_reason = 'nothing_to_redeem', settled_at = now() WHERE id = $1`, [result.orderId])
          continue
        }
        await manager.query(
          `UPDATE app.quant_orders SET status = 'settled', principal_atomic = $2, fee_atomic = $3, payout_atomic = $4, ledger_reference = $5, settled_at = now() WHERE id = $1`,
          [result.orderId, result.principal.toString(), result.fee.toString(), result.payout.toString(), redemptionLedger.get(result.orderId) ?? null],
        )
      }
      await manager.query(
        `UPDATE app.quant_products SET index_value = $2, hwm_index = $3, last_settled_date = $4, updated_at = now() WHERE id = $1`,
        [product.id, format18(step.indexAfter), format18(step.hwmAfter), settlement.trade_date],
      )
      await manager.query(
        `UPDATE app.quant_daily_settlements SET status = 'posted', posted_at = now(), index_before = $2, index_after = $3, hwm_after = $4, net_return_pct = $5, users_count = $6,
                principal_atomic = $7, gross_atomic = $8, mgmt_fee_atomic = $9, perf_fee_atomic = $10, paid_atomic = $11, principal_loss_atomic = $12,
                redemption_principal_atomic = $13, redemption_fee_atomic = $14 WHERE id = $1`,
        [
          settlement.id, format18(indexBefore), format18(step.indexAfter), format18(step.hwmAfter), format18(step.netReturn * 100n), users.length,
          sum((u) => u.principalBefore).toString(), sum((u) => u.gross).toString(), sum((u) => u.mgmtFee).toString(), sum((u) => u.perfFee).toString(), sum((u) => u.paid).toString(),
          sum((u) => u.principalLoss).toString(), redemption.results.reduce((t, r) => t + r.principal, 0n).toString(), redemption.results.reduce((t, r) => t + r.fee, 0n).toString(),
        ],
      )
      await manager.query(
        `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata) VALUES ($1, 'admin', $2, 'quant.settlement.posted', 'quant_settlement', $3, $4, $5)`,
        [randomUUID(), adminId, settlement.id, requestId, JSON.stringify({ productId: product.id, tradeDate: settlement.trade_date, users: users.length, redemptions: redemption.results.length })],
      )
    })
    this.log.log(`quant settlement ${settlement.id} posted for ${settlement.trade_date}: ${users.length} users, ${redemption.results.length} redemptions`)
    return { ...(await this.getSettlement(settlement.id)), duplicate: false }
  }

  /** Quant risk disclosures, newest first. The newest one is what a user must acknowledge before subscribing. */
  async listDisclosures() {
    return this.ds.query(
      `SELECT d.id, d.version, d.title, d.content, d.effective_from AS "effectiveFrom",
              (SELECT COUNT(*)::int FROM app.user_risk_acknowledgements a WHERE a.disclosure_id = d.id) AS "acknowledgements"
       FROM app.risk_disclosures d WHERE d.product_type = 'quant' AND d.strategy_id IS NULL ORDER BY d.version DESC LIMIT 20`,
    )
  }

  /** Publishes a new version. Everyone must acknowledge it again before their next subscription. */
  async createDisclosure(input: { title: string; content: string }, adminId: string) {
    const [row] = (await this.ds.query(
      `INSERT INTO app.risk_disclosures (product_type, strategy_id, version, title, content)
       SELECT 'quant', NULL, COALESCE(MAX(version), 0) + 1, $1, $2 FROM app.risk_disclosures WHERE product_type = 'quant' AND strategy_id IS NULL
       RETURNING id, version, title, effective_from AS "effectiveFrom"`,
      [input.title.trim(), input.content.trim()],
    )) as Array<{ id: string; version: number; title: string; effectiveFrom: string }>
    await this.audit('quant.disclosure.published', row.id, adminId, { version: row.version, title: row.title })
    return row
  }

  private async getSettlement(id: string): Promise<SettlementRow> {
    const [row] = (await this.ds.query(`SELECT ${SETTLEMENT_COLUMNS} FROM app.quant_daily_settlements WHERE id = $1`, [id])) as SettlementRow[]
    if (!row) throw new NotFoundException({ code: 'QUANT_SETTLEMENT_NOT_FOUND', message: 'Settlement entry was not found.' })
    return row
  }

  private async audit(action: string, objectId: string, adminId: string, metadata: Record<string, unknown>) {
    await this.ds.query(
      `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata) VALUES ($1, 'admin', $2, $3, 'quant_settlement', $4, $5, $6)`,
      [randomUUID(), adminId, action, objectId, `quant-${objectId}`, JSON.stringify(metadata)],
    )
  }
}

