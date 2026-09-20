import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export interface UserSummary {
  balance: { asset: string; availableAtomic: string; decimals: number; availableUsd: string }
  basket: { portfolioCount: number; positions: Array<{ portfolioId: string; units: string }> }
  notifications: { unread: number }
  updatedAt: string
}

/**
 * 首页聚合摘要（登录用户）：一次调用拿到 余额 / 组合份额 / 未读通知。
 * 直查账本与业务表，聚合口径与各模块列表接口一致。
 */
@Injectable()
export class SummaryService {
  constructor(private readonly ds: DataSource) {}

  async forUser(userId: string): Promise<UserSummary> {
    const [balance] = (await this.ds.query(
      `SELECT COALESCE(b.current_atomic_balance, 0)::text AS available_atomic
       FROM app.ledger_accounts a
       LEFT JOIN app.ledger_account_balances b ON b.account_id = a.id
       WHERE a.user_id = $1 AND a.purpose = 'available' AND a.asset_code = 'USDT' AND a.state = 'active'
       LIMIT 1`,
      [userId],
    )) as Array<{ available_atomic: string }>

    const positions = (await this.ds.query(
      `SELECT portfolio_id, SUM(units)::text AS units FROM (
         SELECT portfolio_id, COALESCE(units_issued, 0) AS units
         FROM app.basket_subscriptions WHERE user_id = $1 AND status = 'settled'
         UNION ALL
         SELECT portfolio_id, -units AS units
         FROM app.basket_redemptions WHERE user_id = $1 AND status = 'settled'
       ) t
       GROUP BY portfolio_id
       HAVING SUM(units) > 0`,
      [userId],
    )) as Array<{ portfolio_id: string; units: string }>

    const [notif] = (await this.ds.query(
      `SELECT COUNT(*)::int AS unread FROM app.notifications WHERE recipient_user_id = $1 AND read_at IS NULL`,
      [userId],
    )) as Array<{ unread: number }>

    const atomic = BigInt(balance?.available_atomic ?? '0')
    const availableUsd = (Number(atomic) / 1e6).toFixed(2)

    return {
      balance: {
        asset: 'USDT',
        availableAtomic: atomic.toString(),
        decimals: 6,
        availableUsd,
      },
      basket: {
        portfolioCount: positions.length,
        positions: positions.map((p) => ({ portfolioId: p.portfolio_id, units: p.units })),
      },
      notifications: { unread: notif?.unread ?? 0 },
      updatedAt: new Date().toISOString(),
    }
  }
}
