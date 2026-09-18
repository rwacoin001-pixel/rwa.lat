import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { LedgerService } from '../ledger/ledger.service'
import { OperationalCapabilityService, OPERATIONAL_SWITCH_KEYS } from '../operations/operational-capability.service'
import { BASKET_ERROR_CODES, isInsufficientLedgerBalance } from './basket.constants'
import { atomicTo18, div18, format18, mul18, parse18, sub18, toAtomic, toAtomicRounded } from './basket.decimals'
import { BasketNavService } from './basket.nav.service'
import { BasketPortfolioService } from './portfolio.service'
import { BasketRiskService } from './risk.service'

const AMOUNT_PATTERN = /^\d+(\.\d{1,6})?$/
const UNITS_PATTERN = /^\d+(\.\d{1,8})?$/

/**
 * 申赎服务（规格 §67-72）：
 * - 挂现有 operational switch（basket.subscriptions / basket.redemptions，默认关闭）
 * - 资金走现有复式账本（LedgerService.transferBasketSettlement；用户可用 ↔ 组合结算账户）
 * - 幂等：basket_subscriptions/redemptions.idempotency_key 唯一；账本交易幂等键 = 引用记录
 * - 申购价 = 最新 NAV/份（无份数按 1 起价）；赎回按最新 NAV 结算
 */
@Injectable()
export class BasketSubscriptionService {
  private readonly log = new Logger(BasketSubscriptionService.name)

  constructor(
    private readonly ds: DataSource,
    private readonly ledger: LedgerService,
    private readonly operations: OperationalCapabilityService,
    private readonly portfolios: BasketPortfolioService,
    private readonly nav: BasketNavService,
    private readonly risk: BasketRiskService,
  ) {}

  async subscribe(
    userId: string,
    portfolioId: string,
    input: { amountUsd: string },
    idempotencyKey: string,
    requestId: string,
  ) {
    const amount = input.amountUsd?.trim()
    if (!amount || !AMOUNT_PATTERN.test(amount) || parse18(amount) <= 0n) {
      throw new BadRequestException({ code: BASKET_ERROR_CODES.AMOUNT_INVALID, message: 'Subscription amount must be a positive decimal with up to 6 places.' })
    }
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.basketSubscriptions, 'Basket subscriptions are currently disabled.')

    const existing = await this.findByIdempotency('basket_subscriptions', idempotencyKey, userId)
    if (existing) return { duplicate: true, subscription: existing }

    const portfolio = await this.portfolios.getPortfolio(portfolioId)
    if (!['pilot', 'active'].includes(portfolio.status as string)) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_ACTIVE, message: `Portfolio is not open for subscriptions (status=${portfolio.status}).` })
    }
    await this.assertDisclosureAcknowledged(userId, portfolio.strategyId as string)

    // 风控闸门：block 级组合风险禁止新增申购（规格 §77）
    const riskEvaluation = await this.risk.evaluatePortfolio(portfolioId)
    if (riskEvaluation.status === 'block') {
      throw new ConflictException({
        code: BASKET_ERROR_CODES.RISK_BLOCKED,
        message: 'This portfolio is temporarily blocked by risk checks for new subscriptions.',
        checks: riskEvaluation.checks.filter((check) => check.severity === 'block'),
      })
    }

    const amount18 = parse18(amount)
    const [strategyRow] = (await this.ds.query(
      `SELECT trim_scale(minimum_subscription_usd)::text AS minimum FROM app.basket_strategies WHERE id = $1`,
      [portfolio.strategyId],
    )) as Array<{ minimum: string | null }>
    if (strategyRow?.minimum && amount18 < parse18(strategyRow.minimum)) {
      throw new BadRequestException({ code: BASKET_ERROR_CODES.AMOUNT_INVALID, message: `Amount is below the minimum subscription of ${strategyRow.minimum} USDT.` })
    }

    // 1) 创建 pending 记录（幂等锚点）
    const subscriptionId = await this.insertPending('basket_subscriptions', userId, portfolioId, amount18, idempotencyKey)

    // 2) 计价（最新 NAV；无份数按 1 起价）
    const navPerUnit = await this.currentNavPerUnit(portfolioId)
    if (!navPerUnit) throw new ConflictException({ code: BASKET_ERROR_CODES.NAV_UNAVAILABLE, message: 'Portfolio NAV is not available yet.' })
    const units = div18(amount18, navPerUnit)
    if (units <= 0n) throw new BadRequestException({ code: BASKET_ERROR_CODES.AMOUNT_INVALID, message: 'Amount is too small to issue any basket units.' })

    // 3) 账本划转（用户可用 → 组合结算；余额不足由账本拒绝 → 409）
    let transfer: { ledgerTransactionId: string | null; duplicate: boolean }
    try {
      transfer = await this.ledger.transferBasketSettlement({
        userId,
        portfolioId,
        direction: 'subscription',
        atomicAmount: toAtomic(amount18, 6),
        referenceType: 'basket_subscription',
        referenceId: subscriptionId,
        requestId,
      })
    } catch (error) {
      if (isInsufficientLedgerBalance(error)) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.INSUFFICIENT_UNITS, message: 'Insufficient available balance for this subscription.' })
      }
      throw error
    }

    // 4) 结算：更新记录 + 组合聚合（份数增加、现金增加、NAV/份不变）
    const settled = await this.ds.transaction(async (manager) => {
      const updated = (await manager.query(
        `UPDATE app.basket_subscriptions
         SET status = 'settled', nav_per_unit = $2, units_issued = $3, priced_at = now(), settled_at = now(), ledger_reference = $4
         WHERE id = $1 AND status IN ('pending', 'accepted', 'pricing', 'investing')
         RETURNING id`,
        [subscriptionId, format18(navPerUnit), format18(units), transfer.ledgerTransactionId],
      )) as Array<{ id: string }>
      const [row] = (await manager.query(
        `SELECT id, status, trim_scale(amount_usd)::text AS "amountUsd", trim_scale(units_issued)::text AS "unitsIssued",
                trim_scale(nav_per_unit)::text AS "navPerUnit", settled_at AS "settledAt"
         FROM app.basket_subscriptions WHERE id = $1`,
        [subscriptionId],
      )) as Array<Record<string, unknown>>
      if (!updated.length) {
        // 已被并发结算 → 返回当前记录
        return row
      }
      await manager.query(
        `UPDATE app.basket_portfolios
         SET cash_balance_usd = cash_balance_usd + $2, total_units = total_units + $3, updated_at = now()
         WHERE id = $1`,
        [portfolioId, format18(amount18), format18(units)],
      )
      await manager.query(
        `INSERT INTO app.audit_logs (id, actor_type, user_id, action, object_type, object_id, request_id, metadata)
         VALUES ($1, 'service', $2, 'basket.subscription.settled', 'basket_subscription', $3, $4, $5)`,
        [
          randomUUID(),
          userId,
          subscriptionId,
          requestId,
          JSON.stringify({ portfolioId, amountUsd: format18(amount18), unitsIssued: format18(units), navPerUnit: format18(navPerUnit), ledgerTransactionId: transfer.ledgerTransactionId }),
        ],
      )
      return row
    })

    // 5) 刷新 NAV 快照（保持 aum/nav 与聚合一致）
    try {
      await this.nav.computeNav(portfolioId)
    } catch (error) {
      this.log.warn(`Post-subscription NAV refresh failed: ${(error as Error).message}`)
    }
    return { duplicate: false, subscription: settled }
  }

  async redeem(
    userId: string,
    portfolioId: string,
    input: { units: string },
    idempotencyKey: string,
    requestId: string,
  ) {
    const unitsText = input.units?.trim()
    if (!unitsText || !UNITS_PATTERN.test(unitsText) || parse18(unitsText) <= 0n) {
      throw new BadRequestException({ code: BASKET_ERROR_CODES.UNITS_INVALID, message: 'Redemption units must be a positive decimal with up to 8 places.' })
    }
    await this.operations.assertEnabled(OPERATIONAL_SWITCH_KEYS.basketRedemptions, 'Basket redemptions are currently disabled.')
    this.assertIdempotencyKey(idempotencyKey)

    const existing = await this.findByIdempotency('basket_redemptions', idempotencyKey, userId)
    if (existing) return { duplicate: true, redemption: existing }

    const portfolio = await this.portfolios.getPortfolio(portfolioId)
    if (!['pilot', 'active'].includes(portfolio.status as string)) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_ACTIVE, message: `Portfolio is not open for redemptions (status=${portfolio.status}).` })
    }

    const units18 = parse18(unitsText)
    const userUnits = parse18(await this.portfolios.getUserUnits(portfolioId, userId))
    if (units18 > userUnits) {
      throw new ConflictException({
        code: BASKET_ERROR_CODES.INSUFFICIENT_UNITS,
        message: `You hold ${format18(userUnits)} units, which is less than the requested redemption.`,
      })
    }

    const navPerUnit = await this.currentNavPerUnit(portfolioId)
    if (!navPerUnit) throw new ConflictException({ code: BASKET_ERROR_CODES.NAV_UNAVAILABLE, message: 'Portfolio NAV is not available yet.' })
    const gross = mul18(units18, navPerUnit)
    const fees = 0n // v1 费率 0（列为后续策略配置）
    const netRaw = sub18(gross, fees)
    if (netRaw <= 0n) throw new BadRequestException({ code: BASKET_ERROR_CODES.UNITS_INVALID, message: 'Redemption value rounds to zero.' })
    // 结算金额对齐到 USDT 原子精度（与账本一致，保证对账零差异）
    const atomicNet = toAtomicRounded(netRaw, 6)
    if (BigInt(atomicNet) <= 0n) throw new BadRequestException({ code: BASKET_ERROR_CODES.UNITS_INVALID, message: 'Redemption value rounds to zero.' })
    const net = atomicTo18(atomicNet, 6)

    const redemptionId = await this.insertPending('basket_redemptions', userId, portfolioId, null, idempotencyKey, units18)
    let transfer: { ledgerTransactionId: string | null; duplicate: boolean }
    try {
      transfer = await this.ledger.transferBasketSettlement({
        userId,
        portfolioId,
        direction: 'redemption',
        atomicAmount: atomicNet,
        referenceType: 'basket_redemption',
        referenceId: redemptionId,
        requestId,
      })
    } catch (error) {
      if (isInsufficientLedgerBalance(error)) {
        throw new ConflictException({ code: BASKET_ERROR_CODES.INSUFFICIENT_UNITS, message: 'The portfolio has insufficient cash to settle this redemption. Please retry later.' })
      }
      throw error
    }

    const settled = await this.ds.transaction(async (manager) => {
      const updated = (await manager.query(
        `UPDATE app.basket_redemptions
         SET status = 'settled', nav_per_unit = $2, gross_amount_usd = $3, fees_usd = $4, net_amount_usd = $5,
             priced_at = now(), settled_at = now(), ledger_reference = $6
         WHERE id = $1 AND status IN ('pending', 'accepted', 'pricing', 'investing')
         RETURNING id`,
        [redemptionId, format18(navPerUnit), format18(gross), format18(fees), format18(net), transfer.ledgerTransactionId],
      )) as Array<{ id: string }>
      const [row] = (await manager.query(
        `SELECT id, status, trim_scale(units)::text AS units, trim_scale(net_amount_usd)::text AS "netAmountUsd",
                trim_scale(nav_per_unit)::text AS "navPerUnit", settled_at AS "settledAt"
         FROM app.basket_redemptions WHERE id = $1`,
        [redemptionId],
      )) as Array<Record<string, unknown>>
      if (!updated.length) {
        return row
      }
      await manager.query(
        `UPDATE app.basket_portfolios
         SET cash_balance_usd = cash_balance_usd - $2, total_units = total_units - $3, updated_at = now()
         WHERE id = $1`,
        [portfolioId, format18(net), format18(units18)],
      )
      await manager.query(
        `INSERT INTO app.audit_logs (id, actor_type, user_id, action, object_type, object_id, request_id, metadata)
         VALUES ($1, 'service', $2, 'basket.redemption.settled', 'basket_redemption', $3, $4, $5)`,
        [
          randomUUID(),
          userId,
          redemptionId,
          requestId,
          JSON.stringify({ portfolioId, units: format18(units18), netAmountUsd: format18(net), navPerUnit: format18(navPerUnit), ledgerTransactionId: transfer.ledgerTransactionId }),
        ],
      )
      return row
    })

    try {
      await this.nav.computeNav(portfolioId)
    } catch (error) {
      this.log.warn(`Post-redemption NAV refresh failed: ${(error as Error).message}`)
    }
    return { duplicate: false, redemption: settled }
  }

  async listUserSubscriptions(userId: string, limit = 20) {
    return this.ds.query(
      `SELECT s.id, s.portfolio_id AS "portfolioId", p.name AS "portfolioName", s.status,
              trim_scale(s.amount_usd)::text AS "amountUsd", trim_scale(s.units_issued)::text AS "unitsIssued",
              trim_scale(s.nav_per_unit)::text AS "navPerUnit", s.requested_at AS "requestedAt", s.settled_at AS "settledAt"
       FROM app.basket_subscriptions s JOIN app.basket_portfolios p ON p.id = s.portfolio_id
       WHERE s.user_id = $1 ORDER BY s.requested_at DESC LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    )
  }

  async listUserRedemptions(userId: string, limit = 20) {
    return this.ds.query(
      `SELECT r.id, r.portfolio_id AS "portfolioId", p.name AS "portfolioName", r.status,
              trim_scale(r.units)::text AS units, trim_scale(r.net_amount_usd)::text AS "netAmountUsd",
              trim_scale(r.nav_per_unit)::text AS "navPerUnit", r.requested_at AS "requestedAt", r.settled_at AS "settledAt"
       FROM app.basket_redemptions r JOIN app.basket_portfolios p ON p.id = r.portfolio_id
       WHERE r.user_id = $1 ORDER BY r.requested_at DESC LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 100)],
    )
  }

  // ---- 风险披露 ----
  async createDisclosure(input: { title: string; content: string; strategyId?: string; productType?: string }) {
    const [row] = (await this.ds.query(
      `INSERT INTO app.risk_disclosures (product_type, strategy_id, version, title, content)
       SELECT $4, $3, COALESCE(MAX(version), 0) + 1, $1, $2
       FROM app.risk_disclosures WHERE strategy_id IS NOT DISTINCT FROM $3::uuid
       RETURNING id, version, title, effective_from AS "effectiveFrom"`,
      [input.title, input.content, input.strategyId ?? null, input.productType ?? 'basket'],
    )) as Array<Record<string, unknown>>
    return row
  }

  async listDisclosures(strategyId?: string) {
    return this.ds.query(
      `SELECT id, product_type AS "productType", strategy_id AS "strategyId", version, title, content,
              effective_from AS "effectiveFrom"
       FROM app.risk_disclosures
       WHERE ($1::uuid IS NULL OR strategy_id = $1) ORDER BY version DESC LIMIT 20`,
      [strategyId ?? null],
    )
  }

  async acknowledgeDisclosure(userId: string, disclosureId: string, meta: { ipHash?: string; userAgent?: string }) {
    const [disclosure] = (await this.ds.query(
      `SELECT id, version FROM app.risk_disclosures WHERE id = $1`,
      [disclosureId],
    )) as Array<{ id: string; version: number }>
    if (!disclosure) throw new NotFoundException({ code: BASKET_ERROR_CODES.DISCLOSURE_ACK_REQUIRED, message: 'Risk disclosure was not found.' })
    const [row] = (await this.ds.query(
      `INSERT INTO app.user_risk_acknowledgements (user_id, disclosure_id, version, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, disclosure_id) DO NOTHING
       RETURNING id, accepted_at AS "acceptedAt"`,
      [userId, disclosureId, disclosure.version, meta.ipHash ?? null, meta.userAgent ?? null],
    )) as Array<Record<string, unknown>>
    return row ? { acknowledged: true, ...row } : { acknowledged: true, duplicate: true }
  }

  private async assertDisclosureAcknowledged(userId: string, strategyId: string) {
    // 确定性选择：优先该策略的最新披露；无策略披露时用全局 basket 披露。
    // （ORDER BY 含 id 兜底，避免同版本并列时结果不确定）
    const [latest] = (await this.ds.query(
      `SELECT id FROM app.risk_disclosures
       WHERE strategy_id = $1 OR (strategy_id IS NULL AND product_type = 'basket')
       ORDER BY (strategy_id = $1) DESC NULLS LAST, version DESC, effective_from DESC, id DESC
       LIMIT 1`,
      [strategyId],
    )) as Array<{ id: string }>
    if (!latest) return
    const [ack] = (await this.ds.query(
      `SELECT 1 AS ok FROM app.user_risk_acknowledgements WHERE user_id = $1 AND disclosure_id = $2`,
      [userId, latest.id],
    )) as Array<{ ok: number }>
    if (!ack) {
      throw new ConflictException({
        code: BASKET_ERROR_CODES.DISCLOSURE_ACK_REQUIRED,
        message: 'You must acknowledge the latest risk disclosure before subscribing.',
        disclosureId: latest.id,
      })
    }
  }

  private async currentNavPerUnit(portfolioId: string): Promise<bigint | null> {
    const snapshot = await this.nav.getLatestSnapshot(portfolioId)
    if (snapshot?.navPerUnit) return parse18(snapshot.navPerUnit as string)
    const [portfolio] = (await this.ds.query(
      `SELECT trim_scale(nav_per_unit)::text AS nav, trim_scale(total_units)::text AS units FROM app.basket_portfolios WHERE id = $1`,
      [portfolioId],
    )) as Array<{ nav: string | null; units: string }>
    if (!portfolio) return null
    if (portfolioUnitsIsZero(portfolio.units)) return parse18('1') // 无份数 → 起价 1
    return portfolio.nav ? parse18(portfolio.nav) : null
  }

  private async insertPending(
    table: 'basket_subscriptions' | 'basket_redemptions',
    userId: string,
    portfolioId: string,
    amount18: bigint | null,
    idempotencyKey: string,
    units18?: bigint,
  ): Promise<string> {
    this.assertIdempotencyKey(idempotencyKey)
    try {
      if (table === 'basket_subscriptions') {
        const [row] = (await this.ds.query(
          `INSERT INTO app.basket_subscriptions (user_id, portfolio_id, amount_usd, status, idempotency_key)
           VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
          [userId, portfolioId, format18(amount18 as bigint), idempotencyKey],
        )) as Array<{ id: string }>
        return row.id
      }
      const [row] = (await this.ds.query(
        `INSERT INTO app.basket_redemptions (user_id, portfolio_id, units, status, idempotency_key)
         VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
        [userId, portfolioId, format18(units18 as bigint), idempotencyKey],
      )) as Array<{ id: string }>
      return row.id
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findByIdempotency(table, idempotencyKey, userId)
        if (existing) throw new ConflictException({ code: 'BASKET_DUPLICATE_REQUEST', message: 'Duplicate request.', existing })
      }
      throw error
    }
  }

  private async findByIdempotency(
    table: 'basket_subscriptions' | 'basket_redemptions',
    idempotencyKey: string,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    if (!idempotencyKey) return null
    const [row] = (await this.ds.query(
      `SELECT * FROM app.${table} WHERE idempotency_key = $1 AND user_id = $2 LIMIT 1`,
      [idempotencyKey, userId],
    )) as Array<Record<string, unknown>>
    return row ?? null
  }

  private assertIdempotencyKey(key: string) {
    if (!key || key.trim().length < 8 || key.trim().length > 160) {
      throw new BadRequestException({ code: BASKET_ERROR_CODES.AMOUNT_INVALID, message: 'An Idempotency-Key header (8-160 chars) is required.' })
    }
  }
}

function portfolioUnitsIsZero(units: string): boolean {
  return parse18(units) === 0n
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505'
}
