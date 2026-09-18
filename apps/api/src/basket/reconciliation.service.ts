import { Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { DataSource } from 'typeorm'
import { BASKET_ERROR_CODES } from './basket.constants'
import { add18, cmp18, div18, format18, parse18, sub18, toAtomicSigned } from './basket.decimals'

/**
 * Basket 对账（规格 §91-93；Phase 15）：
 * - 现金：组合结算账户（账本投影） ↔ 组合 cash_balance_usd（差异落 reconciliation_runs/cases 复用体系）
 * - 份数：Σ(settled 认购) − Σ(settled 赎回) ↔ portfolio.total_units
 * - NAV：重算值 ↔ 最新落库 NAV
 */
@Injectable()
export class BasketReconciliationService {
  constructor(private readonly ds: DataSource) {}

  async reconcilePortfolio(portfolioId: string, requestId = 'basket-reconciliation', actorAdminId?: string) {
    const [portfolio] = (await this.ds.query(
      `SELECT id, trim_scale(total_units)::text AS total_units, trim_scale(cash_balance_usd)::text AS cash,
              trim_scale(nav_per_unit)::text AS nav, trim_scale(aum_usd)::text AS aum
       FROM app.basket_portfolios WHERE id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    if (!portfolio) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })

    // 1) 现金对账
    const [account] = (await this.ds.query(
      `SELECT a.id, COALESCE(b.current_atomic_balance, 0)::text AS balance
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.owner_type = 'platform' AND a.owner_reference = $1 AND a.purpose = 'basket_settlement'`,
      [`basket:${portfolioId}`],
    )) as Array<{ id: string; balance: string }>
    const expectedAtomic = account?.balance ?? '0'
    const cash18 = parse18(portfolio.cash as string)
    const observedAtomic = toAtomicSigned(cash18, 6)
    const differenceAtomic = (BigInt(observedAtomic) - BigInt(expectedAtomic)).toString()

    const now = new Date()
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const periodEnd = new Date(periodStart.getTime() + 86_400_000 - 1) // 当日窗口（同日重跑幂等）
    const sourceReference = `basket-portfolio:${portfolioId}`
    const state = differenceAtomic === '0' ? 'matched' : 'differences_found'

    let runId: string
    let caseId: string | null = null
    let duplicate = false
    const inserted = (await this.ds.query(
      `INSERT INTO app.reconciliation_runs
         (id, provider, network, asset_code, asset_decimals, period_start, period_end,
          expected_atomic_balance, observed_atomic_balance, difference_atomic_amount, state, source_reference, request_id, completed_at)
       VALUES ($1, 'basket', NULL, 'USDT', 6, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (provider, network, asset_code, period_start, period_end, source_reference) DO NOTHING
       RETURNING id`,
      [randomUUID(), periodStart, periodEnd, expectedAtomic, observedAtomic, differenceAtomic, state, sourceReference, requestId],
    )) as Array<{ id: string }>

    if (inserted.length) {
      runId = inserted[0].id
      if (differenceAtomic !== '0' && account) {
        const [caseRow] = (await this.ds.query(
          `INSERT INTO app.reconciliation_cases
             (id, reconciliation_run_id, ledger_account_id, difference_atomic_amount, reason_code, evidence)
           VALUES ($1, $2, $3, $4, 'basket_cash_mismatch', $5)
           RETURNING id`,
          [randomUUID(), runId, account.id, differenceAtomic, JSON.stringify({ portfolioId, cashBalanceUsd: portfolio.cash })],
        )) as Array<{ id: string }>
        caseId = caseRow?.id ?? null
      }
    } else {
      const [existing] = (await this.ds.query(
        `SELECT id, state FROM app.reconciliation_runs
         WHERE provider = 'basket' AND network IS NULL AND asset_code = 'USDT'
           AND period_start = $1 AND period_end = $2 AND source_reference = $3`,
        [periodStart, periodEnd, sourceReference],
      )) as Array<{ id: string; state: string }>
      runId = existing.id
      duplicate = true
    }

    // 2) 份数对账
    const [unitsRow] = (await this.ds.query(
      `SELECT COALESCE(SUM(units), 0)::text AS expected FROM (
         SELECT COALESCE(units_issued, 0) AS units FROM app.basket_subscriptions WHERE portfolio_id = $1 AND status = 'settled'
         UNION ALL
         SELECT -units AS units FROM app.basket_redemptions WHERE portfolio_id = $1 AND status = 'settled'
       ) t`,
      [portfolioId],
    )) as Array<{ expected: string }>
    const unitsExpected = parse18(unitsRow.expected)
    const unitsObserved = parse18(portfolio.total_units as string)
    const unitsMatch = cmp18(unitsExpected, unitsObserved) === 0

    // 3) NAV 重算对账（Σ市值 + 现金 vs 落库 NAV×份数）
    const [agg] = (await this.ds.query(
      `SELECT COALESCE(SUM(market_value_usd), 0)::text AS market FROM app.basket_holdings WHERE portfolio_id = $1`,
      [portfolioId],
    )) as Array<{ market: string }>
    const recomputedNet = add18(parse18(agg.market), cash18)
    const storedNet = portfolio.aum !== null ? parse18(portfolio.aum as string) : 0n
    const navDifference = sub18(recomputedNet, storedNet)

    const checks = {
      cash: {
        ok: differenceAtomic === '0',
        expectedAtomic,
        observedAtomic,
        differenceAtomic,
      },
      units: {
        ok: unitsMatch,
        expected: format18(unitsExpected),
        observed: format18(unitsObserved),
      },
      nav: {
        ok: cmp18(navDifference, parse18('0.01')) <= 0 && cmp18(navDifference, parse18('-0.01')) >= 0,
        recomputedNetUsd: format18(recomputedNet),
        storedNetUsd: format18(storedNet),
        differenceUsd: format18(navDifference),
      },
    }

    await this.ds.query(
      `INSERT INTO app.audit_logs (id, actor_type, actor_id, action, object_type, object_id, request_id, metadata)
       VALUES ($1, $2, $3, 'basket.reconciliation.completed', 'basket_portfolio', $4, $5, $6)`,
      [
        randomUUID(),
        actorAdminId ? 'admin' : 'service',
        actorAdminId ?? null,
        portfolioId,
        requestId,
        JSON.stringify({ runId, state, differenceAtomic, unitsMatch, navDifferenceUsd: format18(navDifference), duplicate }),
      ],
    )

    return {
      portfolioId,
      runId,
      state,
      duplicate,
      caseId,
      checks,
    }
  }

  async listRuns(limit = 20) {
    return this.ds.query(
      `SELECT r.id, r.source_reference AS "sourceReference", r.state,
              r.expected_atomic_balance::text AS "expectedAtomicBalance",
              r.observed_atomic_balance::text AS "observedAtomicBalance",
              r.difference_atomic_amount::text AS "differenceAtomicAmount",
              r.created_at AS "createdAt", r.completed_at AS "completedAt",
              (SELECT COUNT(*)::int FROM app.reconciliation_cases c WHERE c.reconciliation_run_id = r.id) AS "caseCount"
       FROM app.reconciliation_runs r WHERE r.provider = 'basket'
       ORDER BY r.created_at DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 100)],
    )
  }
}
