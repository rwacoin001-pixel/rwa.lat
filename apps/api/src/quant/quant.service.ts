import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { recordReferralRewards } from '../referral/referral-rewards'
import { enqueueReferralPurchase } from '../referral/referral-purchase'
import { LedgerService } from '../ledger/ledger.service'
import { OperationalCapabilityService, OPERATIONAL_SWITCH_KEYS } from '../operations/operational-capability.service'
import { ComplianceService } from '../compliance/compliance.service'
import { addDays, localDateAndMinutes, orderTradeDate } from './quant.dates'
import { isInsufficientLedgerBalance } from '../basket/basket.constants'
import { planRedemptions, type FeeTier } from './quant.math'
import { maxDrawdownPct, windowReturn, type IndexPoint } from './quant.performance'

export const QUANT_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'QUANT_PRODUCT_NOT_FOUND',
  PRODUCT_NOT_OPEN: 'QUANT_PRODUCT_NOT_OPEN',
  AMOUNT_INVALID: 'QUANT_AMOUNT_INVALID',
  INSUFFICIENT_BALANCE: 'QUANT_INSUFFICIENT_BALANCE',
  NOTHING_TO_REDEEM: 'QUANT_NOTHING_TO_REDEEM',
  REDEMPTION_PENDING: 'QUANT_REDEMPTION_PENDING',
  DISCLOSURE_ACK_REQUIRED: 'QUANT_DISCLOSURE_ACK_REQUIRED',
} as const

const USDT_DECIMALS = 6
const AMOUNT_PATTERN = /^\d{1,30}(\.\d{1,6})?$/

export const OPEN_STATUSES = ['pilot', 'active']

export function parseUsdt(value: string): bigint {
  if (!AMOUNT_PATTERN.test(value)) throw new BadRequestException({ code: QUANT_ERROR_CODES.AMOUNT_INVALID, message: 'Amount must be a positive decimal with up to 6 places.' })
  const [whole, fraction = ''] = value.split('.')
  const atomic = BigInt(whole) * 10n ** BigInt(USDT_DECIMALS) + BigInt((fraction + '000000').slice(0, USDT_DECIMALS))
  if (atomic <= 0n) throw new BadRequestException({ code: QUANT_ERROR_CODES.AMOUNT_INVALID, message: 'Amount must be greater than zero.' })
  return atomic
}

export type QuantProductRow = {
  id: string; slug: string; name: string; summary: string | null; status: string; timezone: string; cutoff_time: string
  mgmt_fee_bps: number; perf_fee_bps: number; redemption_fee_tiers: FeeTier[]
  min_subscription_atomic: string; min_redemption_atomic: string; max_daily_move_pct: string
  target_annual_min_pct: string | null; target_annual_max_pct: string | null
  index_value: string; hwm_index: string; first_trade_date: string | null; last_settled_date: string | null
}

/**
 * Koala Quant, user side: product pages, subscribe, redeem, positions and the day-by-day payout history.
 * Money rules live in quant.math.ts and quant-settlement.service.ts; this service only moves a user's own funds in
 * (subscription) and queues a redemption, both idempotent and gated by the quant.* operator switches.
 */
@Injectable()
export class QuantService {
  private readonly log = new Logger(QuantService.name)

  constructor(
    private readonly ds: DataSource,
    private readonly ledger: LedgerService,
    private readonly operations: OperationalCapabilityService,
    private readonly compliance: ComplianceService,
  ) {}

  async getProductRow(slugOrId: string): Promise<QuantProductRow> {
    const isId = /^[0-9a-f-]{36}$/i.test(slugOrId)
    const [row] = (await this.ds.query(
      `SELECT id, slug, name, summary, status, timezone, to_char(cutoff_time, 'HH24:MI') AS cutoff_time, mgmt_fee_bps, perf_fee_bps, redemption_fee_tiers,
              trim_scale(min_subscription_atomic)::text AS min_subscription_atomic, trim_scale(min_redemption_atomic)::text AS min_redemption_atomic,
              trim_scale(max_daily_move_pct)::text AS max_daily_move_pct, trim_scale(target_annual_min_pct)::text AS target_annual_min_pct,
              trim_scale(target_annual_max_pct)::text AS target_annual_max_pct, trim_scale(index_value)::text AS index_value, trim_scale(hwm_index)::text AS hwm_index,
              first_trade_date::text AS first_trade_date, last_settled_date::text AS last_settled_date
       FROM app.quant_products WHERE ${isId ? 'id = $1::uuid' : 'slug = $1'}`,
      [slugOrId],
    )) as QuantProductRow[]
    if (!row) throw new NotFoundException({ code: QUANT_ERROR_CODES.PRODUCT_NOT_FOUND, message: 'Quant product was not found.' })
    return row
  }

  /** Public product list: only products an operator has opened. */
  async listProducts() {
    const rows = (await this.ds.query(`SELECT slug FROM app.quant_products WHERE status IN ('pilot', 'active', 'paused') ORDER BY created_at`)) as Array<{ slug: string }>
    return Promise.all(rows.map((row) => this.getProduct(row.slug)))
  }

  async getProduct(slug: string, userId?: string) {
    const product = await this.getProductRow(slug)
    if (!['pilot', 'active', 'paused', 'closed'].includes(product.status)) {
      throw new NotFoundException({ code: QUANT_ERROR_CODES.PRODUCT_NOT_FOUND, message: 'Quant product was not found.' })
    }
    const history = (await this.ds.query(
      `SELECT trade_date::text AS "tradeDate", trim_scale(gross_return_pct)::text AS "grossReturnPct", trim_scale(net_return_pct)::text AS "netReturnPct",
              trim_scale(index_after)::text AS "indexAfter"
       FROM app.quant_daily_settlements WHERE product_id = $1 AND status = 'posted' ORDER BY trade_date DESC LIMIT 365`,
      [product.id],
    )) as Array<{ tradeDate: string; grossReturnPct: string; netReturnPct: string; indexAfter: string }>
    const series = [...history].reverse()
    // Performance comes from every settled day (not the 365-day chart window), so drawdown and windows stay honest over time.
    const points = ((await this.ds.query(
      `SELECT trade_date::text AS "tradeDate", index_after::float8 AS "indexAfter" FROM app.quant_daily_settlements WHERE product_id = $1 AND status = 'posted' ORDER BY trade_date`,
      [product.id],
    )) as IndexPoint[])
    const index = Number(product.index_value)
    const disclosure = await this.latestDisclosure()
    const view = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      summary: product.summary,
      status: product.status,
      open: OPEN_STATUSES.includes(product.status),
      cutoffTime: product.cutoff_time,
      timezone: product.timezone,
      fees: { managementBps: product.mgmt_fee_bps, performanceBps: product.perf_fee_bps, redemptionTiers: product.redemption_fee_tiers },
      minSubscriptionAtomic: product.min_subscription_atomic,
      minRedemptionAtomic: product.min_redemption_atomic,
      /** A target range set by the operator, never a promise; shown next to the real figures below. */
      target: product.target_annual_min_pct !== null && product.target_annual_max_pct !== null ? { annualMinPct: product.target_annual_min_pct, annualMaxPct: product.target_annual_max_pct } : null,
      performance: {
        index: product.index_value,
        /** Index after management fees; the performance fee is charged per user at payout, so a user's net payout is on the day receipt. */
        indexNetOf: 'management_fee',
        sinceInceptionPct: points.length ? (index - 1) * 100 : null,
        last7d: windowReturn(points, 7),
        last30d: windowReturn(points, 30),
        maxDrawdownPct: maxDrawdownPct(points),
        lastSettledDate: product.last_settled_date,
        days: points.length,
      },
      history: series,
      disclosureId: disclosure?.id ?? null,
    }
    return userId ? { ...view, position: await this.getPosition(userId, product.id) } : view
  }

  /** When a subscription placed right now starts earning, so the app can show real dates instead of "next day". */
  async previewSubscription(slug: string) {
    const product = await this.getProductRow(slug)
    const now = new Date()
    const tradeDate = orderTradeDate(now, product.timezone, product.cutoff_time)
    const local = localDateAndMinutes(now, product.timezone)
    return { tradeDate, effectiveDate: addDays(tradeDate, 1), firstSettlementDate: addDays(tradeDate, 1), cutoffTime: product.cutoff_time, timezone: product.timezone, afterCutoff: tradeDate > local.date, localDate: local.date }
  }

  /**
   * What redeeming now would pay, from the user's current lots (oldest first, fee by days held). It is an estimate: the real
   * amount is fixed at the end of the trade date, after that day's result is applied to the principal.
   */
  async previewRedemption(userId: string, slug: string, input: { amountUsd?: string; all?: boolean }) {
    const product = await this.getProductRow(slug)
    const tradeDate = orderTradeDate(new Date(), product.timezone, product.cutoff_time)
    const lots = (await this.ds.query(
      `SELECT id, principal_atomic::text AS principal, effective_date::text AS "effectiveDate" FROM app.quant_lots WHERE user_id = $1 AND product_id = $2 AND principal_atomic > 0 ORDER BY effective_date, id`,
      [userId, product.id],
    )) as Array<{ id: string; principal: string; effectiveDate: string }>
    const total = lots.reduce((sum, lot) => sum + BigInt(lot.principal), 0n)
    const redeemable = lots.filter((lot) => lot.effectiveDate <= tradeDate)
    const redeemableTotal = redeemable.reduce((sum, lot) => sum + BigInt(lot.principal), 0n)
    const amount = input.all || !input.amountUsd ? null : parseUsdt(input.amountUsd)
    const plan = planRedemptions(redeemable.map((lot) => ({ id: lot.id, userId, principal: BigInt(lot.principal), effectiveDate: lot.effectiveDate })), [{ orderId: 'preview', userId, amount }], tradeDate, product.redemption_fee_tiers)
    const result = plan.results[0]
    return {
      tradeDate,
      estimate: true,
      principalAtomic: total.toString(),
      redeemableAtomic: redeemableTotal.toString(),
      waitingAtomic: (total - redeemableTotal).toString(),
      redeemAtomic: result.principal.toString(),
      feeAtomic: result.fee.toString(),
      payoutAtomic: result.payout.toString(),
      minRedemptionAtomic: product.min_redemption_atomic,
    }
  }

  async getPosition(userId: string, productId: string) {
    const [lots] = (await this.ds.query(
      `SELECT COALESCE(SUM(principal_atomic), 0)::text AS principal, COALESCE(SUM(original_atomic), 0)::text AS invested,
              COALESCE(SUM(principal_atomic) FILTER (WHERE effective_date > (SELECT COALESCE(last_settled_date, first_trade_date - 1) FROM app.quant_products WHERE id = $2) + 1), 0)::text AS waiting
       FROM app.quant_lots WHERE user_id = $1 AND product_id = $2 AND principal_atomic > 0`,
      [userId, productId],
    )) as Array<{ principal: string; invested: string; waiting: string }>
    const [paid] = (await this.ds.query(
      `SELECT COALESCE(SUM(paid_atomic), 0)::text AS "totalPaid", COALESCE(SUM(net_atomic), 0)::text AS "totalNet",
              COALESCE(SUM(mgmt_fee_atomic + perf_fee_atomic), 0)::text AS "totalFees"
       FROM app.quant_payouts WHERE user_id = $1 AND product_id = $2`,
      [userId, productId],
    )) as Array<{ totalPaid: string; totalNet: string; totalFees: string }>
    const [last] = (await this.ds.query(
      `SELECT trade_date::text AS "tradeDate", net_atomic::text AS "netAtomic", paid_atomic::text AS "paidAtomic"
       FROM app.quant_payouts WHERE user_id = $1 AND product_id = $2 ORDER BY trade_date DESC LIMIT 1`,
      [userId, productId],
    )) as Array<{ tradeDate: string; netAtomic: string; paidAtomic: string }>
    const pending = (await this.ds.query(
      `SELECT id, kind, status, trim_scale(amount_atomic)::text AS "amountAtomic", effective_date::text AS "effectiveDate", created_at AS "createdAt"
       FROM app.quant_orders WHERE user_id = $1 AND product_id = $2 AND status IN ('pending', 'accepted') ORDER BY created_at DESC LIMIT 10`,
      [userId, productId],
    )) as Array<Record<string, unknown>>
    return { principalAtomic: lots.principal, investedAtomic: lots.invested, waitingAtomic: lots.waiting, totalPaidAtomic: paid.totalPaid, totalNetAtomic: paid.totalNet, totalFeesAtomic: paid.totalFees, lastDay: last ?? null, pendingOrders: pending }
  }

  async listMyPositions(userId: string) {
    const rows = (await this.ds.query(
      `SELECT DISTINCT p.id, p.slug FROM app.quant_products p JOIN app.quant_lots l ON l.product_id = p.id WHERE l.user_id = $1 AND l.principal_atomic > 0`,
      [userId],
    )) as Array<{ id: string; slug: string }>
    return Promise.all(rows.map(async (row) => ({ slug: row.slug, ...(await this.getPosition(userId, row.id)) })))
  }

  async listMyPayouts(userId: string, slug: string, limit = 30) {
    const product = await this.getProductRow(slug)
    return this.ds.query(
      `SELECT trade_date::text AS "tradeDate", principal_before_atomic::text AS "principalBeforeAtomic", gross_atomic::text AS "grossAtomic",
              mgmt_fee_atomic::text AS "managementFeeAtomic", perf_fee_atomic::text AS "performanceFeeAtomic", net_atomic::text AS "netAtomic", paid_atomic::text AS "paidAtomic"
       FROM app.quant_payouts WHERE user_id = $1 AND product_id = $2 ORDER BY trade_date DESC LIMIT $3`,
      [userId, product.id, Math.min(Math.max(limit, 1), 200)],
    )
  }

  async listMyOrders(userId: string, limit = 30) {
    return this.ds.query(
      `SELECT o.id, p.slug, o.kind, o.status, trim_scale(o.amount_atomic)::text AS "amountAtomic", trim_scale(o.principal_atomic)::text AS "principalAtomic",
              trim_scale(o.fee_atomic)::text AS "feeAtomic", trim_scale(o.payout_atomic)::text AS "payoutAtomic", o.effective_date::text AS "effectiveDate",
              o.reject_reason AS "rejectReason", o.created_at AS "createdAt", o.settled_at AS "settledAt"
       FROM app.quant_orders o JOIN app.quant_products p ON p.id = o.product_id WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    )
  }

  async latestDisclosure() {
    const [row] = (await this.ds.query(
      `SELECT id, version, title, content, effective_from AS "effectiveFrom" FROM app.risk_disclosures
       WHERE product_type = 'quant' AND strategy_id IS NULL ORDER BY version DESC, effective_from DESC, id DESC LIMIT 1`,
    )) as Array<{ id: string; version: number; title: string; content: string; effectiveFrom: string }>
    return row ?? null
  }

  private async assertDisclosureAcknowledged(userId: string) {
    const latest = await this.latestDisclosure()
    if (!latest) return
    const [ack] = (await this.ds.query(`SELECT 1 AS ok FROM app.user_risk_acknowledgements WHERE user_id = $1 AND disclosure_id = $2`, [userId, latest.id])) as Array<{ ok: number }>
    if (!ack) throw new ConflictException({ code: QUANT_ERROR_CODES.DISCLOSURE_ACK_REQUIRED, message: 'You must acknowledge the latest risk disclosure first.', disclosureId: latest.id })
  }

  private async findOrderByKey(userId: string, key: string) {
    const [row] = (await this.ds.query(
      `SELECT id, kind, status, trim_scale(amount_atomic)::text AS "amountAtomic", effective_date::text AS "effectiveDate" FROM app.quant_orders WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, key],
    )) as Array<Record<string, unknown>>
    return row ?? null
  }

  async subscribe(userId: string, slug: string, amountUsd: string, idempotencyKey: string, requestId: string) {
    const amount = parseUsdt(amountUsd)
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.quantSubscriptions, 'Koala Quant subscriptions are currently closed.')
    const existing = await this.findOrderByKey(userId, idempotencyKey)
    if (existing) return { duplicate: true, order: existing }

    const product = await this.getProductRow(slug)
    if (!OPEN_STATUSES.includes(product.status)) throw new ConflictException({ code: QUANT_ERROR_CODES.PRODUCT_NOT_OPEN, message: 'This product is not open for subscriptions.' })
    if (amount < BigInt(product.min_subscription_atomic)) throw new BadRequestException({ code: QUANT_ERROR_CODES.AMOUNT_INVALID, message: 'Amount is below the minimum subscription.' })
    await this.compliance.requireInvestmentEligibility(userId, 'basket')
    await this.assertDisclosureAcknowledged(userId)

    // A subscription starts earning the day after its trade date, so nobody can buy in knowing the day's result.
    const tradeDate = orderTradeDate(new Date(), product.timezone, product.cutoff_time)
    const effectiveDate = addDays(tradeDate, 1)
    const orderId = randomUUID()
    const inserted = (await this.ds.query(
      `INSERT INTO app.quant_orders (id, product_id, user_id, kind, amount_atomic, status, effective_date, idempotency_key)
       VALUES ($1, $2, $3, 'subscription', $4, 'pending', $5, $6) ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id`,
      [orderId, product.id, userId, amount.toString(), effectiveDate, idempotencyKey],
    )) as Array<{ id: string }>
    if (!inserted.length) return { duplicate: true, order: await this.findOrderByKey(userId, idempotencyKey) }

    let transfer: { ledgerTransactionId: string | null }
    try {
      transfer = await this.ledger.postQuantLegs({
        productId: product.id,
        idempotencyKey: `quant_subscription:${orderId}`,
        transactionType: 'quant_subscription',
        referenceType: 'quant_subscription',
        referenceId: orderId,
        requestId,
        legs: [{ account: { kind: 'user', userId }, delta: -amount }, { account: { kind: 'pool' }, delta: amount }],
      })
    } catch (error) {
      await this.ds.query(`UPDATE app.quant_orders SET status = 'rejected', reject_reason = 'ledger_rejected', settled_at = now() WHERE id = $1 AND status = 'pending'`, [orderId])
      if (isInsufficientLedgerBalance(error)) {
        throw new ConflictException({ code: QUANT_ERROR_CODES.INSUFFICIENT_BALANCE, message: 'Insufficient available balance for this subscription.' })
      }
      throw error
    }

    await this.ds.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO app.quant_lots (product_id, user_id, order_id, original_atomic, principal_atomic, effective_date) VALUES ($1, $2, $3, $4, $4, $5)`,
        [product.id, userId, orderId, amount.toString(), effectiveDate],
      )
      await manager.query(`UPDATE app.quant_orders SET status = 'settled', principal_atomic = $2, ledger_reference = $3, settled_at = now() WHERE id = $1`, [orderId, amount.toString(), transfer.ledgerTransactionId])
      await recordReferralRewards(manager, { kind: 'purchase', sourceType: 'quant_subscription', sourceId: orderId, sourceUserId: userId, baseAtomic: amount })
      await manager.query(
        `INSERT INTO app.audit_logs (id, actor_type, user_id, action, object_type, object_id, request_id, metadata) VALUES ($1, 'service', $2, 'quant.subscription.settled', 'quant_order', $3, $4, $5)`,
        [randomUUID(), userId, orderId, requestId, JSON.stringify({ productId: product.id, amountAtomic: amount.toString(), effectiveDate })],
      )
    })
    enqueueReferralPurchase(this.ds, 'quant', orderId)
    return { duplicate: false, order: await this.findOrderByKey(userId, idempotencyKey) }
  }

  async redeem(userId: string, slug: string, input: { amountUsd?: string; all?: boolean }, idempotencyKey: string, requestId: string) {
    if (!input.all && !input.amountUsd) throw new BadRequestException({ code: QUANT_ERROR_CODES.AMOUNT_INVALID, message: 'Send an amount or all: true.' })
    const amount = input.all ? null : parseUsdt(input.amountUsd as string)
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.quantRedemptions, 'Koala Quant redemptions are currently closed.')
    const existing = await this.findOrderByKey(userId, idempotencyKey)
    if (existing) return { duplicate: true, order: existing }

    const product = await this.getProductRow(slug)
    if (!['pilot', 'active', 'paused'].includes(product.status)) throw new ConflictException({ code: QUANT_ERROR_CODES.PRODUCT_NOT_OPEN, message: 'This product is not open for redemptions.' })
    if (amount !== null && amount < BigInt(product.min_redemption_atomic)) throw new BadRequestException({ code: QUANT_ERROR_CODES.AMOUNT_INVALID, message: 'Amount is below the minimum redemption.' })

    const [held] = (await this.ds.query(`SELECT COALESCE(SUM(principal_atomic), 0)::text AS principal FROM app.quant_lots WHERE user_id = $1 AND product_id = $2 AND principal_atomic > 0`, [userId, product.id])) as Array<{ principal: string }>
    if (BigInt(held.principal) <= 0n) throw new ConflictException({ code: QUANT_ERROR_CODES.NOTHING_TO_REDEEM, message: 'You hold no principal in this product.' })
    const [pending] = (await this.ds.query(`SELECT 1 AS ok FROM app.quant_orders WHERE user_id = $1 AND product_id = $2 AND kind = 'redemption' AND status = 'pending'`, [userId, product.id])) as Array<{ ok: number }>
    if (pending) throw new ConflictException({ code: QUANT_ERROR_CODES.REDEMPTION_PENDING, message: 'You already have a redemption waiting for the next settlement.' })

    // A redemption settles at the end of its trade date, after that day's result has been applied to the principal.
    const tradeDate = orderTradeDate(new Date(), product.timezone, product.cutoff_time)
    const orderId = randomUUID()
    const inserted = (await this.ds.query(
      `INSERT INTO app.quant_orders (id, product_id, user_id, kind, amount_atomic, status, effective_date, idempotency_key)
       VALUES ($1, $2, $3, 'redemption', $4, 'pending', $5, $6) ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id`,
      [orderId, product.id, userId, amount === null ? null : amount.toString(), tradeDate, idempotencyKey],
    )) as Array<{ id: string }>
    if (!inserted.length) return { duplicate: true, order: await this.findOrderByKey(userId, idempotencyKey) }
    await this.ds.query(
      `INSERT INTO app.audit_logs (id, actor_type, user_id, action, object_type, object_id, request_id, metadata) VALUES ($1, 'service', $2, 'quant.redemption.queued', 'quant_order', $3, $4, $5)`,
      [randomUUID(), userId, orderId, requestId, JSON.stringify({ productId: product.id, all: amount === null, amountAtomic: amount?.toString() ?? null, effectiveDate: tradeDate })],
    )
    this.log.log(`redemption queued ${orderId} for trade date ${tradeDate}`)
    return { duplicate: false, order: await this.findOrderByKey(userId, idempotencyKey) }
  }
}
