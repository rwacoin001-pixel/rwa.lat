import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { PositionSnapshot, Redemption } from './portfolio.entities'
import { PortfolioError } from './portfolio.errors'
import { LedgerService } from '../ledger/ledger.service'
import { CatalogService } from '../catalog/catalog.service'

export interface PositionView {
  productId: string
  outcomeKey?: string
  assetCode: string
  assetDecimals: number
  quantityAtomicAmount: string
  unitPriceAtomicAmount: string
  currency: string
  valuedAt: Date
  source: string
  costAtomicAmount?: string
  cumulativeYieldAtomicAmount?: string
}

export interface PerformancePoint {
  capturedAt: Date
  totalValueAtomicAmount: string
  currency: string
}

export interface RedemptionView {
  id: string
  productId: string
  assetCode: string
  quantityAtomicAmount: string
  estimatedUnitPriceAtomicAmount: string
  currency: string
  destinationAddress?: string
  state: string
  requestedAt: Date
}

@Injectable()
export class PortfolioService {
  constructor(
    @InjectRepository(PositionSnapshot)
    private readonly snapshotRepo: Repository<PositionSnapshot>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
    private readonly ledger: LedgerService,
    private readonly catalog: CatalogService,
  ) {}

  // 持仓余额：复用 ledger 不可变投影，可追溯到不可变凭证
  async listPositions(userId: string): Promise<PositionView[]> {
    // API-008 writes durable product positions after a Demo order is filled.
    // Keep the older ledger projection as a compatibility fallback for users
    // who have not yet placed an order or for historical migration tests.
    const stored = await this.snapshotRepo.query(
      `SELECT p.product_id AS "productId", p.outcome_key AS "outcomeKey", p.asset_code AS "assetCode",
              p.asset_decimals AS "assetDecimals", p.quantity_atomic_amount::text AS "quantityAtomicAmount",
              p.cost_atomic_amount::text AS "costAtomicAmount",
              p.cumulative_yield_atomic_amount::text AS "cumulativeYieldAtomicAmount",
              COALESCE(q.unit_price_atomic_amount, 0)::text AS "unitPriceAtomicAmount",
              COALESCE(q.currency, 'USD') AS currency, p.updated_at AS "valuedAt"
       FROM app.positions p
       LEFT JOIN LATERAL (
         SELECT unit_price_atomic_amount, currency FROM app.price_quotes
         WHERE product_id = p.product_id ORDER BY valid_until DESC LIMIT 1
       ) q ON true
       WHERE p.user_id = $1 AND p.quantity_atomic_amount > 0
       ORDER BY p.updated_at DESC`,
      [userId],
    ) as Array<Omit<PositionView, 'source'>> | undefined
    if (stored?.length) return stored.map((position) => ({ ...position, source: 'demo-order-position' }))
    const { accounts } = await this.ledger.listUserBalances(userId)
    const owned = accounts.filter(
      (a: Record<string, unknown>) => a.purpose === 'available' || a.purpose === 'locked',
    )
    return owned.map((a: Record<string, unknown>) => ({
      productId: a.accountId as string,
      assetCode: a.assetCode as string,
      assetDecimals: Number(a.assetDecimals),
      quantityAtomicAmount: a.atomicBalance as string,
      unitPriceAtomicAmount: '0',
      currency: 'USD',
      valuedAt: (a.updatedAt as Date) ?? new Date(0),
      source: 'immutable-ledger-projection',
    }))
  }

  // 落一个持仓时点快照（历史表现溯源）。价格来自最新报价快照。
  async captureSnapshot(userId: string, productId: string): Promise<PositionView> {
    const product = await this.catalog.getProduct(productId).catch(() => null)
    if (!product) throw PortfolioError.productNotFound(productId)
    const quote = await this.catalog.getLatestQuote(productId).catch(() => null)
    if (!quote) throw PortfolioError.quoteStale(productId)
    const positionRows = await this.snapshotRepo.query(
      `SELECT COALESCE(SUM(quantity_atomic_amount), 0)::text AS quantity
       FROM app.positions WHERE user_id = $1 AND product_id = $2 AND state = 'active'`,
      [userId, productId],
    ) as Array<{ quantity: string }> | undefined
    const stored = positionRows?.[0]
    let quantity = stored?.quantity ?? '0'
    if (quantity === '0') {
      // Compatibility for legacy seed users that only own a ledger projection.
      const { accounts } = await this.ledger.listUserBalances(userId)
      quantity = accounts
        .filter((account: Record<string, unknown>) =>
          account.assetCode === product.assetCode
          && (account.purpose === 'available' || account.purpose === 'locked'),
        )
        .reduce((total: bigint, account: Record<string, unknown>) => total + BigInt(account.atomicBalance as string), 0n)
        .toString()
    }
    const snap = await this.snapshotRepo.save(
      this.snapshotRepo.create({
        user_id: userId,
        product_id: productId,
        asset_code: product.assetCode,
        asset_decimals: product.assetDecimals,
        quantity_atomic_amount: quantity,
        unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        price_snapshot_id: undefined,
        currency: quote.currency,
        valued_at: quote.capturedAt,
      }),
    )
    return {
      productId,
      assetCode: snap.asset_code,
      assetDecimals: snap.asset_decimals,
      quantityAtomicAmount: snap.quantity_atomic_amount,
      unitPriceAtomicAmount: snap.unit_price_atomic_amount,
      currency: snap.currency,
      valuedAt: snap.valued_at,
      source: 'snapshot',
    }
  }

  // 历史表现：按时间聚合持仓快照总价值
  async history(userId: string, productId?: string, limit = 30): Promise<PerformancePoint[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const where = productId ? ` AND product_id = $2` : ''
    const params: unknown[] = productId ? [userId, productId, safeLimit] : [userId, safeLimit]
    const rows = await this.snapshotRepo.query(
      `SELECT captured_at AS "capturedAt",
              (SUM(quantity_atomic_amount::numeric * unit_price_atomic_amount::numeric))::text AS "totalValueAtomicAmount",
              currency
       FROM app.position_snapshots
       WHERE user_id = $1${where}
       GROUP BY captured_at, currency
       ORDER BY captured_at DESC
       LIMIT ${productId ? '$3' : '$2'}`,
      params,
    )
    return rows.map((r: Record<string, unknown>) => ({
      capturedAt: r.capturedAt as Date,
      totalValueAtomicAmount: r.totalValueAtomicAmount as string,
      currency: r.currency as string,
    }))
  }

  // 赎回：仅创建请求记录 + 预览估值，执行链路依赖 API-008（订单）
  async requestRedemption(dto: {
    user_id: string
    product_id: string
    quantity_atomic_amount: string
    destination_address?: string
    request_id: string
  }): Promise<RedemptionView> {
    const product = await this.catalog.getProduct(dto.product_id).catch(() => null)
    if (!product) throw PortfolioError.productNotFound(dto.product_id)
    const quote = await this.catalog.getLatestQuote(dto.product_id).catch(() => null)
    if (!quote) throw PortfolioError.quoteStale(dto.product_id)
    const r = await this.redemptionRepo.save(
      this.redemptionRepo.create({
        user_id: dto.user_id,
        product_id: dto.product_id,
        asset_code: product.assetCode,
        asset_decimals: product.assetDecimals,
        quantity_atomic_amount: dto.quantity_atomic_amount,
        estimated_unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        currency: quote.currency,
        destination_address: dto.destination_address,
        state: 'requested',
        requested_at: new Date(),
        request_id: dto.request_id,
      }),
    )
    return this.toRedemptionView(r)
  }

  async listRedemptions(userId: string): Promise<RedemptionView[]> {
    const rows = await this.redemptionRepo.find({
      where: { user_id: userId },
      order: { requested_at: 'DESC' },
    })
    return rows.map((r) => this.toRedemptionView(r))
  }

  async cancelRedemption(id: string, userId: string): Promise<RedemptionView> {
    const r = await this.redemptionRepo.findOne({ where: { id, user_id: userId } })
    if (!r) throw PortfolioError.redemptionNotFound(id)
    if (r.state !== 'requested' && r.state !== 'queued') {
      throw PortfolioError.redemptionStateInvalid(id, r.state)
    }
    r.state = 'canceled'
    r.canceled_at = new Date()
    const saved = await this.redemptionRepo.save(r)
    return this.toRedemptionView(saved)
  }

  private toRedemptionView(r: Redemption): RedemptionView {
    return {
      id: r.id,
      productId: r.product_id,
      assetCode: r.asset_code,
      quantityAtomicAmount: r.quantity_atomic_amount,
      estimatedUnitPriceAtomicAmount: r.estimated_unit_price_atomic_amount,
      currency: r.currency,
      destinationAddress: r.destination_address,
      state: r.state,
      requestedAt: r.requested_at,
    }
  }
}
