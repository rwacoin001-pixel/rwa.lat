import { ConflictException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'

export const OPERATIONAL_SWITCH_KEYS = {
  orders: 'orders.acceptance',
  deposits: 'wallet.deposits.crediting',
  withdrawals: 'wallet.withdrawals.request',
  withdrawalExecution: 'wallet.withdrawals.execution',
  yield: 'yield.processing',
  polymarket: 'polymarket.trading',
  predictionBetting: 'prediction.betting',
  basketSubscriptions: 'basket.subscriptions',
  basketRedemptions: 'basket.redemptions',
  basketRebalanceExecution: 'basket.rebalance.execution',
} as const

export interface CapabilityState {
  status: 'enabled' | 'paused'
  reasonCode: string | null
  allowedActions: string[]
  requiredActions: string[]
  lastUpdated: string | null
}

export interface CapabilitySnapshot {
  updatedAt: string
  capabilities: Record<string, CapabilityState>
}

const BROWSE_ACTIONS: Record<string, string[]> = {
  invest: ['browse_portfolios', 'view_terms', 'view_nav', 'view_disclosures'],
  redeem: ['view_holdings', 'view_terms'],
  predict: ['browse_markets', 'view_rules'],
  deposit: ['view_deposit_info'],
  withdraw: ['view_withdrawal_info'],
  orders: ['browse_products', 'view_terms'],
  yield: ['view_yield_info'],
}

const WRITE_ACTIONS: Record<string, string[]> = {
  invest: ['subscribe'],
  redeem: ['request_redemption'],
  predict: ['place_bet'],
  deposit: ['create_deposit'],
  withdraw: ['request_withdrawal'],
  orders: ['place_order'],
  yield: ['opt_in_yield'],
}

const CAPABILITY_SWITCHES: Record<string, string> = {
  invest: OPERATIONAL_SWITCH_KEYS.basketSubscriptions,
  redeem: OPERATIONAL_SWITCH_KEYS.basketRedemptions,
  predict: OPERATIONAL_SWITCH_KEYS.predictionBetting,
  deposit: OPERATIONAL_SWITCH_KEYS.deposits,
  withdraw: OPERATIONAL_SWITCH_KEYS.withdrawals,
  orders: OPERATIONAL_SWITCH_KEYS.orders,
  yield: OPERATIONAL_SWITCH_KEYS.yield,
}

@Injectable()
export class OperationalCapabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async isEnabled(switchKey: string): Promise<boolean> {
    if (this.config.get<string>('APP_ENV') !== 'production') return true
    if (!this.environmentAllows(switchKey)) return false
    const rows = await this.dataSource.query(
      `SELECT enabled FROM app.operational_switches WHERE switch_key = $1`,
      [switchKey],
    ) as Array<{ enabled: boolean }>
    return rows[0]?.enabled === true
  }

  async assertEnabled(switchKey: string, message: string): Promise<void> {
    if (await this.isEnabled(switchKey)) return
    throw new ConflictException({
      code: 'OPERATIONAL_SWITCH_DISABLED',
      switchKey,
      message,
    })
  }

  /**
   * 面向用户端的聚合状态快照（不返回无法保证的完成时间）。
   * 每个能力 = status + reasonCode + allowedActions + requiredActions + lastUpdated。
   */
  async snapshot(): Promise<CapabilitySnapshot> {
    const rows = await this.dataSource.query(
      `SELECT switch_key, enabled, updated_at FROM app.operational_switches`,
    ) as Array<{ switch_key: string; enabled: boolean; updated_at: Date }>
    const byKey = new Map(rows.map((r) => [r.switch_key, r]))

    const capabilities: Record<string, CapabilityState> = {}
    for (const [name, switchKey] of Object.entries(CAPABILITY_SWITCHES)) {
      const row = byKey.get(switchKey)
      const envAllowed = this.environmentAllows(switchKey)
      const nonProdBypass = this.config.get<string>('APP_ENV') !== 'production'
      const enabled = nonProdBypass || (envAllowed && row?.enabled === true)
      const browse = BROWSE_ACTIONS[name] ?? []
      capabilities[name] = enabled
        ? {
            status: 'enabled',
            reasonCode: null,
            allowedActions: [...browse, ...(WRITE_ACTIONS[name] ?? [])],
            requiredActions: [],
            lastUpdated: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
          }
        : {
            status: 'paused',
            reasonCode: envAllowed ? 'OPERATIONAL_SWITCH_DISABLED' : 'ENVIRONMENT_DISABLED',
            allowedActions: browse,
            requiredActions: [],
            lastUpdated: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
          }
    }
    return { updatedAt: new Date().toISOString(), capabilities }
  }

  private environmentAllows(switchKey: string) {
    if (switchKey === OPERATIONAL_SWITCH_KEYS.withdrawalExecution) {
      return this.config.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
        && this.config.get<string>('WALLET_EXECUTION_ENABLED') === 'true'
        && this.config.get<string>('WALLET_CUSTODY_ADAPTER') !== 'stub'
    }
    if (switchKey === OPERATIONAL_SWITCH_KEYS.polymarket) {
      return this.config.get<string>('POLYMARKET_TRADING_ENABLED') === 'true'
    }
    return this.config.get<string>('PRODUCTION_FINANCIAL_FEATURES_ENABLED') === 'true'
  }
}

