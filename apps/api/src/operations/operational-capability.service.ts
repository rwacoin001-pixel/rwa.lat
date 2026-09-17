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
} as const

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

