import { Injectable } from '@nestjs/common'
import { DataSource, In } from 'typeorm'

export interface AdminUserLite {
  id: string
  status: string
  locale: string
  created_at: string
  updated_at: string | null
}

export interface AdminRedemptionRow {
  id: string
  user_id: string
  product_id: string
  asset_code: string
  asset_decimals: number
  quantity_atomic_amount: string
  estimated_unit_price_atomic_amount: string
  currency: string
  destination_address: string
  state: string
  order_id: string | null
  requested_at: string
  executed_at: string | null
  canceled_at: string | null
  failed_at: string | null
  reason_code: string | null
  request_id: string | null
}

@Injectable()
export class AdminService {
  constructor(private readonly ds: DataSource) {}

  async listUsers(limit = 50, offset = 0): Promise<AdminUserLite[]> {
    const rows = await this.ds.query(
      `SELECT id, status, locale, created_at, updated_at
       FROM app.users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    )
    return rows
  }

  async listRedemptions(state?: string[], limit = 50, offset = 0): Promise<AdminRedemptionRow[]> {
    const where = state && state.length ? `WHERE state = ANY($3::text[])` : ''
    const params = state && state.length ? [limit, offset, state] : [limit, offset]
    const rows = await this.ds.query(
      `SELECT id, user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount,
              estimated_unit_price_atomic_amount, currency, destination_address, state,
              order_id, requested_at, executed_at, canceled_at, failed_at, reason_code, request_id
       FROM app.redemptions
       ${where}
       ORDER BY requested_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    )
    return rows
  }

  async getRedemption(id: string): Promise<AdminRedemptionRow | null> {
    const rows = await this.ds.query(
      `SELECT id, user_id, product_id, asset_code, asset_decimals, quantity_atomic_amount,
              estimated_unit_price_atomic_amount, currency, destination_address, state,
              order_id, requested_at, executed_at, canceled_at, failed_at, reason_code, request_id
       FROM app.redemptions
       WHERE id = $1`,
      [id],
    )
    return rows[0] ?? null
  }

  async countRedemptionsByState(): Promise<Record<string, number>> {
    const rows = await this.ds.query(
      `SELECT state, COUNT(*)::int AS cnt FROM app.redemptions GROUP BY state`,
    )
    const out: Record<string, number> = {}
    for (const r of rows) out[r.state] = Number(r.cnt)
    return out
  }
}
