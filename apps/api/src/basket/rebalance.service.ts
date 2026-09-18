import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { OperationalCapabilityService, OPERATIONAL_SWITCH_KEYS } from '../operations/operational-capability.service'
import { LedgerService } from '../ledger/ledger.service'
import { BASKET_DEFAULTS, BASKET_ERROR_CODES, BASKET_EXECUTION_ADAPTER_TOKEN, isInsufficientLedgerBalance } from './basket.constants'
import { add18, atomicTo18, div18, format18, mul18, parse18, sub18, toAtomicRounded, weightPct18 } from './basket.decimals'
import { BasketNavService } from './basket.nav.service'
import type { BasketExecutionAdapter } from './execution/basket-execution.adapter'
import { BasketRiskService } from './risk.service'

export type PlanRebalanceOptions = {
  trigger?: 'scheduled' | 'drift' | 'risk' | 'manual'
  driftThresholdPct?: number
  minTradeUsd?: number
  requestId?: string
}

const QTY_PATTERN = /^\d+(\.\d{1,18})?$/
const PRICE_PATTERN = /^\d+(\.\d{1,18})?$/

/**
 * 调仓服务（规格 §78-84；边界：做到「调仓计划」为止）：
 * - detectDrift：目标权重 vs 实际权重（含现金漂移）
 * - planRebalance：生成计划（run + orders；风险验证入库；不触碰资金）
 * - recordFill：人工/模拟成交回填 → 更新持仓与现金 → 重算 NAV（挂 basket.rebalance.execution 开关，默认关）
 * - executeRun：经 Execution Adapter（manual 默认不自动成交；paper 仅演示/测试）
 */
@Injectable()
export class BasketRebalanceService {
  private readonly log = new Logger(BasketRebalanceService.name)

  constructor(
    private readonly ds: DataSource,
    private readonly nav: BasketNavService,
    private readonly risk: BasketRiskService,
    private readonly operations: OperationalCapabilityService,
    private readonly ledger: LedgerService,
    @Inject(BASKET_EXECUTION_ADAPTER_TOKEN) private readonly adapter: BasketExecutionAdapter,
  ) {}

  async detectDrift(portfolioId: string, thresholdPct: number = BASKET_DEFAULTS.driftThresholdPct) {
    let [portfolio] = (await this.ds.query(
      `SELECT id, trim_scale(aum_usd)::text AS aum, trim_scale(cash_balance_usd)::text AS cash,
              trim_scale(nav_per_unit)::text AS nav, status
       FROM app.basket_portfolios WHERE id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    if (!portfolio) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })
    if (portfolio.aum === null) {
      await this.nav.computeNav(portfolioId)
      ;[portfolio] = (await this.ds.query(
        `SELECT id, trim_scale(aum_usd)::text AS aum, trim_scale(cash_balance_usd)::text AS cash,
                trim_scale(nav_per_unit)::text AS nav, status
         FROM app.basket_portfolios WHERE id = $1`,
        [portfolioId],
      )) as Array<Record<string, any>>
    }

    const net = parse18((portfolio.aum ?? '0') as string)
    const cash = parse18(portfolio.cash as string)
    const holdings = (await this.ds.query(
      `SELECT h.asset_id AS "assetId", a.slug, trim_scale(h.market_value_usd)::text AS "marketValueUsd",
              trim_scale(h.target_weight_pct)::text AS "targetWeightPct"
       FROM app.basket_holdings h JOIN app.rwa_assets a ON a.id = h.asset_id
       WHERE h.portfolio_id = $1 ORDER BY a.slug`,
      [portfolioId],
    )) as Array<Record<string, any>>

    const items: Array<Record<string, unknown>> = []
    let maxAbsDrift = 0
    for (const holding of holdings) {
      const target = Number(holding.targetWeightPct ?? 0)
      const actual = net > 0n ? Number(weightPct18(parse18((holding.marketValueUsd ?? '0') as string), net)) : 0
      const drift = actual - target
      maxAbsDrift = Math.max(maxAbsDrift, Math.abs(drift))
      items.push({ assetId: holding.assetId, slug: holding.slug, targetWeightPct: target, actualWeightPct: actual, driftPct: Math.round(drift * 10_000) / 10_000 })
    }
    const cashPct = net > 0n ? Number(weightPct18(cash, net)) : 0
    const needsRebalance = net > 0n && maxAbsDrift > thresholdPct
    return {
      portfolioId,
      netAssetValueUsd: format18(net),
      cashPct: Math.round(cashPct * 10_000) / 10_000,
      maxAbsDriftPct: Math.round(maxAbsDrift * 10_000) / 10_000,
      thresholdPct,
      needsRebalance,
      items,
    }
  }

  async planRebalance(portfolioId: string, options: PlanRebalanceOptions = {}) {
    const requestId = options.requestId ?? 'basket-rebalance-plan'
    const trigger = options.trigger ?? 'manual'
    const thresholdPct = options.driftThresholdPct ?? BASKET_DEFAULTS.driftThresholdPct
    const minTrade18 = parse18(String(options.minTradeUsd ?? BASKET_DEFAULTS.minTradeUsd))

    await this.nav.computeNav(portfolioId)
    const drift = await this.detectDrift(portfolioId, thresholdPct)
    if (trigger !== 'manual' && !drift.needsRebalance) {
      return { skipped: true, reason: 'Drift is within the threshold.', drift }
    }

    const [portfolio] = (await this.ds.query(
      `SELECT id, strategy_version_id AS "strategyVersionId", trim_scale(aum_usd)::text AS aum,
              trim_scale(nav_per_unit)::text AS nav, status
       FROM app.basket_portfolios WHERE id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    const net = parse18((portfolio.aum ?? '0') as string)
    if (net <= 0n) {
      return { skipped: true, reason: 'Portfolio has no assets to rebalance.', drift }
    }

    const targets = (await this.ds.query(
      `SELECT sa.asset_id AS "assetId", trim_scale(sa.target_weight_pct)::text AS "targetWeightPct"
       FROM app.basket_strategy_assets sa WHERE sa.strategy_version_id = $1`,
      [portfolio.strategyVersionId],
    )) as Array<{ assetId: string; targetWeightPct: string }>
    const holdings = (await this.ds.query(
      `SELECT h.asset_id AS "assetId", trim_scale(h.quantity)::text AS quantity,
              trim_scale(h.market_value_usd)::text AS "marketValueUsd",
              trim_scale(m.price_usd)::text AS price
       FROM app.basket_holdings h LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = h.asset_id
       WHERE h.portfolio_id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    const holdingByAsset = new Map(holdings.map((holding) => [holding.assetId as string, holding]))

    type PlannedOrder = { assetId: string; side: 'buy' | 'sell'; quantity: string; price: string }
    const planned: PlannedOrder[] = []
    let turnover = 0n
    for (const target of targets) {
      const holding = holdingByAsset.get(target.assetId)
      if (!holding) continue
      const price = (holding.price as string | null) ?? null
      if (!price) continue // 无行情不生成订单（风控会以数据覆盖率为由提示）
      const price18 = parse18(price)
      const targetValue = div18(mul18(net, parse18(target.targetWeightPct)), parse18('100'))
      const current = parse18((holding.marketValueUsd ?? '0') as string)
      const delta = sub18(targetValue, current)
      const absDelta = delta < 0n ? -delta : delta
      if (absDelta <= minTrade18) continue
      const driftPct = net > 0n ? Number(weightPct18(absDelta, net)) : 0
      if (driftPct <= thresholdPct) continue
      let quantity = div18(absDelta, price18)
      const side: 'buy' | 'sell' = delta > 0n ? 'buy' : 'sell'
      if (side === 'sell') {
        const available = parse18(holding.quantity as string)
        if (quantity > available) quantity = available
      }
      if (quantity <= 0n) continue
      if (mul18(quantity, price18) <= minTrade18) continue
      planned.push({ assetId: target.assetId, side, quantity: format18(quantity), price })
      turnover = add18(turnover, absDelta)
    }

    const runId = await this.ds.transaction(async (manager) => {
      const [run] = (await manager.query(
        `INSERT INTO app.basket_rebalance_runs (portfolio_id, strategy_version_id, trigger_type, status, pre_nav, reason)
         VALUES ($1, $2, $3, 'planned', $4, $5) RETURNING id`,
        [portfolioId, portfolio.strategyVersionId, trigger, portfolio.nav, `drift ${drift.maxAbsDriftPct}% > ${thresholdPct}%`],
      )) as Array<{ id: string }>
      if (planned.length) {
        const values: unknown[] = []
        const tuples = planned.map((order) => {
          const base = values.length
          values.push(run.id, order.assetId, order.side, order.quantity, order.price, String(BASKET_DEFAULTS.maxSlippagePct))
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, 'planned', 'manual')`
        })
        await manager.query(
          `INSERT INTO app.basket_rebalance_orders
             (rebalance_run_id, asset_id, side, target_quantity, estimated_price, max_slippage_pct, status, execution_route)
           VALUES ${tuples.join(', ')}`,
          values,
        )
      }
      await manager.query(
        `UPDATE app.basket_rebalance_runs SET estimated_turnover_pct = $2 WHERE id = $1`,
        [run.id, weightPct18(turnover, net)],
      )
      return run.id
    })

    const riskEvaluation = await this.risk.evaluateProposedOrders(runId)
    await this.ds.query(
      `UPDATE app.basket_rebalance_runs SET risk_evaluation = $2::jsonb WHERE id = $1`,
      [runId, JSON.stringify(riskEvaluation)],
    )
    if (requestId) {
      await this.audit(requestId, 'basket.rebalance.planned', runId, { portfolioId, trigger, orders: planned.length, risk: riskEvaluation.status })
    }
    return { skipped: false, runId, orders: planned, risk: riskEvaluation, drift, estimatedTurnoverPct: Number(weightPct18(turnover, net)) }
  }

  async getRun(runId: string): Promise<Record<string, any>> {
    const [run] = (await this.ds.query(
      `SELECT r.id, r.portfolio_id AS "portfolioId", r.trigger_type AS "triggerType", r.status,
              trim_scale(r.pre_nav)::text AS "preNav", trim_scale(r.post_nav)::text AS "postNav",
              trim_scale(r.estimated_turnover_pct)::text AS "estimatedTurnoverPct",
              trim_scale(r.actual_turnover_pct)::text AS "actualTurnoverPct",
              r.risk_evaluation AS "riskEvaluation", r.reason, r.started_at AS "startedAt", r.completed_at AS "completedAt",
              r.created_at AS "createdAt"
       FROM app.basket_rebalance_runs r WHERE r.id = $1`,
      [runId],
    )) as Array<Record<string, any>>
    if (!run) throw new NotFoundException({ code: BASKET_ERROR_CODES.REBALANCE_RUN_NOT_FOUND, message: 'Rebalance run was not found.' })
    const orders = await this.ds.query(
      `SELECT o.id, o.asset_id AS "assetId", a.slug, o.side,
              trim_scale(o.target_quantity)::text AS "targetQuantity",
              trim_scale(o.executed_quantity)::text AS "executedQuantity",
              trim_scale(o.estimated_price)::text AS "estimatedPrice",
              trim_scale(o.average_fill_price)::text AS "averageFillPrice",
              trim_scale(o.max_slippage_pct)::text AS "maxSlippagePct",
              o.status, o.execution_route AS "executionRoute", o.external_order_id AS "externalOrderId"
       FROM app.basket_rebalance_orders o JOIN app.rwa_assets a ON a.id = o.asset_id
       WHERE o.rebalance_run_id = $1 ORDER BY a.slug`,
      [runId],
    )
    return { ...run, orders }
  }

  async listRuns(portfolioId: string, limit = 20) {
    return this.ds.query(
      `SELECT id, trigger_type AS "triggerType", status, trim_scale(pre_nav)::text AS "preNav",
              trim_scale(post_nav)::text AS "postNav", created_at AS "createdAt", completed_at AS "completedAt"
       FROM app.basket_rebalance_runs WHERE portfolio_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [portfolioId, Math.min(Math.max(limit, 1), 100)],
    )
  }

  /** 成交回填（manual 模式核心：人工在场外完成后录入；paper 模式由适配器自动调用） */
  async recordFill(
    orderId: string,
    input: { executedQuantity: string; averageFillPrice: string; externalOrderId?: string },
    requestId = 'basket-fill',
  ) {
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.basketRebalanceExecution, 'Basket rebalance execution is currently disabled.')
    const quantityText = input.executedQuantity?.trim()
    const priceText = input.averageFillPrice?.trim()
    if (!quantityText || !QTY_PATTERN.test(quantityText) || parse18(quantityText) <= 0n) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Executed quantity must be a positive decimal.' })
    }
    if (!priceText || !PRICE_PATTERN.test(priceText) || parse18(priceText) <= 0n) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Average fill price must be a positive decimal.' })
    }

    const result = await this.ds.transaction(async (manager) => {
      const [order] = (await manager.query(
        `SELECT o.id, o.rebalance_run_id, o.asset_id, o.side, trim_scale(o.target_quantity)::text AS target_quantity,
                o.status, r.portfolio_id, r.status AS run_status
         FROM app.basket_rebalance_orders o
         JOIN app.basket_rebalance_runs r ON r.id = o.rebalance_run_id
         WHERE o.id = $1 FOR UPDATE OF o`,
        [orderId],
      )) as Array<Record<string, any>>
      if (!order) throw new NotFoundException({ code: BASKET_ERROR_CODES.ORDER_NOT_FOUND, message: 'Rebalance order was not found.' })
      if (order.status === 'filled') return { duplicate: true, orderId }
      if (!['planned', 'quoted', 'executing', 'partial'].includes(order.status as string)) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: `Order cannot be filled from status ${order.status}.` })
      }
      if (!['planned', 'running'].includes(order.run_status as string)) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.REBALANCE_RUN_NOT_EXECUTABLE, message: `Run is not executable from status ${order.run_status}.` })
      }

      const executed = parse18(quantityText)
      const price = parse18(priceText)
      const target = parse18(order.target_quantity as string)
      if (executed > target) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Executed quantity exceeds the planned quantity.' })
      }
      // 结算金额对齐 USDT 原子精度（与账本一致，对账零差异）
      const atomicNotional = toAtomicRounded(mul18(executed, price), 6)
      if (BigInt(atomicNotional) <= 0n) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Fill notional rounds to zero at USDT precision.' })
      }
      const notional = atomicTo18(atomicNotional, 6)

      // 账本同步：现金 ↔ 投资（幂等 basket_rebalance:<orderId>；现金不足由账本拒绝）
      try {
        await this.ledger.transferBasketInvestment({
          portfolioId: order.portfolio_id as string,
          direction: order.side === 'buy' ? 'invest' : 'divest',
          atomicAmount: atomicNotional,
          referenceId: orderId,
          requestId: `${requestId}:ledger`,
        })
      } catch (error) {
        if (isInsufficientLedgerBalance(error)) {
          throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Insufficient portfolio cash in the ledger to settle this fill.' })
        }
        throw error
      }

      const [holding] = (await manager.query(
        `SELECT id, trim_scale(quantity)::text AS quantity, trim_scale(cost_basis_usd)::text AS cost_basis
         FROM app.basket_holdings WHERE portfolio_id = $1 AND asset_id = $2 FOR UPDATE`,
        [order.portfolio_id, order.asset_id],
      )) as Array<Record<string, any>>
      if (!holding) throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Holding row is missing for this order.' })

      const holdingQty = parse18(holding.quantity as string)
      const costBasis = holding.cost_basis !== null ? parse18(holding.cost_basis as string) : null
      if (order.side === 'sell' && executed > holdingQty) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Executed sell quantity exceeds the current holding.' })
      }

      if (order.side === 'buy') {
        const [portfolioRow] = (await manager.query(
          `SELECT trim_scale(cash_balance_usd)::text AS cash FROM app.basket_portfolios WHERE id = $1 FOR UPDATE`,
          [order.portfolio_id],
        )) as Array<{ cash: string }>
        const cash = parse18(portfolioRow.cash)
        if (cash < notional) {
          throw new ConflictException({ code: BASKET_ERROR_CODES.ORDER_NOT_FILLABLE, message: 'Insufficient portfolio cash to settle this buy fill.' })
        }
        const newQty = add18(holdingQty, executed)
        const newCost = (costBasis ?? 0n) + notional
        await manager.query(
          `UPDATE app.basket_holdings SET quantity = $2, cost_basis_usd = $3, updated_at = now() WHERE id = $1`,
          [holding.id, format18(newQty), format18(newCost)],
        )
        await manager.query(
          `UPDATE app.basket_portfolios SET cash_balance_usd = cash_balance_usd - $2, updated_at = now() WHERE id = $1`,
          [order.portfolio_id, format18(notional)],
        )
      } else {
        const newQty = sub18(holdingQty, executed)
        let newCost: bigint | null = null
        if (costBasis !== null && holdingQty > 0n) {
          newCost = div18(mul18(costBasis, newQty), holdingQty)
        }
        await manager.query(
          `UPDATE app.basket_holdings SET quantity = $2, cost_basis_usd = $3, updated_at = now() WHERE id = $1`,
          [holding.id, format18(newQty), newCost === null ? null : format18(newCost)],
        )
        await manager.query(
          `UPDATE app.basket_portfolios SET cash_balance_usd = cash_balance_usd + $2, updated_at = now() WHERE id = $1`,
          [order.portfolio_id, format18(notional)],
        )
      }

      await manager.query(
        `UPDATE app.basket_rebalance_orders
         SET status = 'filled', executed_quantity = $2, average_fill_price = $3, external_order_id = $4, updated_at = now()
         WHERE id = $1`,
        [orderId, format18(executed), format18(price), input.externalOrderId ?? null],
      )
      await manager.query(
        `UPDATE app.basket_rebalance_runs SET status = 'running', started_at = COALESCE(started_at, now()) WHERE id = $1 AND status = 'planned'`,
        [order.rebalance_run_id],
      )
      return { duplicate: false, portfolioId: order.portfolio_id as string, runId: order.rebalance_run_id as string }
    })

    if (result.duplicate) return result

    // 刷新 NAV；若全部订单已成交则完成 run
    const navResult = await this.nav.computeNav(result.portfolioId as string)
    const [remaining] = (await this.ds.query(
      `SELECT COUNT(*)::int AS count FROM app.basket_rebalance_orders
       WHERE rebalance_run_id = $1 AND status NOT IN ('filled', 'cancelled', 'failed')`,
      [result.runId],
    )) as Array<{ count: number }>
    if (remaining.count === 0) {
      await this.ds.query(
        `UPDATE app.basket_rebalance_runs
         SET status = 'completed', completed_at = now(), post_nav = $2,
             actual_turnover_pct = estimated_turnover_pct
         WHERE id = $1 AND status IN ('planned', 'running')`,
        [result.runId, navResult.navPerUnit],
      )
    }
    await this.audit(requestId, 'basket.rebalance.fill', orderId, { executedQuantity: quantityText, averageFillPrice: priceText })
    return { duplicate: false, orderId, runCompleted: remaining.count === 0 }
  }

  /** 执行 run（经适配器；manual=null 等待人工回填；paper=立即模拟成交） */
  async executeRun(runId: string, requestId = 'basket-rebalance-execute') {
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.basketRebalanceExecution, 'Basket rebalance execution is currently disabled.')
    if (this.adapter.name === 'disabled') {
      throw new ConflictException({ code: BASKET_ERROR_CODES.EXECUTION_DISABLED, message: 'Execution adapter is disabled in this deployment.' })
    }
    const run = await this.getRun(runId)
    if (!['planned', 'running'].includes(run.status as string)) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.REBALANCE_RUN_NOT_EXECUTABLE, message: `Run cannot be executed from status ${run.status}.` })
    }
    const riskEvaluation = await this.risk.evaluateProposedOrders(runId)
    await this.ds.query(`UPDATE app.basket_rebalance_runs SET risk_evaluation = $2::jsonb WHERE id = $1`, [runId, JSON.stringify(riskEvaluation)])
    if (riskEvaluation.status === 'block') {
      throw new ConflictException({
        code: BASKET_ERROR_CODES.RISK_BLOCKED,
        message: 'Rebalance run is blocked by risk checks.',
        checks: riskEvaluation.checks.filter((check) => check.severity === 'block'),
      })
    }

    await this.ds.query(
      `UPDATE app.basket_rebalance_runs SET status = 'running', started_at = COALESCE(started_at, now()) WHERE id = $1 AND status = 'planned'`,
      [runId],
    )

    let executed = 0
    let pending = 0
    for (const order of (run.orders as Array<Record<string, any>>).filter((item) => item.status === 'planned')) {
      const fill = await this.adapter.executeOrder({
        id: order.id as string,
        assetId: order.assetId as string,
        side: order.side as 'buy' | 'sell',
        targetQuantity: order.targetQuantity as string,
        estimatedPrice: order.estimatedPrice as string | null,
        maxSlippagePct: order.maxSlippagePct as string | null,
      })
      if (!fill) {
        pending += 1
        continue
      }
      await this.recordFill(
        order.id as string,
        { executedQuantity: fill.executedQuantity, averageFillPrice: fill.averageFillPrice, externalOrderId: fill.externalOrderId ?? undefined },
        `${requestId}:${order.id}`,
      )
      executed += 1
    }
    await this.audit(requestId, 'basket.rebalance.execute', runId, { executed, pending, adapter: this.adapter.name })
    return { runId, adapter: this.adapter.name, executed, pending }
  }

  private async audit(requestId: string, action: string, objectId: string, metadata: Record<string, unknown>) {
    await this.ds.query(
      `INSERT INTO app.audit_logs (id, actor_type, action, object_type, object_id, request_id, metadata)
       VALUES ($1, 'service', $2, $3, $4, $5, $6)`,
      [randomUUID(), action, action.startsWith('basket.rebalance') ? 'basket_rebalance_run' : 'basket', objectId, requestId, JSON.stringify(metadata)],
    )
  }
}
