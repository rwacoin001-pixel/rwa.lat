import { Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { BASKET_ERROR_CODES } from './basket.constants'
import { add18, div18, format18, mul18, parse18, weightPct18 } from './basket.decimals'

export type NavSnapshotResult = {
  portfolioId: string
  grossAssetValueUsd: string
  liabilitiesUsd: string
  netAssetValueUsd: string
  totalUnits: string
  navPerUnit: string
  cashUsd: string
  dataQuality: 'ok' | 'stale' | 'partial'
  pricingTimestamp: Date | null
  positions: number
}

const FRESH_MS = 48 * 3_600_000
const STALE_MS = 7 * 24 * 3_600_000

/**
 * NAV 引擎（规格 §59-66）：
 * NAV = Σ(持仓数量 × 最新价) + 现金 − 负债(0) ；NAV/Unit = NAV / 总份数（无份数时按 1 起价）。
 * 数据质量：全新鲜=ok；存在陈旧/缺失价=partial；任一行情超 7 天或缺价回退=stale。
 */
@Injectable()
export class BasketNavService {
  constructor(private readonly ds: DataSource) {}

  async computeNav(portfolioId: string): Promise<NavSnapshotResult> {
    return this.ds.transaction(async (manager) => {
      const [portfolio] = (await manager.query(
        `SELECT id, trim_scale(total_units)::text AS total_units, trim_scale(cash_balance_usd)::text AS cash,
                nav_per_unit
         FROM app.basket_portfolios WHERE id = $1 FOR UPDATE`,
        [portfolioId],
      )) as Array<{ id: string; total_units: string; cash: string }>
      if (!portfolio) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })

      const holdings = (await manager.query(
        `SELECT h.id, h.asset_id, h.quantity, h.cost_basis_usd, h.market_value_usd,
                m.price_usd, m.data_timestamp
         FROM app.basket_holdings h
         LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = h.asset_id
         WHERE h.portfolio_id = $1`,
        [portfolioId],
      )) as Array<Record<string, any>>

      const now = Date.now()
      let quality: 'ok' | 'stale' | 'partial' = 'ok'
      let latestPricing: Date | null = null
      let gross = 0n

      for (const holding of holdings) {
        const qty = parse18(holding.quantity as string)
        let value: bigint
        const price = holding.price_usd as string | null
        const priceAt = holding.data_timestamp ? new Date(holding.data_timestamp as string) : null
        if (price !== null && priceAt) {
          value = mul18(qty, parse18(price))
          if (!latestPricing || priceAt > latestPricing) latestPricing = priceAt
          if (now - priceAt.getTime() > STALE_MS) quality = 'stale'
          else if (now - priceAt.getTime() > FRESH_MS && quality === 'ok') quality = 'partial'
        } else {
          // 无行情：回退上一市值/成本，标记 stale
          const fallback = holding.market_value_usd ?? holding.cost_basis_usd ?? '0'
          value = parse18(fallback as string)
          if (quality !== 'stale') quality = 'stale'
        }
        gross = add18(gross, value)
        const actualWeight = weightPct18(value, gross === 0n ? 1n : gross) // 暂以当前累计为分母，稍后重算
        await manager.query(
          `UPDATE app.basket_holdings
           SET market_value_usd = $2, actual_weight_pct = $3,
               unrealized_pnl_usd = CASE WHEN cost_basis_usd IS NOT NULL THEN $2::numeric - cost_basis_usd END,
               updated_at = now()
           WHERE id = $1`,
          [holding.id, format18(value), actualWeight],
        )
      }

      const cash = parse18(portfolio.cash as string)
      const net = add18(gross, cash)
      const units = parse18(portfolio.total_units)
      const navPerUnit = units > 0n ? div18(net, units) : parse18('1')

      // 重算权重（分母 = 最终 gross）
      if (gross > 0n) {
        for (const holding of holdings) {
          const qty = parse18(holding.quantity as string)
          const price = holding.price_usd as string | null
          const value = price !== null ? mul18(qty, parse18(price)) : parse18((holding.market_value_usd ?? holding.cost_basis_usd ?? '0') as string)
          await manager.query(`UPDATE app.basket_holdings SET actual_weight_pct = $2 WHERE id = $1`, [
            holding.id,
            weightPct18(value, gross),
          ])
        }
      }

      await manager.query(
        `UPDATE app.basket_portfolios
         SET nav_per_unit = $2, aum_usd = $3, updated_at = now()
         WHERE id = $1`,
        [portfolioId, format18(navPerUnit), format18(net)],
      )
      const [snapshot] = (await manager.query(
        `INSERT INTO app.basket_nav_snapshots
           (portfolio_id, gross_asset_value_usd, liabilities_usd, net_asset_value_usd, total_units, nav_per_unit, cash_usd, data_quality, pricing_timestamp)
         VALUES ($1, $2, 0, $3, $4, $5, $6, $7, $8)
         RETURNING id, timestamp`,
        [
          portfolioId,
          format18(gross),
          format18(net),
          format18(units),
          format18(navPerUnit),
          format18(cash),
          quality,
          latestPricing,
        ],
      )) as Array<Record<string, any>>

      return {
        portfolioId,
        grossAssetValueUsd: format18(gross),
        liabilitiesUsd: '0.000000000000000000',
        netAssetValueUsd: format18(net),
        totalUnits: format18(units),
        navPerUnit: format18(navPerUnit),
        cashUsd: format18(cash),
        dataQuality: quality,
        pricingTimestamp: latestPricing,
        positions: holdings.length,
      }
    })
  }

  async getLatestSnapshot(portfolioId: string) {
    const [row] = (await this.ds.query(
      `SELECT trim_scale(gross_asset_value_usd)::text AS "grossAssetValueUsd",
              trim_scale(net_asset_value_usd)::text AS "netAssetValueUsd",
              trim_scale(total_units)::text AS "totalUnits",
              trim_scale(nav_per_unit)::text AS "navPerUnit",
              trim_scale(cash_usd)::text AS "cashUsd",
              data_quality AS "dataQuality", pricing_timestamp AS "pricingTimestamp", timestamp
       FROM app.basket_nav_snapshots WHERE portfolio_id = $1 ORDER BY timestamp DESC LIMIT 1`,
      [portfolioId],
    )) as Array<Record<string, unknown>>
    return row ?? null
  }

  /** 用户当前持有份数的参考估值（NAV/Unit × 份数） */
  async valueUserUnits(portfolioId: string, units: string): Promise<string> {
    const snapshot = await this.getLatestSnapshot(portfolioId)
    const nav = snapshot?.navPerUnit ? parse18(snapshot.navPerUnit as string) : parse18('1')
    return format18(mul18(parse18(units), nav))
  }
}
