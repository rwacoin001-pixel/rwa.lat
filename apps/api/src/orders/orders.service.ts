import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { CatalogService } from '../catalog/catalog.service'
import { ComplianceService } from '../compliance/compliance.service'
import { NotificationService } from '../notification/notification.service'
import { OperationalCapabilityService, OPERATIONAL_SWITCH_KEYS } from '../operations/operational-capability.service'
import { recordReferralRewards } from '../referral/referral-rewards'
import { enqueueReferralPurchase } from '../referral/referral-purchase'
import {
  calculateProductQuantityAtomic,
  calculateSettlementPayoutAtomic,
  isUsdUsdtEquivalent,
  SETTLEMENT_ASSET_DECIMALS,
} from '../financial/amounts'

type OrderState = 'submitted' | 'processing' | 'filled' | 'partially_filled' | 'failed'
type OutcomeKey = 'long' | 'yes' | 'no'
interface OrderRow {
  id: string
  user_id: string
  product_id: string
  outcome_key: OutcomeKey
  side: 'buy' | 'sell'
  requested_atomic_amount: string
  filled_atomic_amount: string
  filled_quantity_atomic_amount: string
  unit_price_atomic_amount: string
  settlement_asset_code: string
  settlement_asset_decimals: number
  product_asset_code: string
  product_asset_decimals: number
  quote_currency: string | null
  quote_decimals: number
  state: OrderState
  failure_reason: string | null
  submitted_at: Date
  completed_at: Date | null
  asset_class_id?: string
  display_name?: string
}

@Injectable()
export class OrdersService {
  private readonly demoOperationsEnabled: boolean

  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly compliance: ComplianceService,
    private readonly notifications: NotificationService,
    private readonly operations: OperationalCapabilityService,
    config: ConfigService,
  ) {
    this.demoOperationsEnabled = config.get<string>('APP_ENV') !== 'production'
      && config.get<string>('DEMO_OPERATIONS_ENABLED') === 'true'
  }

  async create(userId: string, dto: { productId: string; atomicAmount: string; outcomeKey?: OutcomeKey }, idempotencyKey: string, requestId: string, expectedQuote?: {unitPriceAtomicAmount: string;unitPriceDecimals: number;currency: string;validUntil: Date;minimumRemainingAtomic?: string}) {
    await this.operations.assertEnabled(
      OPERATIONAL_SWITCH_KEYS.orders,
      'New order acceptance is currently paused by the operator.',
    )
    this.assertIdempotencyKey(idempotencyKey)
    const outcomeKey = dto.outcomeKey ?? 'long'
    const existingRows = await this.dataSource.query(
      `SELECT id, product_id, requested_atomic_amount::text AS requested_atomic_amount, outcome_key
       FROM app.orders WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey],
    ) as Array<{ id: string; product_id: string; requested_atomic_amount: string; outcome_key: OutcomeKey }>
    if (existingRows[0]) {
      this.assertOrderIntentMatches(existingRows[0], dto, outcomeKey)
      return { ...(await this.getForUser(existingRows[0].id, userId)), created: false }
    }
    const product = await this.catalog.getProduct(dto.productId)
    const quote = await this.catalog.requireOrderableQuote(dto.productId)
    if (expectedQuote && (quote.unitPriceAtomicAmount !== expectedQuote.unitPriceAtomicAmount || quote.unitPriceDecimals !== expectedQuote.unitPriceDecimals || quote.currency !== expectedQuote.currency || expectedQuote.validUntil.getTime() <= Date.now())) {
      throw new ConflictException({ code: 'AI_ORDER_QUOTE_CHANGED', message: 'The authorized execution quote changed; revalidation is required.' })
    }
    if (!isUsdUsdtEquivalent(quote.currency)) {
      throw new BadRequestException({ code: 'ORDER_QUOTE_CURRENCY_UNSUPPORTED', message: 'Order quotes currently support USD or USDT at a 1:1 settlement rate.' })
    }
    if (product.minOrderAtomicAmount && BigInt(dto.atomicAmount) < BigInt(product.minOrderAtomicAmount)) {
      throw new BadRequestException({ code: 'ORDER_BELOW_MINIMUM', message: 'Order amount is below the product minimum.' })
    }
    if (product.maxOrderAtomicAmount && BigInt(dto.atomicAmount) > BigInt(product.maxOrderAtomicAmount)) {
      throw new BadRequestException({ code: 'ORDER_ABOVE_MAXIMUM', message: 'Order amount is above the product maximum.' })
    }
    const eligibility = await this.compliance.evaluateEligibility(userId, product.assetClassId)
    if (eligibility.decision !== 'eligible') {
      throw new ForbiddenException({ code: 'ORDER_NOT_ELIGIBLE', message: 'The current user is not eligible for this product.', decision: eligibility.decision, reasonCodes: eligibility.reasonCodes })
    }
    if (product.assetClassId !== 'prediction' && outcomeKey !== 'long') {
      throw new BadRequestException({ code: 'ORDER_OUTCOME_INVALID', message: 'Only prediction orders can select YES or NO.' })
    }
    if (product.assetClassId === 'prediction' && outcomeKey === 'long') {
      throw new BadRequestException({ code: 'ORDER_OUTCOME_REQUIRED', message: 'Prediction orders must select YES or NO.' })
    }
    const quantity = calculateProductQuantityAtomic(
      BigInt(dto.atomicAmount),
      SETTLEMENT_ASSET_DECIMALS,
      product.assetDecimals,
      quote.unitPriceDecimals,
      BigInt(quote.unitPriceAtomicAmount),
    )
    if (quantity <= 0n) {
      throw new BadRequestException({ code: 'ORDER_QUANTITY_ZERO', message: 'Order amount cannot purchase a non-zero quantity at the current quote.' })
    }
    const id = randomUUID()
    const created = await this.transaction(async (runner) => {
      if (expectedQuote && expectedQuote.validUntil.getTime() <= Date.now()) throw new ConflictException('The execution quote expired before submission')
      if (expectedQuote) {
        const [current] = await runner.query(`SELECT state,asset_code,asset_decimals FROM app.products WHERE id=$1 FOR SHARE`, [dto.productId])
        if (current?.state !== 'published' || current.asset_code !== product.assetCode || current.asset_decimals !== product.assetDecimals) throw new ConflictException('The executable product terms changed')
      }
      const inserted = await runner.query(
        `INSERT INTO app.orders
          (id, user_id, product_id, side, outcome_key, requested_atomic_amount, unit_price_atomic_amount,
           product_asset_code, product_asset_decimals, quote_currency, quote_decimals,
           state, idempotency_key, request_id)
         VALUES ($1, $2, $3, 'buy', $4, $5, $6, $7, $8, $9, $10, 'submitted', $11, $12)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [id, userId, dto.productId, outcomeKey, dto.atomicAmount, quote.unitPriceAtomicAmount,
          product.assetCode, product.assetDecimals, quote.currency, quote.unitPriceDecimals, idempotencyKey, requestId],
      ) as Array<{ id: string }>
      if (!inserted[0]) {
        const [existing] = await runner.query(
          `SELECT id, product_id, requested_atomic_amount::text AS requested_atomic_amount, outcome_key
           FROM app.orders WHERE user_id = $1 AND idempotency_key = $2`,
          [userId, idempotencyKey],
        ) as Array<{ id: string; product_id: string; requested_atomic_amount: string; outcome_key: OutcomeKey }>
        if (!existing) throw new ConflictException({ code: 'ORDER_IDEMPOTENCY_RETRY', message: 'The order request is still being processed. Retry with the same idempotency key.' })
        this.assertOrderIntentMatches(existing, dto, outcomeKey)
        return { id: existing.id, created: false }
      }
      const available = await this.ensureUserUsdtAccount(runner, userId, 'available')
      const locked = await this.ensureUserUsdtAccount(runner, userId, 'locked')
      if (expectedQuote?.minimumRemainingAtomic !== undefined) {
        const [balance] = await runner.query(`SELECT current_atomic_balance::text AS amount FROM app.ledger_account_balances WHERE account_id=$1 FOR UPDATE`, [available])
        if (BigInt(balance?.amount ?? '0') < BigInt(dto.atomicAmount) + BigInt(expectedQuote.minimumRemainingAtomic)) throw new ConflictException('The order would breach the authorized cash reserve')
      }
      const orderId = inserted[0].id
      const transactionId = await this.createLedgerTransaction(runner, 'order_lock', `order-lock:${orderId}`, requestId, 'order', orderId, 'user', userId)
      await runner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
        [transactionId, available, locked, dto.atomicAmount],
      )
      await this.event(runner, orderId, null, 'submitted', 'user', userId, undefined, { atomicAmount: dto.atomicAmount })
      return { id: orderId, created: true }
    })
    const view = await this.getForUser(created.id, userId)
    if (created.created) await this.notify(userId, 'order.submitted', 'Order submitted', `Order ${view.id} is awaiting execution.`, { orderId: view.id })
    return { ...view, created: created.created }
  }

  async listForUser(userId: string) {
    const rows = await this.dataSource.query(
        `SELECT o.*, p.asset_class_id, p.display_name
       FROM app.orders o JOIN app.products p ON p.id = o.product_id
       WHERE o.user_id = $1 ORDER BY o.submitted_at DESC`,
      [userId],
    ) as OrderRow[]
    return Promise.all(rows.map((row) => this.toView(row)))
  }

  async getForUser(id: string, userId: string) {
    const rows = await this.dataSource.query(
        `SELECT o.*, p.asset_class_id, p.display_name
       FROM app.orders o JOIN app.products p ON p.id = o.product_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, userId],
    ) as OrderRow[]
    if (!rows[0]) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' })
    return this.toView(rows[0])
  }

  async listForAdmin() {
    this.assertDemoOperations()
    const rows = await this.dataSource.query(
        `SELECT o.*, p.asset_class_id, p.display_name
       FROM app.orders o JOIN app.products p ON p.id = o.product_id
       ORDER BY o.submitted_at DESC`,
    ) as OrderRow[]
    return Promise.all(rows.map((row) => this.toView(row)))
  }

  async advance(id: string, input: { state: 'filled' | 'partially_filled' | 'failed'; filledAtomicAmount?: string; reasonCode?: string }, requestId: string) {
    this.assertDemoOperations()
    const result = await this.transaction(async (runner) => {
      const rows = await runner.query(
        `SELECT o.*, p.asset_class_id, p.display_name
         FROM app.orders o JOIN app.products p ON p.id = o.product_id
         WHERE o.id = $1 FOR UPDATE`,
        [id],
      ) as OrderRow[]
      const order = rows[0]
      if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' })
      if (order.state !== 'submitted' && order.state !== 'processing') {
        throw new ConflictException({ code: 'ORDER_STATE_INVALID', message: `Order cannot be advanced from ${order.state}.` })
      }
      const requested = BigInt(order.requested_atomic_amount)
      const filled = input.state === 'filled'
        ? requested
        : input.state === 'partially_filled'
          ? BigInt(input.filledAtomicAmount ?? (requested / 2n).toString())
          : 0n
      if (filled > requested || (input.state === 'partially_filled' && filled <= 0n)) {
        throw new BadRequestException({ code: 'ORDER_FILL_INVALID', message: 'Filled amount is invalid for this order.' })
      }
      const filledQuantity = filled > 0n
        ? calculateProductQuantityAtomic(
          filled,
          order.settlement_asset_decimals,
          order.product_asset_decimals,
          order.quote_decimals,
          BigInt(order.unit_price_atomic_amount),
        )
        : 0n
      if (filled > 0n && filledQuantity <= 0n) {
        throw new BadRequestException({ code: 'ORDER_FILL_QUANTITY_ZERO', message: 'The partial fill is too small to produce a non-zero product quantity.' })
      }
      const locked = await this.ensureUserUsdtAccount(runner, order.user_id, 'locked')
      const available = await this.ensureUserUsdtAccount(runner, order.user_id, 'available')
      if (filled > 0n) {
        const settlement = await this.ensurePlatformUsdtAccount(runner, `order:${order.product_id}`, 'settlement', 'credit')
        const transactionId = await this.createLedgerTransaction(runner, 'investment', `investment:${order.id}`, requestId, 'order', order.id, 'admin', null)
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, locked, settlement, filled.toString()],
        )
        const changed = await runner.query(
          `INSERT INTO app.positions
            (user_id, product_id, outcome_key, asset_code, asset_decimals, quantity_atomic_amount, cost_atomic_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, product_id, outcome_key)
            DO UPDATE SET quantity_atomic_amount = positions.quantity_atomic_amount + EXCLUDED.quantity_atomic_amount,
                         cost_atomic_amount = positions.cost_atomic_amount + EXCLUDED.cost_atomic_amount,
                         state = 'active', updated_at = now(), settled_at = NULL
           WHERE positions.asset_code = EXCLUDED.asset_code
             AND positions.asset_decimals = EXCLUDED.asset_decimals
           RETURNING id`,
          [order.user_id, order.product_id, order.outcome_key, order.product_asset_code, order.product_asset_decimals, filledQuantity.toString(), filled.toString()],
        )
        if (!changed.length) {
          throw new ConflictException({ code: 'ORDER_PRODUCT_SCALE_CHANGED', message: 'The product asset scale changed after this order was placed.' })
        }
      }
      const released = requested - filled
      if (released > 0n) {
        const transactionId = await this.createLedgerTransaction(runner, 'order_release', `order-release:${order.id}`, requestId, 'order', order.id, 'admin', null)
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, locked, available, released.toString()],
        )
      }
      const nextState = input.state
      const completedAt = new Date()
      const failureReason = nextState === 'failed' ? (input.reasonCode ?? 'demo_order_failed') : null
      await runner.query(
        `UPDATE app.orders
         SET state = $2::text, filled_atomic_amount = $3::numeric,
             filled_quantity_atomic_amount = $4::numeric, processed_at = COALESCE(processed_at, now()),
             completed_at = $5::timestamptz, failure_reason = $6::text,
             receipt = jsonb_build_object(
               'orderId', id,
               'state', $2::text,
               'filledAtomicAmount', ($3::numeric)::text,
               'completedAt', $5::timestamptz
             )
         WHERE id = $1`,
        [order.id, nextState, filled.toString(), filledQuantity.toString(), completedAt, failureReason],
      )
      if (nextState !== 'failed' && order.side === 'buy') {
        await recordReferralRewards(runner, { kind: 'purchase', sourceType: 'order', sourceId: order.id, sourceUserId: order.user_id, baseAtomic: filled })
      }
      await this.event(runner, order.id, order.state, nextState, 'admin', null, failureReason ?? undefined, { releasedAtomicAmount: released.toString() })
      return { userId: order.user_id, state: nextState, purchase: nextState !== 'failed' && order.side === 'buy' }
    })
    if (result.purchase) enqueueReferralPurchase(this.dataSource, 'rwa', id)
    const view = await this.getById(id)
    await this.notify(result.userId, `order.${result.state}`, `Demo order ${result.state}`, `Order ${id} is now ${result.state}.`, { orderId: id })
    return view
  }

  async completeRedemption(redemptionId: string, requestId: string) {
    this.assertDemoOperations()
    const result = await this.transaction(async (runner) => {
      const rows = await runner.query(
        `SELECT * FROM app.redemptions WHERE id = $1 FOR UPDATE`,
        [redemptionId],
      ) as Array<{ id: string; user_id: string; product_id: string; quantity_atomic_amount: string; state: string; asset_code: string; asset_decimals: number; quote_decimals: number }>
      const redemption = rows[0]
      if (!redemption) throw new NotFoundException({ code: 'REDEMPTION_NOT_FOUND', message: 'Redemption was not found.' })
      if (redemption.state !== 'requested' && redemption.state !== 'queued') {
        throw new ConflictException({ code: 'REDEMPTION_STATE_INVALID', message: `Redemption cannot be completed from ${redemption.state}.` })
      }
      const positions = await runner.query(
        `SELECT * FROM app.positions
         WHERE user_id = $1 AND product_id = $2 AND outcome_key = 'long' AND state = 'active' FOR UPDATE`,
        [redemption.user_id, redemption.product_id],
      ) as Array<{ id: string; asset_code: string; asset_decimals: number; quantity_atomic_amount: string; cost_atomic_amount: string }>
      const position = positions[0]
      if (!position || BigInt(position.quantity_atomic_amount) < BigInt(redemption.quantity_atomic_amount)) {
        throw new ConflictException({ code: 'REDEMPTION_INSUFFICIENT_POSITION', message: 'The requested quantity is not available in the active position.' })
      }
      const product = await this.catalog.getProduct(redemption.product_id).catch(() => null)
      if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'The redemption product was not found.' })
      if (position.asset_code !== redemption.asset_code || position.asset_decimals !== redemption.asset_decimals
        || product.assetCode !== redemption.asset_code || product.assetDecimals !== redemption.asset_decimals) {
        throw new ConflictException({ code: 'REDEMPTION_PRODUCT_SCALE_CHANGED', message: 'The redemption, active position, and current product use different asset units or scales.' })
      }
      const quote = await this.catalog.getLatestQuote(redemption.product_id)
      if (quote.stale) throw new ConflictException({ code: 'REDEMPTION_QUOTE_STALE', message: 'Current product price is stale.' })
      if (!isUsdUsdtEquivalent(quote.currency)) {
        throw new ConflictException({ code: 'REDEMPTION_QUOTE_CURRENCY_UNSUPPORTED', message: 'Redemption quotes currently support USD or USDT at a 1:1 settlement rate.' })
      }
      const payout = calculateSettlementPayoutAtomic(
        BigInt(redemption.quantity_atomic_amount),
        position.asset_decimals,
        quote.unitPriceDecimals,
        SETTLEMENT_ASSET_DECIMALS,
        BigInt(quote.unitPriceAtomicAmount),
      )
      if (payout <= 0n) {
        throw new ConflictException({ code: 'REDEMPTION_PAYOUT_ROUNDS_TO_ZERO', message: 'The current quote would round this redemption payout to zero. Keep the request open and retry when the quote supports a positive payout.' })
      }
      const totalQuantity = BigInt(position.quantity_atomic_amount)
      const costReleased = (BigInt(position.cost_atomic_amount) * BigInt(redemption.quantity_atomic_amount)) / totalQuantity
      const settlement = await this.ensurePlatformUsdtAccount(runner, `order:${redemption.product_id}`, 'settlement', 'credit')
      const available = await this.ensureUserUsdtAccount(runner, redemption.user_id, 'available')
      const transactionId = await this.createLedgerTransaction(runner, 'settlement', `redemption-settlement:${redemption.id}`, requestId, 'redemption', redemption.id, 'admin', null)
      await runner.query(
        `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
         VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
        [transactionId, settlement, available, payout.toString()],
      )
      const remaining = totalQuantity - BigInt(redemption.quantity_atomic_amount)
      const nextPositionState = remaining === 0n ? 'closed' : 'active'
      await runner.query(
        `UPDATE app.positions SET quantity_atomic_amount = $2::numeric, cost_atomic_amount = cost_atomic_amount - $3::numeric,
           state = $4::text, updated_at = now()
         WHERE id = $1`,
        [position.id, remaining.toString(), costReleased.toString(), nextPositionState],
      )
      await runner.query(
        `UPDATE app.redemptions SET state = 'completed', executed_at = now(), reason_code = NULL WHERE id = $1`,
        [redemption.id],
      )
      return { userId: redemption.user_id, payoutAtomicAmount: payout.toString() }
    })
    await this.notify(result.userId, 'redemption.completed', 'Demo redemption completed', `${result.payoutAtomicAmount} atomic USDT was returned to your available balance.`, { redemptionId })
    return { id: redemptionId, state: 'completed', ...result }
  }

  private async getById(id: string) {
    const rows = await this.dataSource.query(
      `SELECT o.*, p.asset_class_id, p.display_name FROM app.orders o JOIN app.products p ON p.id = o.product_id WHERE o.id = $1`,
      [id],
    ) as OrderRow[]
    if (!rows[0]) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order was not found.' })
    return this.toView(rows[0])
  }

  private async toView(row: OrderRow) {
    const events = await this.dataSource.query(
      `SELECT previous_state AS "previousState", next_state AS "nextState", actor_type AS "actorType",
              reason_code AS "reasonCode", metadata, created_at AS "createdAt"
       FROM app.order_events WHERE order_id = $1 ORDER BY created_at ASC`,
      [row.id],
    )
    return {
      id: row.id, userId: row.user_id, productId: row.product_id, productName: row.display_name,
      assetClassId: row.asset_class_id, outcomeKey: row.outcome_key,
      settlementAssetCode: row.settlement_asset_code,
      settlementAssetDecimals: row.settlement_asset_decimals,
      productAssetCode: row.product_asset_code,
      productAssetDecimals: row.product_asset_decimals,
      quoteCurrency: row.quote_currency,
      quoteDecimals: row.quote_decimals,
      requestedAtomicAmount: row.requested_atomic_amount, filledAtomicAmount: row.filled_atomic_amount,
      filledQuantityAtomicAmount: row.filled_quantity_atomic_amount, unitPriceAtomicAmount: row.unit_price_atomic_amount,
      state: row.state, failureReason: row.failure_reason, submittedAt: row.submitted_at,
      completedAt: row.completed_at, events,
    }
  }

  private async event(runner: QueryRunner, orderId: string, previousState: string | null, nextState: string, actorType: 'user' | 'admin' | 'service', actorId: string | null, reasonCode?: string, metadata: Record<string, unknown> = {}) {
    await runner.query(
      `INSERT INTO app.order_events (id, order_id, previous_state, next_state, actor_type, actor_id, reason_code, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [randomUUID(), orderId, previousState, nextState, actorType, actorId, reasonCode ?? null, JSON.stringify(metadata)],
    )
  }

  private async ensureUserUsdtAccount(runner: QueryRunner, userId: string, purpose: 'available' | 'locked') {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, $2, 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
      [userId, purpose],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts WHERE owner_type = 'user' AND user_id = $1
       AND purpose = $2 AND asset_code = 'USDT' AND network IS NULL AND state = 'active'`,
      [userId, purpose],
    )
    return account.id as string
  }

  private async ensurePlatformUsdtAccount(runner: QueryRunner, reference: string, purpose: 'settlement' | 'reward_payable', normalSide: 'credit' | 'debit') {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('platform', $1, $2, 'USDT', 6, $3) ON CONFLICT DO NOTHING`,
      [reference, purpose, normalSide],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = $1
       AND purpose = $2 AND asset_code = 'USDT' AND network IS NULL AND state = 'active'`,
      [reference, purpose],
    )
    return account.id as string
  }

  private async createLedgerTransaction(runner: QueryRunner, type: 'order_lock' | 'order_release' | 'investment' | 'settlement', idempotencyKey: string, requestId: string, referenceType: string, referenceId: string, actorType: 'user' | 'admin', actorId: string | null) {
    const [row] = await runner.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, actor_id, effective_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
      [type, idempotencyKey, requestId, referenceType, referenceId, actorType, actorId],
    )
    return row.id as string
  }

  private async notify(userId: string, kind: string, title: string, body: string, payload: Record<string, unknown>) {
    try {
      await this.notifications.create({ recipient_user_id: userId, channel: 'in_app', kind, title, body, payload })
    } catch {
      // A notification failure must never undo an already committed financial Demo event.
    }
  }

  private assertIdempotencyKey(value: string) {
    if (!value || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
      throw new BadRequestException({ code: 'ORDER_IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key must contain 8 to 128 characters.' })
    }
  }

  private assertDemoOperations() {
    if (!this.demoOperationsEnabled) {
      throw new ForbiddenException({ code: 'DEMO_OPERATIONS_DISABLED', message: 'Demo administration is disabled outside an explicitly enabled local Demo environment.' })
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

  private assertOrderIntentMatches(
    existing: { product_id: string; requested_atomic_amount: string; outcome_key: OutcomeKey },
    input: { productId: string; atomicAmount: string },
    outcomeKey: OutcomeKey,
  ) {
    if (existing.product_id !== input.productId
      || BigInt(existing.requested_atomic_amount) !== BigInt(input.atomicAmount)
      || existing.outcome_key !== outcomeKey) {
      throw new ConflictException({
        code: 'ORDER_IDEMPOTENCY_CONFLICT',
        message: 'The idempotency key has already been used for a different order intent.',
      })
    }
  }
}

