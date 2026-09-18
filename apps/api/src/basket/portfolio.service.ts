import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { BASKET_ERROR_CODES } from './basket.constants'
import { BasketStrategyService } from './strategy.service'

export type CreatePortfolioInput = {
  strategyId?: string
  strategySlug?: string
  name: string
  status?: 'draft' | 'pilot'
}

/** 组合服务（规格 §53-58）：BasketPortfolio + Holdings 生命周期 */
@Injectable()
export class BasketPortfolioService {
  constructor(
    private readonly ds: DataSource,
    private readonly strategies: BasketStrategyService,
  ) {}

  /** 从策略的激活版本创建组合（种子持仓：数量 0 + 目标权重） */
  async createPortfolio(input: CreatePortfolioInput) {
    let strategyId = input.strategyId ?? null
    if (!strategyId && input.strategySlug) {
      const [row] = (await this.ds.query(`SELECT id FROM app.basket_strategies WHERE slug = $1`, [input.strategySlug])) as Array<{ id: string }>
      strategyId = row?.id ?? null
    }
    if (!strategyId) throw new NotFoundException({ code: BASKET_ERROR_CODES.STRATEGY_NOT_FOUND, message: 'Basket strategy was not found.' })

    const activeVersion = await this.strategies.getActiveVersion(strategyId)
    if (!activeVersion) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.NO_ACTIVE_VERSION, message: 'The strategy has no active version. Generate and activate a target allocation first.' })
    }
    const targets = await this.strategies.getVersionAssets(activeVersion.id as string)
    if (!targets.length) {
      throw new ConflictException({ code: BASKET_ERROR_CODES.ALLOCATION_EMPTY, message: 'The active strategy version has an empty target allocation.' })
    }

    return this.ds.transaction(async (manager) => {
      const [portfolio] = (await manager.query(
        `INSERT INTO app.basket_portfolios (strategy_id, strategy_version_id, name, status, base_currency, total_units, nav_per_unit, cash_balance_usd)
         VALUES ($1, $2, $3, $4, 'USDT', 0, 1, 0)
         RETURNING id, name, status`,
        [strategyId, activeVersion.id, input.name, input.status ?? 'pilot'],
      )) as Array<Record<string, unknown>>
      const values: unknown[] = []
      const tuples = (targets as Array<Record<string, any>>).map((target) => {
        const base = values.length
        values.push(portfolio.id, target.assetId, target.targetWeightPct)
        return `($${base + 1}, $${base + 2}, null, 0, $${base + 3})`
      })
      await manager.query(
        `INSERT INTO app.basket_holdings (portfolio_id, asset_id, network_id, quantity, target_weight_pct)
         VALUES ${tuples.join(', ')}
         ON CONFLICT (portfolio_id, asset_id, network_id) DO UPDATE SET target_weight_pct = EXCLUDED.target_weight_pct, updated_at = now()`,
        values,
      )
      return { ...portfolio, strategyId, strategyVersionId: activeVersion.id, holdingsSeeded: targets.length } as Record<string, any>
    })
  }

  async setStatus(portfolioId: string, status: 'draft' | 'pilot' | 'active' | 'closed') {
    const [row] = (await this.ds.query(
      `UPDATE app.basket_portfolios SET status = $2, updated_at = now() WHERE id = $1
       RETURNING id, name, status, nav_per_unit AS "navPerUnit"`,
      [portfolioId, status],
    )) as Array<Record<string, unknown>>
    if (!row) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })
    return row
  }

  async getPortfolio(portfolioId: string) {
    const [row] = (await this.ds.query(
      `SELECT p.id, p.name, p.status, p.strategy_id AS "strategyId", p.strategy_version_id AS "strategyVersionId",
              s.slug AS "strategySlug", s.name AS "strategyName", s.risk_level AS "riskLevel",
              trim_scale(p.total_units)::text AS "totalUnits",
              trim_scale(p.nav_per_unit)::text AS "navPerUnit",
              trim_scale(p.aum_usd)::text AS "aumUsd",
              trim_scale(p.cash_balance_usd)::text AS "cashBalanceUsd",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM app.basket_portfolios p
       JOIN app.basket_strategies s ON s.id = p.strategy_id
       WHERE p.id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    if (!row) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })
    return row
  }

  async listPortfolios(includeClosed = false) {
    return this.ds.query(
      `SELECT p.id, p.name, p.status, s.slug AS "strategySlug", s.name AS "strategyName", s.risk_level AS "riskLevel",
              trim_scale(p.total_units)::text AS "totalUnits",
              trim_scale(p.nav_per_unit)::text AS "navPerUnit",
              trim_scale(p.aum_usd)::text AS "aumUsd",
              trim_scale(s.minimum_subscription_usd)::text AS "minimumSubscriptionUsd",
              p.created_at AS "createdAt"
       FROM app.basket_portfolios p
       JOIN app.basket_strategies s ON s.id = p.strategy_id
       WHERE ($1 = true OR p.status IN ('pilot', 'active'))
       ORDER BY p.created_at ASC`,
      [includeClosed],
    )
  }

  async listHoldings(portfolioId: string) {
    return this.ds.query(
      `SELECT h.asset_id AS "assetId", a.slug, a.name, a.asset_class AS "assetClass",
              trim_scale(h.quantity)::text AS quantity,
              trim_scale(h.cost_basis_usd)::text AS "costBasisUsd",
              trim_scale(h.market_value_usd)::text AS "marketValueUsd",
              trim_scale(h.target_weight_pct)::text AS "targetWeightPct",
              trim_scale(h.actual_weight_pct)::text AS "actualWeightPct",
              trim_scale(h.unrealized_pnl_usd)::text AS "unrealizedPnlUsd",
              trim_scale(m.price_usd)::text AS "priceUsd",
              m.data_timestamp AS "priceTimestamp"
       FROM app.basket_holdings h
       JOIN app.rwa_assets a ON a.id = h.asset_id
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = h.asset_id
       WHERE h.portfolio_id = $1
       ORDER BY h.target_weight_pct DESC NULLS LAST, a.slug`,
      [portfolioId],
    )
  }

  /** 用户持有份数（settled 订阅 − settled 赎回） */
  async getUserUnits(portfolioId: string, userId: string): Promise<string> {
    const [row] = (await this.ds.query(
      `SELECT COALESCE(SUM(units), 0)::text AS units FROM (
         SELECT COALESCE(units_issued, 0) AS units FROM app.basket_subscriptions
         WHERE portfolio_id = $1 AND user_id = $2 AND status = 'settled'
         UNION ALL
         SELECT -units AS units FROM app.basket_redemptions
         WHERE portfolio_id = $1 AND user_id = $2 AND status = 'settled'
       ) t`,
      [portfolioId, userId],
    )) as Array<{ units: string }>
    return row?.units ?? '0'
  }

  async getPortfolioDetail(portfolioId: string, userId?: string) {
    const portfolio = await this.getPortfolio(portfolioId)
    const [holdings, snapshots, targets] = await Promise.all([
      this.listHoldings(portfolioId),
      this.ds.query(
        `SELECT gav.raw AS "grossAssetValueUsd", gav.nav, gav.ts AS timestamp, gav.quality FROM (
           SELECT trim_scale(gross_asset_value_usd)::text AS raw,
                  trim_scale(nav_per_unit)::text AS nav,
                  timestamp, data_quality AS quality
           FROM app.basket_nav_snapshots WHERE portfolio_id = $1 ORDER BY timestamp DESC LIMIT 10
         ) gav`,
        [portfolioId],
      ),
      this.ds.query(
        `SELECT sa.asset_id AS "assetId", trim_scale(sa.target_weight_pct)::text AS "targetWeightPct"
         FROM app.basket_strategy_assets sa WHERE sa.strategy_version_id = $1`,
        [portfolio.strategyVersionId],
      ),
    ])
    const userUnits = userId ? await this.getUserUnits(portfolioId, userId) : null
    return { ...portfolio, holdings, navHistory: snapshots, userUnits }
  }
}
