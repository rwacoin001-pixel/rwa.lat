import { Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { BASKET_DEFAULTS, BASKET_ERROR_CODES } from './basket.constants'
import { add18, format18, mul18, parse18, weightPct18 } from './basket.decimals'

export type RiskSeverity = 'info' | 'warn' | 'block'

export type RiskCheck = {
  code: string
  severity: RiskSeverity
  message: string
  data?: Record<string, unknown>
}

export type RiskEvaluation = {
  scope: 'portfolio' | 'rebalance-run'
  subjectId: string
  status: 'ok' | 'warn' | 'block'
  checks: RiskCheck[]
  evaluatedAt: string
}

const THIN_VOLUME_USD = 1_000_000
const STALE_PRICE_MS = 72 * 3_600_000

/**
 * 风控引擎（规格 §73-77；确定性）：
 * - 组合级：负现金/无 NAV/数据覆盖/数据陈旧/资产·发行人集中度/流动性/受限资产
 * - 调仓级：卖出超持仓/买入超现金+卖出回款/高换手/单笔占比
 * block 阻断资金动作（申购校验 + 执行闸门），warn 仅提示。
 */
@Injectable()
export class BasketRiskService {
  constructor(private readonly ds: DataSource) {}

  async evaluatePortfolio(portfolioId: string): Promise<RiskEvaluation> {
    const [portfolio] = (await this.ds.query(
      `SELECT p.id, trim_scale(p.total_units)::text AS total_units, trim_scale(p.cash_balance_usd)::text AS cash,
              trim_scale(p.aum_usd)::text AS aum, trim_scale(p.nav_per_unit)::text AS nav,
              trim_scale(s.cash_buffer_target_pct)::text AS cash_buffer_target_pct
       FROM app.basket_portfolios p
       JOIN app.basket_strategies s ON s.id = p.strategy_id
       WHERE p.id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>
    if (!portfolio) throw new NotFoundException({ code: BASKET_ERROR_CODES.PORTFOLIO_NOT_FOUND, message: 'Basket portfolio was not found.' })

    const holdings = (await this.ds.query(
      `SELECT h.asset_id, h.quantity, trim_scale(h.market_value_usd)::text AS market_value,
              trim_scale(h.actual_weight_pct)::text AS actual_weight,
              trim_scale(h.target_weight_pct)::text AS target_weight,
              trim_scale(m.price_usd)::text AS price, m.data_timestamp,
              trim_scale(m.volume_24h_usd)::text AS volume_24h,
              a.slug, i.id AS issuer_id,
              EXISTS (SELECT 1 FROM app.rwa_asset_contracts c WHERE c.asset_id = h.asset_id AND (c.transfer_restricted OR c.whitelist_required)) AS restricted
       FROM app.basket_holdings h
       JOIN app.rwa_assets a ON a.id = h.asset_id
       LEFT JOIN app.rwa_issuers i ON i.id = a.issuer_id
       LEFT JOIN app.rwa_asset_metrics m ON m.asset_id = h.asset_id
       WHERE h.portfolio_id = $1`,
      [portfolioId],
    )) as Array<Record<string, any>>

    const checks: RiskCheck[] = []
    const units = parse18(portfolio.total_units as string)
    const cash = parse18(portfolio.cash as string)

    if (units === 0n) {
      checks.push({ code: 'NO_UNITS', severity: 'info', message: 'Portfolio has no settled units yet.' })
    }
    if (cash < 0n) {
      checks.push({ code: 'NEGATIVE_CASH', severity: 'block', message: 'Portfolio cash is negative.', data: { cash: portfolio.cash } })
    }
    if (units > 0n && !portfolio.nav) {
      checks.push({ code: 'NAV_MISSING', severity: 'block', message: 'Portfolio has units but no NAV has been computed.' })
    }

    // 价格覆盖 + 陈旧 + 流动性 + 受限
    let pricedValue = 0n
    let totalValue = 0n
    let staleFound = false
    const now = Date.now()
    for (const holding of holdings) {
      const value = parse18((holding.market_value ?? '0') as string)
      totalValue = add18(totalValue, value)
      const hasPrice = holding.price !== null
      if (hasPrice) pricedValue = add18(pricedValue, value)
      if (hasPrice && holding.data_timestamp && now - new Date(holding.data_timestamp as string).getTime() > STALE_PRICE_MS) staleFound = true
      if (!hasPrice && value > 0n) staleFound = true

      const weight = Number(holding.actual_weight ?? holding.target_weight ?? 0)
      if (weight > 5) {
        const volume = holding.volume_24h !== null ? Number(holding.volume_24h) : null
        if (volume !== null && volume < THIN_VOLUME_USD) {
          checks.push({
            code: 'LIQUIDITY_THIN',
            severity: 'warn',
            message: `Holding ${holding.slug} has thin 24h volume (${holding.volume_24h} USD) at ${weight.toFixed(2)}% weight.`,
            data: { slug: holding.slug, weightPct: weight },
          })
        }
      }
      if (holding.restricted === true && value > 0n) {
        checks.push({
          code: 'RESTRICTED_HOLDING',
          severity: 'warn',
          message: `Holding ${holding.slug} has transfer-restricted contracts.`,
          data: { slug: holding.slug },
        })
      }
      if (weight > BASKET_DEFAULTS.maxAssetWeightPct + 15) {
        checks.push({
          code: 'CONCENTRATION_ASSET',
          severity: 'warn',
          message: `Holding ${holding.slug} exceeds ${BASKET_DEFAULTS.maxAssetWeightPct + 15}% of the portfolio (${weight.toFixed(2)}%).`,
          data: { slug: holding.slug, weightPct: weight },
        })
      }
    }

    if (totalValue > 0n) {
      const coverage = Number(weightPct18(pricedValue, totalValue))
      if (coverage < 50) {
        checks.push({ code: 'DATA_COVERAGE', severity: 'block', message: `Only ${coverage.toFixed(2)}% of holdings have live prices.`, data: { coveragePct: coverage } })
      } else if (coverage < 90) {
        checks.push({ code: 'DATA_COVERAGE', severity: 'warn', message: `Price coverage is ${coverage.toFixed(2)}%.`, data: { coveragePct: coverage } })
      }
      if (staleFound) {
        checks.push({ code: 'DATA_STALE', severity: 'warn', message: 'Some holding prices are stale (>72h).' })
      }

      // 发行人集中度
      const byIssuer = new Map<string, bigint>()
      for (const holding of holdings) {
        if (!holding.issuer_id) continue
        const value = parse18((holding.market_value ?? '0') as string)
        byIssuer.set(holding.issuer_id as string, add18(byIssuer.get(holding.issuer_id as string) ?? 0n, value))
      }
      for (const [, value] of byIssuer) {
        const share = Number(weightPct18(value, totalValue))
        if (share > BASKET_DEFAULTS.maxIssuerWeightPct) {
          checks.push({ code: 'CONCENTRATION_ISSUER', severity: 'warn', message: `Issuer concentration ${share.toFixed(2)}% exceeds ${BASKET_DEFAULTS.maxIssuerWeightPct}%.`, data: { sharePct: share } })
        }
      }

      // 现金缓冲
      if (portfolio.cash_buffer_target_pct !== null) {
        const target = Number(portfolio.cash_buffer_target_pct)
        const nav = add18(totalValue, cash)
        const cashPct = nav > 0n ? Number(weightPct18(cash, nav)) : 0
        if (cashPct < target - 2) {
          checks.push({ code: 'CASH_BUFFER_LOW', severity: 'info', message: `Cash ${cashPct.toFixed(2)}% is below target ${target}%.`, data: { cashPct } })
        }
      }
    }

    return { scope: 'portfolio', subjectId: portfolioId, status: toStatus(checks), checks, evaluatedAt: new Date().toISOString() }
  }

  async evaluateProposedOrders(runId: string): Promise<RiskEvaluation> {
    const [run] = (await this.ds.query(
      `SELECT r.id, r.portfolio_id, trim_scale(p.aum_usd)::text AS aum, trim_scale(p.cash_balance_usd)::text AS cash,
              trim_scale(r.pre_nav)::text AS pre_nav
       FROM app.basket_rebalance_runs r JOIN app.basket_portfolios p ON p.id = r.portfolio_id WHERE r.id = $1`,
      [runId],
    )) as Array<Record<string, any>>
    if (!run) throw new NotFoundException({ code: BASKET_ERROR_CODES.REBALANCE_RUN_NOT_FOUND, message: 'Rebalance run was not found.' })

    const orders = (await this.ds.query(
      `SELECT o.id, o.side, o.asset_id, trim_scale(o.target_quantity)::text AS qty,
              trim_scale(o.estimated_price)::text AS price, a.slug
       FROM app.basket_rebalance_orders o JOIN app.rwa_assets a ON a.id = o.asset_id
       WHERE o.rebalance_run_id = $1 AND o.status IN ('planned', 'quoted')`,
      [runId],
    )) as Array<Record<string, any>>
    const holdings = (await this.ds.query(
      `SELECT asset_id, trim_scale(quantity)::text AS qty FROM app.basket_holdings WHERE portfolio_id = $1`,
      [run.portfolio_id],
    )) as Array<{ asset_id: string; qty: string }>
    const holdingQty = new Map(holdings.map((row) => [row.asset_id, parse18(row.qty)]))

    const checks: RiskCheck[] = []
    let buys = 0n
    let sells = 0n
    let turnover = 0n
    const cash = parse18((run.cash ?? '0') as string)
    const aum = parse18((run.aum ?? '0') as string)

    for (const order of orders) {
      const qty = parse18(order.qty as string)
      const price = order.price !== null ? parse18(order.price as string) : null
      if (price === null) continue
      const notional = mul18(qty, price)
      turnover = add18(turnover, notional)
      if (order.side === 'sell') {
        sells = add18(sells, notional)
        const available = holdingQty.get(order.asset_id as string) ?? 0n
        if (qty > available) {
          checks.push({
            code: 'ORDER_EXCEEDS_HOLDINGS',
            severity: 'block',
            message: `Sell order for ${order.slug} exceeds the current holding.`,
            data: { slug: order.slug, orderQty: order.qty, holdingQty: format18(available) },
          })
        }
      } else {
        buys = add18(buys, notional)
        if (aum > 0n && notional > mul18(aum, parse18('0.4'))) {
          checks.push({ code: 'LARGE_ORDER', severity: 'warn', message: `Buy order for ${order.slug} exceeds 40% of AUM.`, data: { slug: order.slug } })
        }
      }
    }

    // 卖出回款按 98% 折算（滑点/费用缓冲）
    const sellProceeds = mul18(sells, parse18('0.98'))
    if (buys > add18(cash, sellProceeds)) {
      checks.push({
        code: 'INSUFFICIENT_FUNDING',
        severity: 'block',
        message: 'Planned buys exceed available cash plus expected sell proceeds.',
        data: { buys: format18(buys), available: format18(add18(cash, sellProceeds)) },
      })
    }
    if (aum > 0n) {
      const turnoverPct = Number(weightPct18(turnover, aum))
      if (turnoverPct > 50) {
        checks.push({ code: 'HIGH_TURNOVER', severity: 'warn', message: `Estimated turnover ${turnoverPct.toFixed(2)}% exceeds 50%.`, data: { turnoverPct } })
      }
    }

    return { scope: 'rebalance-run', subjectId: runId, status: toStatus(checks), checks, evaluatedAt: new Date().toISOString() }
  }

  /** 申购闸门：block 级别的组合风险禁止新增申购 */
  async assertPortfolioSubscribable(portfolioId: string): Promise<void> {
    const evaluation = await this.evaluatePortfolio(portfolioId)
    if (evaluation.status === 'block') {
      const blocked = evaluation.checks.filter((check) => check.severity === 'block').map((check) => check.code)
      const error = new Error(`Portfolio risk blocks new subscriptions: ${blocked.join(', ')}`) as Error & { riskCodes?: string[] }
      error.riskCodes = blocked
      throw error
    }
  }
}

function toStatus(checks: RiskCheck[]): 'ok' | 'warn' | 'block' {
  if (checks.some((check) => check.severity === 'block')) return 'block'
  if (checks.some((check) => check.severity === 'warn')) return 'warn'
  return 'ok'
}
