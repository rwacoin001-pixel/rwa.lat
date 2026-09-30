import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { calculateSettlementPayoutAtomic, isUsdUsdtEquivalent, SETTLEMENT_ASSET_DECIMALS } from '../financial/amounts'
import { OrdersService } from '../orders/orders.service'
import { PortfolioService, type PositionView } from './portfolio.service'
import type { CreateRebalancePlanDto } from './rebalance.dto'

type PlanState = 'submitting_redemptions' | 'redemptions_submitted' | 'awaiting_buy_confirmation' | 'submitting_buys' | 'buy_orders_submitted' | 'completed' | 'canceled' | 'attention'
type LegState = 'planned' | 'submitted' | 'completed' | 'failed'
type Target = { productId: string; targetBps: number }

type PlanRow = {
  id: string
  userId: string
  state: PlanState
  targets: Target[]
  initialValueAtomic: string
  sellProceedsAtomic: string
  idempotencyKey: string
  buyIdempotencyKey: string | null
  sellConfirmedAt: Date
  buyConfirmedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type LegRow = {
  id: string
  productId: string
  productName: string
  kind: 'sell' | 'buy'
  targetBps: number
  requestedAmountAtomic: string | null
  requestedQuantityAtomic: string | null
  actualAmountAtomic: string | null
  state: LegState
  redemptionId: string | null
  redemptionState: string | null
  orderId: string | null
  orderState: string | null
  failureCode: string | null
}

const IDEMPOTENCY = /^[A-Za-z0-9._:-]{8,128}$/

@Injectable()
export class RebalanceService {
  constructor(
    private readonly db: DataSource,
    private readonly portfolio: PortfolioService,
    private readonly orders: OrdersService,
  ) {}

  async create(userId: string, input: CreateRebalancePlanDto, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey)
    const targets = this.normalizeTargets(input.targets)
    const existing = await this.findByIdempotency(userId, idempotencyKey)
    if (existing) {
      if (JSON.stringify(existing.targets) !== JSON.stringify(targets)) {
        throw new ConflictException({ code: 'REBALANCE_IDEMPOTENCY_CONFLICT', message: 'The idempotency key was already used for a different target allocation.' })
      }
      if (existing.state !== 'completed' && existing.state !== 'canceled') await this.submitSellLegs(existing.id, userId, requestId)
      return this.refresh(existing.id, userId)
    }
    const active = await this.db.query(
      `SELECT id,state FROM app.rebalance_plans WHERE user_id=$1 AND state NOT IN ('completed','canceled') ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ) as Array<{ id: string; state: PlanState }>
    if (active[0]) {
      throw new ConflictException({ code: 'REBALANCE_ACTIVE_PLAN_EXISTS', message: 'Finish or resolve the current rebalance plan before starting another one.', planId: active[0].id, state: active[0].state })
    }

    const valued = await this.valuedCurrentPositions(userId)
    const productIds = valued.map((item) => item.position.productId).sort()
    const targetIds = targets.map((item) => item.productId).sort()
    if (JSON.stringify(productIds) !== JSON.stringify(targetIds)) {
      throw new ConflictException({ code: 'REBALANCE_TARGET_SET_INVALID', message: 'Targets must include every current priced ordinary-asset position exactly once.' })
    }
    const initialValue = valued.reduce((sum, item) => sum + item.value, 0n)
    if (initialValue <= 0n) throw new ConflictException({ code: 'REBALANCE_PORTFOLIO_EMPTY', message: 'A positive priced portfolio is required.' })

    const targetMap = new Map(targets.map((item) => [item.productId, item.targetBps]))
    const sellLegs = valued.flatMap(({ position, value }) => {
      const targetBps = targetMap.get(position.productId) ?? 0
      const desired = initialValue * BigInt(targetBps) / 10_000n
      if (value <= desired) return []
      const totalQuantity = BigInt(position.quantityAtomicAmount)
      let quantity = (totalQuantity * (value - desired) + value - 1n) / value
      if (targetBps > 0 && quantity >= totalQuantity) quantity = totalQuantity - 1n
      if (quantity <= 0n) return []
      return [{ productId: position.productId, targetBps, quantity }]
    })
    if (!sellLegs.length) {
      throw new ConflictException({ code: 'REBALANCE_NO_CHANGES', message: 'The target allocation does not require any redemption.' })
    }

    const planId = randomUUID()
    try {
      await this.db.transaction(async (manager) => {
        await manager.query(
          `INSERT INTO app.rebalance_plans
            (id,user_id,state,targets_json,initial_value_atomic,idempotency_key,sell_confirmed_at)
           VALUES ($1,$2,'submitting_redemptions',$3::jsonb,$4,$5,now())`,
          [planId, userId, JSON.stringify(targets), initialValue.toString(), idempotencyKey],
        )
        for (const leg of sellLegs) {
          await manager.query(
            `INSERT INTO app.rebalance_legs
              (id,plan_id,product_id,kind,target_bps,requested_quantity_atomic,state)
             VALUES ($1,$2,$3,'sell',$4,$5,'planned')`,
            [randomUUID(), planId, leg.productId, leg.targetBps, leg.quantity.toString()],
          )
        }
      })
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== '23505') throw error
      const replay = await this.findByIdempotency(userId, idempotencyKey)
      if (!replay) throw new ConflictException({ code: 'REBALANCE_ACTIVE_PLAN_EXISTS', message: 'Another rebalance plan became active. Refresh before continuing.' })
      if (JSON.stringify(replay.targets) !== JSON.stringify(targets)) {
        throw new ConflictException({ code: 'REBALANCE_IDEMPOTENCY_CONFLICT', message: 'The idempotency key was already used for a different target allocation.' })
      }
      await this.submitSellLegs(replay.id, userId, requestId)
      return this.refresh(replay.id, userId)
    }
    await this.submitSellLegs(planId, userId, requestId)
    return this.refresh(planId, userId)
  }

  async list(userId: string) {
    const rows = await this.db.query(
      `SELECT id FROM app.rebalance_plans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25`,
      [userId],
    ) as Array<{ id: string }>
    const views = []
    for (const row of rows) views.push(await this.refresh(row.id, userId))
    return views
  }

  async get(id: string, userId: string) {
    return this.refresh(id, userId)
  }

  async cancel(id: string, userId: string) {
    let { plan, legs } = await this.load(id, userId)
    if (plan.state === 'canceled' || plan.state === 'completed') return this.view(plan, legs)
    if (plan.buyConfirmedAt || legs.some((leg) => leg.kind === 'sell' && leg.redemptionState === 'completed')) {
      throw new ConflictException({ code: 'REBALANCE_CANCEL_TOO_LATE', message: 'A rebalance cannot be canceled after proceeds arrive or buy orders are confirmed.' })
    }
    const open = legs.filter((leg) => leg.kind === 'sell' && leg.redemptionId && !['failed', 'canceled'].includes(leg.redemptionState ?? ''))
    if (open.some((leg) => !['requested', 'queued'].includes(leg.redemptionState ?? ''))) {
      throw new ConflictException({ code: 'REBALANCE_CANCEL_IN_PROGRESS', message: 'A redemption is already executing and cannot be canceled automatically.' })
    }
    for (const leg of open) await this.portfolio.cancelRedemption(leg.redemptionId!, userId)
    await this.db.query(`UPDATE app.rebalance_plans SET state='canceled',updated_at=now() WHERE id=$1 AND user_id=$2`, [id, userId])
    ;({ plan, legs } = await this.load(id, userId))
    return this.view(plan, legs)
  }

  async confirmBuys(id: string, userId: string, idempotencyKey: string, requestId: string) {
    this.assertIdempotencyKey(idempotencyKey)
    await this.refresh(id, userId)
    let { plan, legs } = await this.load(id, userId)
    if (plan.state === 'completed' || plan.state === 'buy_orders_submitted') return this.view(plan, legs)
    if (!plan.buyConfirmedAt && plan.buyIdempotencyKey && plan.buyIdempotencyKey !== idempotencyKey) {
      throw new ConflictException({ code: 'REBALANCE_BUY_IDEMPOTENCY_CONFLICT', message: 'This plan was already confirmed with a different buy confirmation key.' })
    }
    if (plan.state !== 'awaiting_buy_confirmation' && !(plan.state === 'attention' && plan.buyConfirmedAt)) {
      throw new ConflictException({ code: 'REBALANCE_NOT_READY_FOR_BUYS', message: 'Actual redemption proceeds must be posted before buy orders can be confirmed.' })
    }
    await this.db.query(
      `UPDATE app.rebalance_plans
          SET state='submitting_buys', buy_idempotency_key=COALESCE(buy_idempotency_key,$3),
              buy_confirmed_at=COALESCE(buy_confirmed_at,now()), updated_at=now()
        WHERE id=$1 AND user_id=$2`,
      [id, userId, idempotencyKey],
    )
    ;({ plan, legs } = await this.load(id, userId))
    let failed = false
    for (const leg of legs.filter((item) => item.kind === 'buy' && !item.orderId)) {
      try {
        const order = await this.orders.create(
          userId,
          { productId: leg.productId, atomicAmount: leg.requestedAmountAtomic! },
          `rebalance:${id}:buy:${leg.productId}`,
          `${requestId}:rebalance-buy:${leg.productId}`.slice(0, 128),
        )
        await this.db.query(
          `UPDATE app.rebalance_legs SET order_id=$2,state='submitted',failure_code=NULL,updated_at=now() WHERE id=$1`,
          [leg.id, order.id],
        )
      } catch (error) {
        failed = true
        await this.db.query(
          `UPDATE app.rebalance_legs SET state='failed',failure_code=$2,updated_at=now() WHERE id=$1`,
          [leg.id, this.errorCode(error)],
        )
      }
    }
    await this.db.query(
      `UPDATE app.rebalance_plans SET state=$2,updated_at=now() WHERE id=$1`,
      [id, failed ? 'attention' : 'buy_orders_submitted'],
    )
    return this.refresh(id, userId)
  }

  async refresh(id: string, userId: string) {
    let { plan, legs } = await this.load(id, userId)
    if (plan.state === 'completed' || plan.state === 'canceled') return this.view(plan, legs)
    const sellLegs = legs.filter((item) => item.kind === 'sell')
    if (sellLegs.some((leg) => !leg.redemptionId)) return this.view(plan, legs)

    const failedSell = sellLegs.some((leg) => leg.redemptionState === 'failed' || leg.redemptionState === 'canceled')
    if (failedSell) {
      await this.db.query(`UPDATE app.rebalance_plans SET state='attention',updated_at=now() WHERE id=$1`, [id])
    } else if (sellLegs.every((leg) => leg.redemptionState === 'completed')) {
      const missingReceipt = sellLegs.some((leg) => leg.actualAmountAtomic === null)
      if (missingReceipt) {
        await this.db.query(`UPDATE app.rebalance_plans SET state='attention',updated_at=now() WHERE id=$1`, [id])
      } else if (!plan.buyConfirmedAt) {
        // Freeze the proposal shown to the user. A background refresh must not
        // change amounts between display and the explicit second confirmation.
        if (plan.state !== 'awaiting_buy_confirmation' || !legs.some((leg) => leg.kind === 'buy')) {
          const proceeds = sellLegs.reduce((sum, leg) => sum + BigInt(leg.actualAmountAtomic!), 0n)
          await this.prepareBuys(plan, proceeds)
        }
      }
    } else if (!plan.buyConfirmedAt) {
      await this.db.query(`UPDATE app.rebalance_plans SET state='redemptions_submitted',updated_at=now() WHERE id=$1`, [id])
    }

    ;({ plan, legs } = await this.load(id, userId))
    const buyLegs = legs.filter((item) => item.kind === 'buy')
    if (plan.buyConfirmedAt && buyLegs.length) {
      for (const leg of buyLegs) {
        const state: LegState = leg.orderState === 'filled' || leg.orderState === 'partially_filled'
          ? 'completed' : leg.orderState === 'failed' ? 'failed' : leg.orderId ? 'submitted' : leg.state
        if (state !== leg.state) await this.db.query(`UPDATE app.rebalance_legs SET state=$2,updated_at=now() WHERE id=$1`, [leg.id, state])
      }
      ;({ plan, legs } = await this.load(id, userId))
      const currentBuys = legs.filter((item) => item.kind === 'buy')
      const state: PlanState = currentBuys.some((leg) => leg.state === 'failed')
        ? 'attention' : currentBuys.every((leg) => leg.state === 'completed')
          ? 'completed' : currentBuys.every((leg) => leg.orderId)
            ? 'buy_orders_submitted' : plan.state
      if (state !== plan.state) {
        await this.db.query(`UPDATE app.rebalance_plans SET state=$2,updated_at=now() WHERE id=$1`, [id, state])
        ;({ plan, legs } = await this.load(id, userId))
      }
    }
    return this.view(plan, legs)
  }

  private async submitSellLegs(planId: string, userId: string, requestId: string) {
    const { legs } = await this.load(planId, userId)
    let failed = false
    for (const leg of legs.filter((item) => item.kind === 'sell' && !item.redemptionId)) {
      try {
        const redemption = await this.portfolio.requestRedemption({
          user_id: userId,
          product_id: leg.productId,
          quantity_atomic_amount: leg.requestedQuantityAtomic!,
          request_id: `rebalance:${planId}:sell:${leg.productId}`,
        })
        await this.db.query(
          `UPDATE app.rebalance_legs SET redemption_id=$2,state='submitted',failure_code=NULL,updated_at=now() WHERE id=$1`,
          [leg.id, redemption.id],
        )
      } catch (error) {
        failed = true
        await this.db.query(
          `UPDATE app.rebalance_legs SET state='failed',failure_code=$2,updated_at=now() WHERE id=$1`,
          [leg.id, this.errorCode(error)],
        )
      }
    }
    await this.db.query(
      `UPDATE app.rebalance_plans SET state=$2,updated_at=now() WHERE id=$1`,
      [planId, failed ? 'attention' : 'redemptions_submitted'],
    )
  }

  private async prepareBuys(plan: PlanRow, proceeds: bigint) {
    if (proceeds <= 0n) {
      await this.db.query(`UPDATE app.rebalance_plans SET state='attention',sell_proceeds_atomic=0,updated_at=now() WHERE id=$1`, [plan.id])
      return
    }
    const valued = await this.valuedCurrentPositions(plan.userId, true)
    const current = new Map(valued.map((item) => [item.position.productId, item.value]))
    const untracked = valued.find((item) => !plan.targets.some((target) => target.productId === item.position.productId))
    if (untracked) {
      await this.db.query(`UPDATE app.rebalance_plans SET state='attention',updated_at=now() WHERE id=$1`, [plan.id])
      return
    }
    const remainingValue = valued.reduce((sum, item) => sum + item.value, 0n)
    const total = remainingValue + proceeds
    const desired = plan.targets.map((target) => ({ ...target, value: total * BigInt(target.targetBps) / 10_000n }))
    const desiredRemainder = total - desired.reduce((sum, item) => sum + item.value, 0n)
    if (desired.length) desired[0].value += desiredRemainder
    const deficits = desired.map((target) => ({
      ...target,
      deficit: target.value > (current.get(target.productId) ?? 0n) ? target.value - (current.get(target.productId) ?? 0n) : 0n,
    })).filter((item) => item.deficit > 0n)
    const deficitTotal = deficits.reduce((sum, item) => sum + item.deficit, 0n)
    const spend = proceeds < deficitTotal ? proceeds : deficitTotal
    if (spend <= 0n || deficitTotal <= 0n) {
      await this.db.query(`UPDATE app.rebalance_plans SET state='attention',sell_proceeds_atomic=$2,updated_at=now() WHERE id=$1`, [plan.id, proceeds.toString()])
      return
    }
    const allocations = deficits.map((item) => ({ ...item, amount: item.deficit * spend / deficitTotal }))
    let remainder = spend - allocations.reduce((sum, item) => sum + item.amount, 0n)
    for (const item of allocations.sort((a, b) => a.productId.localeCompare(b.productId))) {
      if (remainder <= 0n) break
      const room = item.deficit - item.amount
      const addition = room < remainder ? room : remainder
      item.amount += addition
      remainder -= addition
    }
    await this.db.transaction(async (manager) => {
      await manager.query(`DELETE FROM app.rebalance_legs WHERE plan_id=$1 AND kind='buy'`, [plan.id])
      for (const item of allocations.filter((allocation) => allocation.amount > 0n)) {
        await manager.query(
          `INSERT INTO app.rebalance_legs
            (id,plan_id,product_id,kind,target_bps,requested_amount_atomic,state)
           VALUES ($1,$2,$3,'buy',$4,$5,'planned')`,
          [randomUUID(), plan.id, item.productId, item.targetBps, item.amount.toString()],
        )
      }
      await manager.query(
        `UPDATE app.rebalance_plans SET state='awaiting_buy_confirmation',sell_proceeds_atomic=$2,updated_at=now() WHERE id=$1`,
        [plan.id, proceeds.toString()],
      )
    })
  }

  private async valuedCurrentPositions(userId: string, allowEmpty = false) {
    const positions = await this.portfolio.listPositions(userId)
    if (!positions.length && allowEmpty) return []
    if (!positions.length) throw new ConflictException({ code: 'REBALANCE_PORTFOLIO_EMPTY', message: 'A current portfolio is required.' })
    const valued = positions.map((position) => ({ position, value: this.valueOf(position) }))
    if (valued.some((item) => item.value === null)) {
      throw new ConflictException({ code: 'REBALANCE_POSITION_UNPRICED', message: 'Every position must have a current ordinary-asset USD or USDT quote before rebalancing.' })
    }
    return valued as Array<{ position: PositionView; value: bigint }>
  }

  private valueOf(position: PositionView): bigint | null {
    if (position.outcomeKey !== 'long' || position.source !== 'demo-order-position' || !isUsdUsdtEquivalent(position.currency)) return null
    const price = BigInt(position.unitPriceAtomicAmount)
    if (price <= 0n) return null
    return calculateSettlementPayoutAtomic(
      BigInt(position.quantityAtomicAmount),
      position.assetDecimals,
      position.unitPriceDecimals,
      SETTLEMENT_ASSET_DECIMALS,
      price,
    )
  }

  private normalizeTargets(input: Target[]) {
    const targets = [...input].sort((left, right) => left.productId.localeCompare(right.productId))
    if (new Set(targets.map((item) => item.productId)).size !== targets.length) {
      throw new BadRequestException({ code: 'REBALANCE_TARGET_DUPLICATE', message: 'Each product may appear only once.' })
    }
    if (targets.reduce((sum, item) => sum + item.targetBps, 0) !== 10_000) {
      throw new BadRequestException({ code: 'REBALANCE_TARGET_TOTAL_INVALID', message: 'Target weights must total exactly 10000 basis points.' })
    }
    return targets
  }

  private assertIdempotencyKey(value: string) {
    if (!IDEMPOTENCY.test(value ?? '')) {
      throw new BadRequestException({ code: 'REBALANCE_IDEMPOTENCY_KEY_INVALID', message: 'Idempotency-Key must be 8 to 128 safe characters.' })
    }
  }

  private async findByIdempotency(userId: string, key: string) {
    const rows = await this.db.query(
      `SELECT id,user_id AS "userId",state,targets_json AS targets,initial_value_atomic::text AS "initialValueAtomic",
              sell_proceeds_atomic::text AS "sellProceedsAtomic",idempotency_key AS "idempotencyKey",
              buy_idempotency_key AS "buyIdempotencyKey",sell_confirmed_at AS "sellConfirmedAt",
              buy_confirmed_at AS "buyConfirmedAt",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM app.rebalance_plans WHERE user_id=$1 AND idempotency_key=$2`,
      [userId, key],
    ) as PlanRow[]
    return rows[0] ?? null
  }

  private async load(id: string, userId: string) {
    const plans = await this.db.query(
      `SELECT id,user_id AS "userId",state,targets_json AS targets,initial_value_atomic::text AS "initialValueAtomic",
              sell_proceeds_atomic::text AS "sellProceedsAtomic",idempotency_key AS "idempotencyKey",
              buy_idempotency_key AS "buyIdempotencyKey",sell_confirmed_at AS "sellConfirmedAt",
              buy_confirmed_at AS "buyConfirmedAt",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM app.rebalance_plans WHERE id=$1 AND user_id=$2`,
      [id, userId],
    ) as PlanRow[]
    if (!plans[0]) throw new NotFoundException({ code: 'REBALANCE_NOT_FOUND', message: 'Rebalance plan was not found.' })
    const legs = await this.db.query(
      `SELECT l.id,l.product_id AS "productId",p.display_name AS "productName",l.kind,l.target_bps AS "targetBps",
              l.requested_amount_atomic::text AS "requestedAmountAtomic",l.requested_quantity_atomic::text AS "requestedQuantityAtomic",
              COALESCE(ms.amount_atomic,l.actual_amount_atomic)::text AS "actualAmountAtomic",l.state,
              l.redemption_id AS "redemptionId",r.state AS "redemptionState",l.order_id AS "orderId",o.state AS "orderState",
              l.failure_code AS "failureCode"
         FROM app.rebalance_legs l
         JOIN app.products p ON p.id=l.product_id
         LEFT JOIN app.redemptions r ON r.id=l.redemption_id
         LEFT JOIN app.orders o ON o.id=l.order_id
         LEFT JOIN app.manual_trade_settlements ms ON ms.kind='redemption' AND ms.reference_id=l.redemption_id
        WHERE l.plan_id=$1 ORDER BY CASE l.kind WHEN 'sell' THEN 0 ELSE 1 END,p.display_name,l.id`,
      [id],
    ) as LegRow[]
    return { plan: plans[0], legs }
  }

  private view(plan: PlanRow, legs: LegRow[]) {
    return {
      id: plan.id,
      state: plan.state,
      targets: plan.targets,
      initialValueAtomic: plan.initialValueAtomic,
      sellProceedsAtomic: plan.sellProceedsAtomic,
      sellConfirmedAt: plan.sellConfirmedAt,
      buyConfirmedAt: plan.buyConfirmedAt,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      legs,
    }
  }

  private errorCode(error: unknown) {
    if (error && typeof error === 'object' && 'getResponse' in error && typeof error.getResponse === 'function') {
      const response = error.getResponse()
      if (response && typeof response === 'object' && 'code' in response) return String(response.code).slice(0, 180)
    }
    return (error instanceof Error ? error.message : 'REBALANCE_OPERATION_FAILED').slice(0, 180)
  }
}
