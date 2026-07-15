import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { DataSource, QueryRunner } from 'typeorm'
import { CatalogService } from '../catalog/catalog.service'
import { NotificationService } from '../notification/notification.service'

type BatchState = 'draft' | 'previewed' | 'approved' | 'processing' | 'completed' | 'partially_failed'

interface BatchRow {
  id: string
  product_id: string
  total_atomic_amount: string
  period_start: Date
  period_end: Date
  state: BatchState
  created_at: Date
  approved_at: Date | null
  executed_at: Date | null
}

@Injectable()
export class YieldService {
  private readonly demoOperationsEnabled: boolean

  constructor(
    private readonly dataSource: DataSource,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationService,
    config: ConfigService,
  ) {
    this.demoOperationsEnabled = config.get<string>('APP_ENV') !== 'production'
      && config.get<string>('DEMO_OPERATIONS_ENABLED') === 'true'
  }

  async listForUser(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT ya.id, ya.atomic_amount AS "atomicAmount", ya.state, ya.credited_at AS "creditedAt",
              yb.id AS "batchId", yb.product_id AS "productId", yb.period_start AS "periodStart", yb.period_end AS "periodEnd"
       FROM app.yield_allocations ya
       JOIN app.yield_batches yb ON yb.id = ya.batch_id
       WHERE ya.user_id = $1 ORDER BY yb.created_at DESC`,
      [userId],
    )
    return rows
  }

  async listForAdmin() {
    this.assertDemoOperations()
    const rows = await this.dataSource.query(
      `SELECT yb.*, p.display_name AS "productName",
              COALESCE(SUM(ya.atomic_amount) FILTER (WHERE ya.state = 'credited'), 0)::text AS "creditedAtomicAmount",
              COUNT(ya.id)::int AS "allocationCount"
       FROM app.yield_batches yb
       JOIN app.products p ON p.id = yb.product_id
       LEFT JOIN app.yield_allocations ya ON ya.batch_id = yb.id
       GROUP BY yb.id, p.display_name
       ORDER BY yb.created_at DESC`,
    )
    return rows.map((row: Record<string, unknown>) => this.batchView(row as unknown as BatchRow))
  }

  async create(input: { productId: string; totalAtomicAmount: string; periodStart: string; periodEnd: string }, requestId: string) {
    this.assertDemoOperations()
    await this.catalog.getProduct(input.productId)
    const start = new Date(input.periodStart)
    const end = new Date(input.periodEnd)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw new BadRequestException({ code: 'YIELD_PERIOD_INVALID', message: 'Yield period must have a valid positive duration.' })
    }
    const row = await this.dataSource.query(
      `INSERT INTO app.yield_batches (id, product_id, total_atomic_amount, period_start, period_end, request_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [randomUUID(), input.productId, input.totalAtomicAmount, start, end, requestId],
    ) as BatchRow[]
    return this.batchView(row[0])
  }

  async preview(batchId: string) {
    this.assertDemoOperations()
    const result = await this.transaction(async (runner) => {
      const batch = await this.lockBatch(runner, batchId)
      if (batch.state !== 'draft' && batch.state !== 'previewed') {
        throw new ConflictException({ code: 'YIELD_STATE_INVALID', message: `Batch cannot be previewed from ${batch.state}.` })
      }
      const positions = await runner.query(
        `SELECT id, user_id, cost_atomic_amount::text AS cost
         FROM app.positions
         WHERE product_id = $1 AND state = 'active' AND quantity_atomic_amount > 0
         ORDER BY user_id, id`,
        [batch.product_id],
      ) as Array<{ id: string; user_id: string; cost: string }>
      if (!positions.length) {
        throw new ConflictException({ code: 'YIELD_NO_ELIGIBLE_POSITIONS', message: 'The product has no active positions to receive yield.' })
      }
      const totalCost = positions.reduce((sum, position) => sum + BigInt(position.cost), 0n)
      if (totalCost <= 0n) throw new ConflictException({ code: 'YIELD_NO_COST_BASIS', message: 'Active positions have no cost basis.' })
      const total = BigInt(batch.total_atomic_amount)
      let assigned = 0n
      for (let index = 0; index < positions.length; index += 1) {
        const position = positions[index]
        const amount = index === positions.length - 1
          ? total - assigned
          : (total * BigInt(position.cost)) / totalCost
        assigned += amount
        await runner.query(
          `INSERT INTO app.yield_allocations (id, batch_id, user_id, position_id, atomic_amount, state)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           ON CONFLICT (batch_id, user_id, position_id)
           DO UPDATE SET atomic_amount = EXCLUDED.atomic_amount, state = 'pending', failure_reason = NULL, credited_at = NULL`,
          [randomUUID(), batch.id, position.user_id, position.id, amount.toString()],
        )
      }
      await runner.query(`UPDATE app.yield_batches SET state = 'previewed' WHERE id = $1`, [batch.id])
      return batch.id
    })
    return this.getAdminBatch(result)
  }

  async approve(batchId: string) {
    this.assertDemoOperations()
    const result = await this.dataSource.query(
      `UPDATE app.yield_batches SET state = 'approved', approved_at = now()
       WHERE id = $1 AND state = 'previewed' RETURNING *`,
      [batchId],
    ) as BatchRow[]
    if (!result[0]) throw new ConflictException({ code: 'YIELD_STATE_INVALID', message: 'Only a previewed batch can be approved.' })
    return this.getAdminBatch(batchId)
  }

  async execute(batchId: string, requestId: string) {
    this.assertDemoOperations()
    const credits = await this.transaction(async (runner) => {
      const batch = await this.lockBatch(runner, batchId)
      if (batch.state !== 'approved') {
        throw new ConflictException({ code: 'YIELD_STATE_INVALID', message: 'Only an approved batch can be executed.' })
      }
      await runner.query(`UPDATE app.yield_batches SET state = 'processing' WHERE id = $1`, [batch.id])
      const allocations = await runner.query(
        `SELECT id, user_id, position_id, atomic_amount::text AS atomic_amount
         FROM app.yield_allocations WHERE batch_id = $1 AND state = 'pending' ORDER BY id`,
        [batch.id],
      ) as Array<{ id: string; user_id: string; position_id: string; atomic_amount: string }>
      if (!allocations.length) throw new ConflictException({ code: 'YIELD_ALLOCATIONS_MISSING', message: 'Preview allocations are required before execution.' })
      const payable = await this.ensurePlatformUsdtAccount(runner, `yield:${batch.id}`, 'reward_payable', 'debit')
      for (const allocation of allocations) {
        if (BigInt(allocation.atomic_amount) === 0n) {
          await runner.query(`UPDATE app.yield_allocations SET state = 'credited', credited_at = now() WHERE id = $1`, [allocation.id])
          continue
        }
        const available = await this.ensureUserUsdtAccount(runner, allocation.user_id)
        const transactionId = await this.createLedgerTransaction(runner, 'yield_accrual', `yield:${allocation.id}`, requestId, 'yield_allocation', allocation.id, 'admin')
        await runner.query(
          `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
           VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
          [transactionId, payable, available, allocation.atomic_amount],
        )
        await runner.query(
          `UPDATE app.positions SET cumulative_yield_atomic_amount = cumulative_yield_atomic_amount + $2,
            updated_at = now() WHERE id = $1`,
          [allocation.position_id, allocation.atomic_amount],
        )
        await runner.query(`UPDATE app.yield_allocations SET state = 'credited', credited_at = now() WHERE id = $1`, [allocation.id])
      }
      await runner.query(`UPDATE app.yield_batches SET state = 'completed', executed_at = now() WHERE id = $1`, [batch.id])
      return allocations.map((allocation) => ({ userId: allocation.user_id, allocationId: allocation.id, atomicAmount: allocation.atomic_amount }))
    })
    await Promise.all(credits.map((credit) => this.notify(credit.userId, 'yield.credited', 'Demo yield credited', `${credit.atomicAmount} USDT atomic units were credited.`, { allocationId: credit.allocationId })))
    return this.getAdminBatch(batchId)
  }

  async settlePrediction(productId: string, outcomeKey: 'yes' | 'no' | 'void', requestId: string) {
    this.assertDemoOperations()
    const product = await this.catalog.getProduct(productId)
    if (product.assetClassId !== 'prediction') {
      throw new BadRequestException({ code: 'PREDICTION_PRODUCT_REQUIRED', message: 'Only prediction products can be settled.' })
    }
    const payouts = await this.transaction(async (runner) => {
      const inserted = await runner.query(
        `INSERT INTO app.prediction_settlements (id, product_id, outcome_key, request_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT (product_id) DO NOTHING RETURNING id`,
        [randomUUID(), productId, outcomeKey, requestId],
      )
      if (!inserted.length) throw new ConflictException({ code: 'PREDICTION_ALREADY_SETTLED', message: 'Prediction market has already been settled.' })
      const positions = await runner.query(
        `SELECT id, user_id, outcome_key, cost_atomic_amount::text AS cost
         FROM app.positions WHERE product_id = $1 AND state = 'active' FOR UPDATE`,
        [productId],
      ) as Array<{ id: string; user_id: string; outcome_key: 'yes' | 'no' | 'long'; cost: string }>
      const liquidity = await this.ensurePlatformUsdtAccount(runner, `prediction:${productId}`, 'settlement', 'debit')
      const out: Array<{ userId: string; atomicAmount: string }> = []
      for (const position of positions) {
        const payout = outcomeKey === 'void'
          ? BigInt(position.cost)
          : position.outcome_key === outcomeKey ? BigInt(position.cost) * 2n : 0n
        if (payout > 0n) {
          const available = await this.ensureUserUsdtAccount(runner, position.user_id)
          const transactionId = await this.createLedgerTransaction(runner, 'settlement', `prediction-settlement:${productId}:${position.id}`, requestId, 'prediction_settlement', inserted[0].id as string, 'admin')
          await runner.query(
            `INSERT INTO app.ledger_entries (transaction_id, account_id, side, atomic_amount)
             VALUES ($1, $2, 'debit', $4), ($1, $3, 'credit', $4)`,
            [transactionId, liquidity, available, payout.toString()],
          )
          out.push({ userId: position.user_id, atomicAmount: payout.toString() })
        }
        await runner.query(`UPDATE app.positions SET state = 'settled', settled_at = now(), updated_at = now() WHERE id = $1`, [position.id])
      }
      return out
    })
    await Promise.all(payouts.map((payout) => this.notify(payout.userId, 'prediction.settled', 'Prediction market settled', `Settlement credited ${payout.atomicAmount} atomic USDT.`, { productId, outcomeKey })))
    return { productId, outcomeKey, payoutCount: payouts.length, payouts }
  }

  async createDemoPredictionMarket(requestId: string) {
    this.assertDemoOperations()
    const templateRows = await this.dataSource.query(
      `SELECT asset_decimals, network, min_order_atomic_amount, max_order_atomic_amount,
              unit_price_atomic_amount, currency
       FROM app.products p
       JOIN LATERAL (
         SELECT unit_price_atomic_amount, currency FROM app.price_quotes
         WHERE product_id = p.id ORDER BY valid_until DESC LIMIT 1
       ) q ON true
       WHERE p.asset_class_id = 'prediction' AND p.state = 'published'
       ORDER BY p.published_at ASC LIMIT 1`,
    ) as Array<{ asset_decimals: number; network: string | null; min_order_atomic_amount: string | null; max_order_atomic_amount: string | null; unit_price_atomic_amount: string; currency: string }>
    const template = templateRows[0]
    if (!template) throw new ConflictException({ code: 'PREDICTION_TEMPLATE_MISSING', message: 'A published prediction Demo template is required.' })
    const id = randomUUID()
    const externalRef = `demo-market-${id}`
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO app.products
          (id, asset_class_id, version, external_ref, display_name, summary, asset_code, asset_decimals,
           network, min_order_atomic_amount, max_order_atomic_amount, state, published_at)
         VALUES ($1, 'prediction', 1, $2, $3, $4, 'USD', $5, $6, $7, $8, 'published', now())`,
        [id, externalRef, `Demo Prediction Market ${id.slice(0, 8)}`, 'Local Demo market with server-side YES/NO settlement.', template.asset_decimals, template.network, template.min_order_atomic_amount, template.max_order_atomic_amount],
      )
      await manager.query(
        `INSERT INTO app.price_quotes
          (id, product_id, asset_code, unit_price_atomic_amount, currency, source, valid_until, captured_at)
         VALUES ($1, $2, 'USD', $3, $4, 'demo-admin', now() + interval '365 days', now())`,
        [randomUUID(), id, template.unit_price_atomic_amount, template.currency],
      )
    })
    return { id, assetClassId: 'prediction', externalRef, requestId }
  }

  private async getAdminBatch(batchId: string) {
    const rows = await this.dataSource.query(
      `SELECT yb.*, p.display_name AS "productName",
              COALESCE(SUM(ya.atomic_amount) FILTER (WHERE ya.state = 'credited'), 0)::text AS "creditedAtomicAmount",
              COUNT(ya.id)::int AS "allocationCount"
       FROM app.yield_batches yb JOIN app.products p ON p.id = yb.product_id
       LEFT JOIN app.yield_allocations ya ON ya.batch_id = yb.id
       WHERE yb.id = $1 GROUP BY yb.id, p.display_name`,
      [batchId],
    ) as Array<BatchRow & { productName?: string; creditedAtomicAmount?: string; allocationCount?: number }>
    if (!rows[0]) throw new NotFoundException({ code: 'YIELD_BATCH_NOT_FOUND', message: 'Yield batch was not found.' })
    const allocations = await this.dataSource.query(
      `SELECT id, user_id AS "userId", position_id AS "positionId", atomic_amount AS "atomicAmount", state, failure_reason AS "failureReason", credited_at AS "creditedAt"
       FROM app.yield_allocations WHERE batch_id = $1 ORDER BY user_id`,
      [batchId],
    )
    return { ...this.batchView(rows[0]), allocations }
  }

  private batchView(row: BatchRow & { productName?: string; creditedAtomicAmount?: string; allocationCount?: number }) {
    return {
      id: row.id, productId: row.product_id, productName: row.productName,
      totalAtomicAmount: row.total_atomic_amount, periodStart: row.period_start, periodEnd: row.period_end,
      state: row.state, createdAt: row.created_at, approvedAt: row.approved_at, executedAt: row.executed_at,
      creditedAtomicAmount: row.creditedAtomicAmount ?? '0', allocationCount: row.allocationCount ?? 0,
    }
  }

  private async lockBatch(runner: QueryRunner, batchId: string) {
    const rows = await runner.query(`SELECT * FROM app.yield_batches WHERE id = $1 FOR UPDATE`, [batchId]) as BatchRow[]
    if (!rows[0]) throw new NotFoundException({ code: 'YIELD_BATCH_NOT_FOUND', message: 'Yield batch was not found.' })
    return rows[0]
  }

  private async ensureUserUsdtAccount(runner: QueryRunner, userId: string) {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, user_id, purpose, asset_code, asset_decimals, normal_side)
       VALUES ('user', $1, 'available', 'USDT', 6, 'credit') ON CONFLICT DO NOTHING`,
      [userId],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts WHERE owner_type = 'user' AND user_id = $1
       AND purpose = 'available' AND asset_code = 'USDT' AND network IS NULL AND state = 'active'`,
      [userId],
    )
    return account.id as string
  }

  private async ensurePlatformUsdtAccount(runner: QueryRunner, reference: string, purpose: 'settlement' | 'reward_payable', normalSide: 'debit' | 'credit') {
    await runner.query(
      `INSERT INTO app.ledger_accounts (owner_type, owner_reference, purpose, asset_code, asset_decimals, normal_side, allow_negative)
       VALUES ('platform', $1, $2, 'USDT', 6, $3, true) ON CONFLICT DO NOTHING`,
      [reference, purpose, normalSide],
    )
    const [account] = await runner.query(
      `SELECT id FROM app.ledger_accounts WHERE owner_type = 'platform' AND owner_reference = $1
       AND purpose = $2 AND asset_code = 'USDT' AND network IS NULL AND state = 'active'`,
      [reference, purpose],
    )
    return account.id as string
  }

  private async createLedgerTransaction(runner: QueryRunner, type: 'yield_accrual' | 'settlement', idempotencyKey: string, requestId: string, referenceType: string, referenceId: string, actorType: 'admin') {
    const [row] = await runner.query(
      `INSERT INTO app.ledger_transactions
        (transaction_type, idempotency_key, request_id, reference_type, reference_id, actor_type, effective_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id`,
      [type, idempotencyKey, requestId, referenceType, referenceId, actorType],
    )
    return row.id as string
  }

  private async notify(userId: string, kind: string, title: string, body: string, payload: Record<string, unknown>) {
    try {
      await this.notifications.create({ recipient_user_id: userId, channel: 'in_app', kind, title, body, payload })
    } catch {
      // Notification delivery is intentionally non-blocking after a committed ledger transaction.
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
}
