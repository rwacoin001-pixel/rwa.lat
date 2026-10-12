import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PositionSnapshot, Redemption } from './portfolio.entities'
import { PortfolioError } from './portfolio.errors'
import { LedgerService } from '../ledger/ledger.service'
import { CatalogService } from '../catalog/catalog.service'
import { calculateSettlementPayoutAtomic, isUsdUsdtEquivalent, SETTLEMENT_ASSET_DECIMALS } from '../financial/amounts'

export interface PositionView {
  productId: string
  outcomeKey?: string
  assetCode: string
  assetDecimals: number
  quantityAtomicAmount: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
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
  currencyDecimals: number
}

export interface RedemptionView {
  id: string
  productId: string
  assetCode: string
  quantityAtomicAmount: string
  estimatedUnitPriceAtomicAmount: string
  estimatedUnitPriceDecimals: number
  currency: string
  destinationAddress?: string
  state: string
  requestedAt: Date
}

export interface PortfolioSnapshotBatchView {
  snapshotBatchId: string
  capturedAt: Date
  snapshotCount: number
  positions: PositionView[]
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

  // 产品持仓：仅来自订单成交写入的 app.positions；现金账户不是持仓。
  async listPositions(userId: string): Promise<PositionView[]> {
    const stored = await this.snapshotRepo.query(
      `SELECT p.product_id AS "productId", p.outcome_key AS "outcomeKey", p.asset_code AS "assetCode",
              p.asset_decimals AS "assetDecimals", p.quantity_atomic_amount::text AS "quantityAtomicAmount",
              p.cost_atomic_amount::text AS "costAtomicAmount",
              p.cumulative_yield_atomic_amount::text AS "cumulativeYieldAtomicAmount",
              COALESCE(q.unit_price_atomic_amount, 0)::text AS "unitPriceAtomicAmount",
              COALESCE(q.unit_price_decimals, 6)::int AS "unitPriceDecimals",
              COALESCE(q.currency, 'USD') AS currency, p.updated_at AS "valuedAt"
       FROM app.positions p
       LEFT JOIN LATERAL (
         SELECT q.unit_price_atomic_amount, q.unit_price_decimals, q.currency
         FROM app.price_quotes q
         JOIN app.products product ON product.id = q.product_id
         WHERE q.product_id = p.product_id
           AND q.asset_code = p.asset_code
           AND product.asset_code = p.asset_code
           AND product.asset_decimals = p.asset_decimals
           AND product.asset_class_id <> 'prediction'
           AND q.captured_at <= now()
           AND q.valid_until > now()
         ORDER BY q.valid_until DESC LIMIT 1
       ) q ON true
       WHERE p.user_id = $1 AND p.quantity_atomic_amount > 0
       ORDER BY p.updated_at DESC`,
      [userId],
    ) as Array<Omit<PositionView, 'source'>> | undefined
    // Cash ledger accounts (available/locked USDT) are cash, not product holdings; never project them as positions.
    return (stored ?? []).map((position) => ({ ...position, source: 'demo-order-position' }))
  }

  // 落一个持仓时点快照（历史表现溯源）。价格来自最新报价快照。
  async captureSnapshot(userId: string, productId: string): Promise<PositionView> {
    const product = await this.catalog.getProduct(productId).catch(() => null)
    if (!product) throw PortfolioError.productNotFound(productId)
    if (product.assetClassId === 'prediction') {
      throw new ConflictException({ code: 'PORTFOLIO_OUTCOME_PRICE_UNAVAILABLE', message: 'Prediction holdings need outcome-specific prices before they can be included in portfolio history.' })
    }
    const quote = await this.catalog.getLatestQuote(productId).catch(() => null)
    if (!quote) throw PortfolioError.quoteStale(productId)
    if (quote.stale) throw new ConflictException({ code: 'PORTFOLIO_QUOTE_STALE', message: 'A stale quote cannot be saved as a market-value snapshot.' })
    if (!isUsdUsdtEquivalent(quote.currency)) {
      throw new ConflictException({ code: 'PORTFOLIO_QUOTE_CURRENCY_UNSUPPORTED', message: 'Portfolio market-value snapshots currently support USD or USDT at a 1:1 settlement rate.' })
    }
    const positionRows = await this.snapshotRepo.query(
      `SELECT COALESCE(SUM(quantity_atomic_amount), 0)::text AS quantity,
              MIN(asset_code) AS min_asset_code, MAX(asset_code) AS max_asset_code,
              MIN(asset_decimals)::int AS min_asset_decimals, MAX(asset_decimals)::int AS max_asset_decimals
       FROM app.positions WHERE user_id = $1 AND product_id = $2 AND outcome_key = 'long' AND state = 'active' AND quantity_atomic_amount > 0`,
      [userId, productId],
    ) as Array<{ quantity: string; min_asset_code: string | null; max_asset_code: string | null; min_asset_decimals: number | null; max_asset_decimals: number | null }> | undefined
    const stored = positionRows?.[0]
    let quantity = stored?.quantity ?? '0'
    const assetDecimals = stored?.min_asset_decimals == null ? product.assetDecimals : Number(stored.min_asset_decimals)
    if (stored?.min_asset_code != null && stored.max_asset_code != null
      && stored.min_asset_code !== stored.max_asset_code) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITION_ASSET_CHANGED', message: 'Active positions use different asset units and cannot be valued safely.' })
    }
    if (stored?.min_asset_decimals != null && stored.max_asset_decimals != null
      && Number(stored.min_asset_decimals) !== Number(stored.max_asset_decimals)) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITION_SCALE_MISMATCH', message: 'The active position contains incompatible asset scales and cannot be valued safely.' })
    }
    if (stored?.min_asset_code != null && stored.min_asset_code !== product.assetCode) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITION_ASSET_CHANGED', message: 'The active position asset no longer matches the catalog asset and cannot be valued safely.' })
    }
    if (stored?.min_asset_decimals != null && assetDecimals !== product.assetDecimals) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITION_SCALE_MISMATCH', message: 'The active position scale no longer matches the catalog scale and cannot be valued safely.' })
    }
    if (BigInt(quantity) <= BigInt(0)) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITION_EMPTY', message: 'There is no positive position quantity to capture for this product.' })
    }
    const snap = await this.snapshotRepo.save(
      this.snapshotRepo.create({
        user_id: userId,
        snapshot_batch_id: null,
        product_id: productId,
        asset_code: product.assetCode,
        quantity_atomic_amount: quantity,
        asset_decimals: assetDecimals,
        unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        unit_price_decimals: quote.unitPriceDecimals,
        price_snapshot_id: undefined,
        currency: quote.currency,
        valued_at: quote.capturedAt,
        captured_at: new Date(),
      }),
    )
    return {
      productId,
      assetCode: snap.asset_code,
      assetDecimals,
      quantityAtomicAmount: snap.quantity_atomic_amount,
      unitPriceAtomicAmount: snap.unit_price_atomic_amount,
      unitPriceDecimals: quote.unitPriceDecimals,
      currency: snap.currency,
      valuedAt: snap.valued_at,
      source: 'snapshot',
    }
  }

  /** Capture all currently active long positions in one portfolio history batch. */
  async capturePortfolioSnapshot(userId: string, snapshotBatchId: string = randomUUID()): Promise<PortfolioSnapshotBatchView> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(snapshotBatchId)) {
      throw new BadRequestException({ code: 'PORTFOLIO_SNAPSHOT_BATCH_ID_INVALID', message: 'Snapshot batch ID must be a UUID.' })
    }
    const existing = await this.snapshotRepo.query(
      `SELECT product_id AS "productId", asset_code AS "assetCode", asset_decimals AS "assetDecimals",
              quantity_atomic_amount::text AS "quantityAtomicAmount",
              unit_price_atomic_amount::text AS "unitPriceAtomicAmount",
              unit_price_decimals AS "unitPriceDecimals", currency, valued_at AS "valuedAt",
              captured_at AS "capturedAt"
         FROM app.position_snapshots
        WHERE user_id = $1 AND snapshot_batch_id = $2
        ORDER BY product_id`,
      [userId, snapshotBatchId],
    ) as Array<{
      productId: string
      assetCode: string
      assetDecimals: number
      quantityAtomicAmount: string
      unitPriceAtomicAmount: string
      unitPriceDecimals: number | null
      currency: string
      valuedAt: Date
      capturedAt: Date
    }>
    if (existing.length) {
      const capturedAt = existing[0].capturedAt
      if (existing.some((position) => position.capturedAt.getTime() !== capturedAt.getTime())) {
        throw new ConflictException({ code: 'PORTFOLIO_SNAPSHOT_BATCH_INVALID', message: 'The stored portfolio snapshot batch has inconsistent capture times.' })
      }
      return {
        snapshotBatchId,
        capturedAt,
        snapshotCount: existing.length,
        positions: existing.map((position) => ({
          productId: position.productId,
          assetCode: position.assetCode,
          assetDecimals: Number(position.assetDecimals),
          quantityAtomicAmount: position.quantityAtomicAmount,
          unitPriceAtomicAmount: position.unitPriceAtomicAmount,
          unitPriceDecimals: position.unitPriceDecimals ?? 6,
          currency: position.currency,
          valuedAt: position.valuedAt,
          source: 'snapshot',
        })),
      }
    }
    const rows = await this.snapshotRepo.query(
      `SELECT product_id, outcome_key, asset_code, asset_decimals,
              quantity_atomic_amount::text AS quantity
         FROM app.positions
        WHERE user_id = $1 AND state = 'active' AND quantity_atomic_amount > 0
        ORDER BY product_id, outcome_key`,
      [userId],
    ) as Array<{ product_id: string; outcome_key: string; asset_code: string; asset_decimals: number; quantity: string }>
    if (!rows.length) {
      throw new ConflictException({ code: 'PORTFOLIO_POSITIONS_EMPTY', message: 'There are no active positions to capture.' })
    }
    if (rows.some((row) => row.outcome_key !== 'long')) {
      throw new ConflictException({ code: 'PORTFOLIO_OUTCOME_PRICE_UNAVAILABLE', message: 'Prediction holdings need outcome-specific prices before they can be included in portfolio history.' })
    }

    const grouped = new Map<string, { assetCode: string; assetDecimals: number; quantity: bigint }>()
    for (const row of rows) {
      const current = grouped.get(row.product_id)
      if (current && (current.assetCode !== row.asset_code || current.assetDecimals !== Number(row.asset_decimals))) {
        throw new ConflictException({ code: 'PORTFOLIO_POSITION_SCALE_MISMATCH', message: 'The active position contains incompatible asset scales and cannot be valued safely.' })
      }
      grouped.set(row.product_id, {
        assetCode: row.asset_code,
        assetDecimals: Number(row.asset_decimals),
        quantity: (current?.quantity ?? 0n) + BigInt(row.quantity),
      })
    }

    const pricedPositions = await Promise.all([...grouped.entries()].map(async ([productId, position]) => {
      const product = await this.catalog.getProduct(productId).catch(() => null)
      if (!product) throw PortfolioError.productNotFound(productId)
      if (product.assetClassId === 'prediction') {
        throw new ConflictException({ code: 'PORTFOLIO_OUTCOME_PRICE_UNAVAILABLE', message: 'Prediction holdings need outcome-specific prices before they can be included in portfolio history.' })
      }
      if (position.assetCode !== product.assetCode) {
        throw new ConflictException({ code: 'PORTFOLIO_POSITION_ASSET_CHANGED', message: 'The active position asset no longer matches the catalog asset and cannot be valued safely.' })
      }
      if (position.assetDecimals !== product.assetDecimals) {
        throw new ConflictException({ code: 'PORTFOLIO_POSITION_SCALE_MISMATCH', message: 'The active position scale no longer matches the catalog scale and cannot be valued safely.' })
      }
      const quote = await this.catalog.getLatestQuote(productId).catch(() => null)
      if (!quote || quote.stale) {
        throw new ConflictException({ code: 'PORTFOLIO_QUOTE_STALE', message: 'A stale or missing quote prevents a complete portfolio snapshot.' })
      }
      if (!isUsdUsdtEquivalent(quote.currency)) {
        throw new ConflictException({ code: 'PORTFOLIO_QUOTE_CURRENCY_UNSUPPORTED', message: 'Portfolio market-value snapshots currently support USD or USDT at a 1:1 settlement rate.' })
      }
      return { productId, ...position, quote }
    }))

    const { saved, capturedAt } = await this.snapshotRepo.manager.transaction(async (manager) => {
      const lockedRows = await manager.query(
        `SELECT product_id, outcome_key, asset_code, asset_decimals,
                quantity_atomic_amount::text AS quantity
           FROM app.positions
          WHERE user_id = $1 AND state = 'active' AND quantity_atomic_amount > 0
          ORDER BY product_id, outcome_key
          FOR UPDATE`,
        [userId],
      ) as Array<{ product_id: string; outcome_key: string; asset_code: string; asset_decimals: number; quantity: string }>
      const samePositions = rows.length === lockedRows.length && rows.every((row, index) => {
        const locked = lockedRows[index]
        return locked
          && row.product_id === locked.product_id
          && row.outcome_key === locked.outcome_key
          && row.asset_code === locked.asset_code
          && Number(row.asset_decimals) === Number(locked.asset_decimals)
          && BigInt(row.quantity) === BigInt(locked.quantity)
      })
      if (!samePositions) {
        throw new ConflictException({ code: 'PORTFOLIO_POSITIONS_CHANGED', message: 'Portfolio holdings changed while prices were being loaded. Retry the snapshot.' })
      }
      const capturedAt = new Date()
      const repo = manager.getRepository(PositionSnapshot)
      const entities = pricedPositions.map(({ productId, assetCode, assetDecimals, quantity, quote }) => repo.create({
        user_id: userId,
        snapshot_batch_id: snapshotBatchId,
        product_id: productId,
        asset_code: assetCode,
        asset_decimals: assetDecimals,
        quantity_atomic_amount: quantity.toString(),
        unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        unit_price_decimals: quote.unitPriceDecimals,
        currency: quote.currency,
        valued_at: quote.capturedAt,
        captured_at: capturedAt,
      }))
      return { saved: await repo.save(entities), capturedAt }
    })
    return {
      snapshotBatchId,
      capturedAt,
      snapshotCount: saved.length,
      positions: saved.map((snapshot) => ({
        productId: snapshot.product_id,
        assetCode: snapshot.asset_code,
        assetDecimals: snapshot.asset_decimals,
        quantityAtomicAmount: snapshot.quantity_atomic_amount,
        unitPriceAtomicAmount: snapshot.unit_price_atomic_amount,
        unitPriceDecimals: snapshot.unit_price_decimals ?? 6,
        currency: snapshot.currency,
        valuedAt: snapshot.valued_at,
        source: 'snapshot',
      })),
    }
  }

  // 历史表现：快照市值换算为六位 USDT atomics；USD/USDT 按用户确认的 1:1 汇总。
  async history(userId: string, productId?: string, limit = 30): Promise<PerformancePoint[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const where = productId ? ` AND product_id = $2` : ` AND snapshot_batch_id IS NOT NULL`
    const params: unknown[] = productId ? [userId, productId, safeLimit] : [userId, safeLimit]
    const rows = await this.snapshotRepo.query(
      `WITH snapshot_values AS (
         SELECT COALESCE(snapshot_batch_id::text, 'product:' || product_id::text || ':' || captured_at::text) AS snapshot_key,
                captured_at,
                CASE WHEN currency IN ('USD', 'USDT') THEN 'USDT' ELSE currency END AS currency,
                quantity_atomic_amount::numeric * unit_price_atomic_amount::numeric
                  * power(10::numeric, GREATEST(${SETTLEMENT_ASSET_DECIMALS} - unit_price_decimals, 0)::numeric)
                  / power(10::numeric, (asset_decimals + GREATEST(unit_price_decimals - ${SETTLEMENT_ASSET_DECIMALS}, 0))::numeric)
                  AS settlement_atomic_value
           FROM app.position_snapshots
          WHERE user_id = $1 AND unit_price_decimals IS NOT NULL AND currency IN ('USD', 'USDT')${where}
       )
       SELECT MAX(v.captured_at) AS "capturedAt",
              TRUNC(SUM(v.settlement_atomic_value))::text AS "totalValueAtomicAmount",
              v.currency,
              ${SETTLEMENT_ASSET_DECIMALS}::int AS "currencyDecimals"
         FROM snapshot_values v
        GROUP BY v.snapshot_key, v.currency
        ORDER BY MAX(v.captured_at) DESC
        LIMIT ${productId ? '$3' : '$2'}`,
      params,
    )
    return rows.map((r: Record<string, unknown>) => ({
      capturedAt: r.capturedAt as Date,
      totalValueAtomicAmount: r.totalValueAtomicAmount as string,
      currency: r.currency as string,
      currencyDecimals: Number(r.currencyDecimals),
    }))
  }

  // 赎回：仅创建请求记录 + 预览估值，执行链路依赖 API-008（订单）
  async requestRedemption(dto: {
    user_id: string
    product_id: string
    quantity_atomic_amount: string
    destination_address?: string
    request_id: string
  }, expectedQuote?: {unitPriceAtomicAmount: string;unitPriceDecimals: number;currency: string;validUntil: Date}): Promise<RedemptionView> {
    if (!/^[0-9]{1,78}$/.test(dto.quantity_atomic_amount) || BigInt(dto.quantity_atomic_amount) <= 0n) {
      throw new BadRequestException({ code: 'PORTFOLIO_INVALID_QUANTITY', message: 'Quantity must be a positive integer atomic amount of at most 78 digits.' })
    }
    if (!dto.request_id?.trim() || dto.request_id.length > 128) {
      throw new BadRequestException({ code: 'PORTFOLIO_INVALID_REQUEST_ID', message: 'Request ID must contain 1 to 128 characters.' })
    }
    return this.redemptionRepo.manager.transaction(async (manager) => {
      // The database key is globally unique. Serialize that key before reading it,
      // including cross-user collisions, without disclosing another user's record.
      await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`portfolio-redemption:${dto.request_id}`])
      const repo = manager.getRepository(Redemption)
      const existing = await repo.findOne({ where: { request_id: dto.request_id } })
      if (existing) {
        if (existing.user_id !== dto.user_id || existing.product_id !== dto.product_id
          || BigInt(existing.quantity_atomic_amount) !== BigInt(dto.quantity_atomic_amount)
          || (existing.destination_address ?? '') !== (dto.destination_address ?? '')) {
          throw new ConflictException({ code: 'PORTFOLIO_IDEMPOTENCY_CONFLICT', message: 'Request ID has already been used for another redemption intent.' })
        }
        return this.toRedemptionView(existing)
      }
      const product = await this.catalog.getProduct(dto.product_id).catch(() => null)
      if (!product) throw PortfolioError.productNotFound(dto.product_id)
      const quote = await this.catalog.getLatestQuote(dto.product_id).catch(() => null)
      if (!quote || quote.stale) throw PortfolioError.quoteStale(dto.product_id)
      if (expectedQuote && (quote.unitPriceAtomicAmount !== expectedQuote.unitPriceAtomicAmount || quote.unitPriceDecimals !== expectedQuote.unitPriceDecimals || quote.currency !== expectedQuote.currency || expectedQuote.validUntil.getTime() <= Date.now())) throw new ConflictException('The authorized redemption quote changed')
      if (!isUsdUsdtEquivalent(quote.currency)) {
        throw new ConflictException({ code: 'REDEMPTION_QUOTE_CURRENCY_UNSUPPORTED', message: 'Redemption quotes currently support USD or USDT at a 1:1 settlement rate.' })
      }
      // Completion locks redemption then position. Here we only lock position;
      // the reservation SUM never locks redemption rows, avoiding reversed locks.
      const positions = await manager.query(
        `SELECT quantity_atomic_amount::text AS quantity, asset_code, asset_decimals FROM app.positions
         WHERE user_id = $1 AND product_id = $2 AND outcome_key = 'long' AND state = 'active' FOR UPDATE`,
        [dto.user_id, dto.product_id],
      ) as Array<{ quantity: string; asset_code?: string; asset_decimals: number }>
      const positionScales = new Set(positions.map((position) => Number(position.asset_decimals)))
      const positionAssetCodes = new Set(positions.map((position) => position.asset_code).filter((code): code is string => typeof code === 'string'))
      if (positionScales.size > 1 || positionAssetCodes.size > 1) {
        throw new ConflictException({ code: 'REDEMPTION_PRODUCT_SCALE_MISMATCH', message: 'Active positions use incompatible asset units or scales and cannot be redeemed safely.' })
      }
      const pending = await manager.query(
        `SELECT COALESCE(SUM(quantity_atomic_amount), 0)::text AS quantity FROM app.redemptions
         WHERE user_id = $1 AND product_id = $2 AND state IN ('requested', 'queued', 'executing')`,
        [dto.user_id, dto.product_id],
      ) as Array<{ quantity: string }>
      const held = positions.reduce((sum, position) => sum + BigInt(position.quantity), 0n)
      const reserved = BigInt(pending[0]?.quantity ?? '0')
      if (BigInt(dto.quantity_atomic_amount) > held - reserved) {
        throw new ConflictException({ code: 'REDEMPTION_INSUFFICIENT_POSITION', message: 'The requested quantity exceeds the unreserved active long position.' })
      }
      const storedAssetDecimals = positions[0]?.asset_decimals
      const assetDecimals = storedAssetDecimals == null ? product.assetDecimals : Number(storedAssetDecimals)
      const storedAssetCode = positions[0]?.asset_code
      if (storedAssetCode != null && (storedAssetCode !== product.assetCode || assetDecimals !== product.assetDecimals)) {
        throw new ConflictException({ code: 'REDEMPTION_PRODUCT_SCALE_CHANGED', message: 'The current product unit does not match the active position unit; redemption is blocked until the units are reconciled.' })
      }
      const estimatedPayout = calculateSettlementPayoutAtomic(
        BigInt(dto.quantity_atomic_amount),
        assetDecimals,
        quote.unitPriceDecimals,
        SETTLEMENT_ASSET_DECIMALS,
        BigInt(quote.unitPriceAtomicAmount),
      )
      if (estimatedPayout <= 0n) {
        throw new BadRequestException({ code: 'REDEMPTION_PAYOUT_ROUNDS_TO_ZERO', message: 'The requested quantity is too small to produce a positive settlement amount at the current quote.' })
      }
      const r = await repo.save(repo.create({
        user_id: dto.user_id,
        product_id: dto.product_id,
        asset_code: product.assetCode,
        asset_decimals: positions[0]?.asset_decimals ?? product.assetDecimals,
        quantity_atomic_amount: BigInt(dto.quantity_atomic_amount).toString(),
        estimated_unit_price_atomic_amount: quote.unitPriceAtomicAmount,
        quote_decimals: quote.unitPriceDecimals,
        currency: quote.currency,
        destination_address: dto.destination_address,
        state: 'requested',
        requested_at: new Date(),
        request_id: dto.request_id,
      }))
      return this.toRedemptionView(r)
    })
  }

  async listRedemptions(userId: string): Promise<RedemptionView[]> {
    const rows = await this.redemptionRepo.find({
      where: { user_id: userId },
      order: { requested_at: 'DESC' },
    })
    return rows.map((r) => this.toRedemptionView(r))
  }

  async cancelRedemption(id: string, userId: string): Promise<RedemptionView> {
    return this.redemptionRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Redemption)
      const r = await repo.findOne({ where: { id, user_id: userId }, lock: { mode: 'pessimistic_write' } })
      if (!r) throw PortfolioError.redemptionNotFound(id)
      if (r.state !== 'requested' && r.state !== 'queued') {
        throw PortfolioError.redemptionStateInvalid(id, r.state)
      }
      r.state = 'canceled'
      r.canceled_at = new Date()
      return this.toRedemptionView(await repo.save(r))
    })
  }

  private toRedemptionView(r: Redemption): RedemptionView {
    return {
      id: r.id,
      productId: r.product_id,
      assetCode: r.asset_code,
      quantityAtomicAmount: r.quantity_atomic_amount,
      estimatedUnitPriceAtomicAmount: r.estimated_unit_price_atomic_amount,
      estimatedUnitPriceDecimals: r.quote_decimals,
      currency: r.currency,
      destinationAddress: r.destination_address,
      state: r.state,
      requestedAt: r.requested_at,
    }
  }
}
