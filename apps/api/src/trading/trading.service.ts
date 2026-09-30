import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { TradingFill, TradingOrder, TradingPair } from './trading.entities'
import { ComplianceService } from '../compliance/compliance.service'

const CANDLE_INTERVALS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

export interface PlaceOrderInput {
  symbol?: string
  pairId?: string
  side: 'buy' | 'sell'
  type?: 'limit' | 'market'
  price?: number
  quantity: number
  idempotencyKey?: string
}

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(TradingPair) private readonly pairs: Repository<TradingPair>,
    @InjectRepository(TradingOrder) private readonly orders: Repository<TradingOrder>,
    @InjectRepository(TradingFill) private readonly fills: Repository<TradingFill>,
    private readonly dataSource: DataSource,
    private readonly compliance: ComplianceService,
  ) {}

  async listPairs() {
    const rows = await this.pairs.find({ where: { state: 'active' }, order: { symbol: 'ASC' } })
    return rows.map((pair) => this.toPairView(pair))
  }

  async getPair(symbolOrId: string) {
    const pair = await this.findPair(symbolOrId)
    return this.toPairView(pair)
  }

  async getOrderBook(symbolOrId: string, depth = 20) {
    const pair = await this.findPair(symbolOrId)
    const [bids, asks] = await Promise.all([
      this.orders
        .createQueryBuilder('o')
        .where('o.pair_id = :pairId AND o.side = :side AND o.state IN (:...states)', {
          pairId: pair.id,
          side: 'buy',
          states: ['open', 'partial'],
        })
        .orderBy('o.price', 'DESC')
        .addOrderBy('o.created_at', 'ASC')
        .limit(200)
        .getMany(),
      this.orders
        .createQueryBuilder('o')
        .where('o.pair_id = :pairId AND o.side = :side AND o.state IN (:...states)', {
          pairId: pair.id,
          side: 'sell',
          states: ['open', 'partial'],
        })
        .orderBy('o.price', 'ASC')
        .addOrderBy('o.created_at', 'ASC')
        .limit(200)
        .getMany(),
    ])
    return {
      symbol: pair.symbol,
      bids: this.aggregateLevels(bids, depth).map(([price, quantity]) => ({ price, quantity })),
      asks: this.aggregateLevels(asks, depth).map(([price, quantity]) => ({ price, quantity })),
      lastPrice: pair.lastPrice,
      updatedAt: new Date().toISOString(),
    }
  }

  async getRecentTrades(symbolOrId: string, limit = 50) {
    const pair = await this.findPair(symbolOrId)
    const rows = await this.fills.find({
      where: { pairId: pair.id },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    })
    return rows.map((fill) => ({
      id: fill.id,
      price: fill.price,
      quantity: fill.quantity,
      at: fill.createdAt.toISOString(),
    }))
  }

  async getCandles(symbolOrId: string, interval: string, limit = 200) {
    const intervalSeconds = CANDLE_INTERVALS[interval]
    if (!intervalSeconds) {
      throw new BadRequestException({ code: 'TRADING_BAD_INTERVAL', message: `interval must be one of ${Object.keys(CANDLE_INTERVALS).join(', ')}` })
    }
    const pair = await this.findPair(symbolOrId)
    const boundedLimit = Math.min(Math.max(limit, 1), 500)
    const rows: {
      bucket: Date
      open: string
      high: string
      low: string
      close: string
      volume: string
    }[] = await this.dataSource.query(
      `SELECT
         to_timestamp(floor(extract(epoch FROM created_at) / $1::numeric) * $1::numeric) AS bucket,
         (array_agg(price ORDER BY created_at ASC))[1] AS open,
         max(price) AS high,
         min(price) AS low,
         (array_agg(price ORDER BY created_at DESC))[1] AS close,
         sum(quantity) AS volume
       FROM app.trading_fills
       WHERE pair_id = $2
         AND created_at >= now() - ($1::numeric * $3::numeric * interval '1 second')
       GROUP BY bucket
       ORDER BY bucket DESC
       LIMIT $3`,
      [intervalSeconds, pair.id, boundedLimit],
    )
    const ordered = rows.reverse()
    return {
      symbol: pair.symbol,
      interval,
      candles: ordered.map((row) => ({
        time: new Date(row.bucket).toISOString(),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      })),
    }
  }

  async placeOrder(userId: string, input: PlaceOrderInput) {
    const pair = await this.findPair(input.pairId ?? input.symbol ?? '')
    if (pair.state !== 'active') {
      throw new BadRequestException({ code: 'TRADING_PAIR_INACTIVE', message: 'This market is not open for trading.' })
    }
    const type = input.type ?? 'limit'
    const quantity = Number(input.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException({ code: 'TRADING_BAD_QUANTITY', message: 'quantity must be positive.' })
    }
    if (quantity < pair.minQuantity) {
      throw new BadRequestException({ code: 'TRADING_BELOW_MIN', message: `Minimum quantity is ${pair.minQuantity}.` })
    }
    let price: number | null = null
    if (type === 'limit') {
      price = Number(input.price)
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException({ code: 'TRADING_BAD_PRICE', message: 'price must be positive for limit orders.' })
      }
      const ticks = Math.round(price / pair.tickSize)
      price = Number((ticks * pair.tickSize).toFixed(10))
    }
    if (input.idempotencyKey) {
      const existing = await this.orders.findOne({ where: { userId, idempotencyKey: input.idempotencyKey } })
      if (existing) return this.orderView(existing, pair)
    }
    await this.compliance.requireInvestmentEligibility(userId, 'trading')
    const order = await this.orders.save(
      this.orders.create({
        id: randomUUID(),
        pairId: pair.id,
        userId,
        side: input.side,
        type,
        price,
        quantity,
        filledQuantity: 0,
        state: 'open',
        idempotencyKey: input.idempotencyKey ?? null,
      }),
    )
    try {
      await this.match(order, pair)
    } catch (error) {
      if (error instanceof ConflictException) throw error
      throw error
    }
    const settled = await this.orders.findOneOrFail({ where: { id: order.id } })
    const view = this.orderView(settled, pair)
    if (settled.type === 'market' && Number(settled.filledQuantity) > 0) {
      const raw = await this.fills
        .createQueryBuilder('f')
        .select('SUM(f.price * f.quantity) / SUM(f.quantity)', 'avg')
        .where('f.buy_order_id = :id OR f.sell_order_id = :id', { id: settled.id })
        .getRawOne<{ avg: string | null }>()
      view.price = raw?.avg != null ? Number(raw.avg) : null
    }
    return view
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId } })
    if (!order) {
      throw new NotFoundException({ code: 'TRADING_ORDER_NOT_FOUND', message: 'Order not found.' })
    }
    if (order.state !== 'open' && order.state !== 'partial') {
      throw new ConflictException({ code: 'TRADING_ORDER_NOT_CANCELLABLE', message: 'Only open orders can be cancelled.' })
    }
    order.state = 'cancelled'
    order.updatedAt = new Date()
    await this.orders.save(order)
    const pair = await this.findPair(order.pairId)
    return this.orderView(order, pair)
  }

  async listMyOrders(userId: string, state?: string) {
    const where: Record<string, unknown> = { userId }
    if (state) where.state = state
    const rows = await this.orders.find({ where, order: { createdAt: 'DESC' }, take: 100 })
    const pairIds = [...new Set(rows.map((row) => row.pairId))]
    const pairs = pairIds.length ? await this.pairs.find({ where: pairIds.map((id) => ({ id })) }) : []
    const symbols = new Map(pairs.map((pair) => [pair.id, pair.symbol]))
    return rows.map((row) => ({
      id: row.id,
      symbol: symbols.get(row.pairId) ?? null,
      side: row.side,
      type: row.type,
      price: row.price,
      quantity: row.quantity,
      filledQuantity: row.filledQuantity,
      state: row.state,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId } })
    if (!order) {
      throw new NotFoundException({ code: 'TRADING_ORDER_NOT_FOUND', message: 'Order not found.' })
    }
    const pair = await this.findPair(order.pairId)
    const fills = await this.fills.find({
      where: [{ buyOrderId: order.id }, { sellOrderId: order.id }],
      order: { createdAt: 'ASC' },
    })
    return {
      ...this.orderView(order, pair),
      fills: fills.map((fill) => ({
        id: fill.id,
        price: fill.price,
        quantity: fill.quantity,
        at: fill.createdAt.toISOString(),
      })),
    }
  }

  // ─── matching engine ───

  private async match(taker: TradingOrder, pair: TradingPair) {
    // Simple loop: repeatedly take the best opposing order while price crosses.
    for (let guard = 0; guard < 100; guard += 1) {
      const remaining = Number(taker.quantity) - Number(taker.filledQuantity)
      if (remaining <= 0) break
      const opposing = await this.bestOpposing(taker, pair)
      if (!opposing) break
      const makerRemaining = Number(opposing.quantity) - Number(opposing.filledQuantity)
      if (makerRemaining <= 0) {
        opposing.state = opposing.filledQuantity > 0 ? 'partial' : 'rejected'
        await this.orders.save(opposing)
        continue
      }
      const fillPrice = Number(opposing.price ?? taker.price ?? pair.lastPrice ?? 0)
      if (!fillPrice || fillPrice <= 0) break
      const fillQuantity = Math.min(remaining, makerRemaining)
      await this.dataSource.transaction(async (manager) => {
        await manager.save(
          manager.create(TradingFill, {
            id: randomUUID(),
            pairId: pair.id,
            price: fillPrice,
            quantity: fillQuantity,
            buyOrderId: taker.side === 'buy' ? taker.id : opposing.id,
            sellOrderId: taker.side === 'buy' ? opposing.id : taker.id,
          }),
        )
        taker.filledQuantity = Number(taker.filledQuantity) + fillQuantity
        opposing.filledQuantity = Number(opposing.filledQuantity) + fillQuantity
        taker.state = taker.filledQuantity >= Number(taker.quantity) ? 'filled' : 'partial'
        opposing.state = opposing.filledQuantity >= Number(opposing.quantity) ? 'filled' : 'partial'
        taker.updatedAt = new Date()
        opposing.updatedAt = new Date()
        await manager.save(taker)
        await manager.save(opposing)
        pair.lastPrice = fillPrice
        pair.updatedAt = new Date()
        await manager.save(pair)
      })
    }
    if (taker.type === 'market' && Number(taker.filledQuantity) < Number(taker.quantity)) {
      // Market orders never rest on the book: cancel the unfilled remainder.
      taker.state = Number(taker.filledQuantity) > 0 ? 'partial' : 'rejected'
      taker.updatedAt = new Date()
      await this.orders.save(taker)
    }
  }

  private async bestOpposing(taker: TradingOrder, pair: TradingPair): Promise<TradingOrder | null> {
    const side = taker.side === 'buy' ? 'sell' : 'buy'
    const qb = this.orders
      .createQueryBuilder('o')
      .where('o.pair_id = :pairId AND o.side = :side AND o.state IN (:...states)', {
        pairId: pair.id,
        side,
        states: ['open', 'partial'],
      })
      .andWhere('o.id != :takerId', { takerId: taker.id })
      // Self-trade prevention (skip): never match the taker's own resting orders.
      .andWhere('o.user_id != :takerUserId', { takerUserId: taker.userId })
    if (taker.type === 'limit' && taker.price != null) {
      if (side === 'sell') {
        qb.andWhere('o.price <= :limit', { limit: taker.price })
        qb.orderBy('o.price', 'ASC')
      } else {
        qb.andWhere('o.price >= :limit', { limit: taker.price })
        qb.orderBy('o.price', 'DESC')
      }
    } else {
      qb.orderBy('o.price', side === 'sell' ? 'ASC' : 'DESC')
    }
    qb.addOrderBy('o.created_at', 'ASC')
    return qb.getOne()
  }

  // ─── helpers ───

  private aggregateLevels(orders: TradingOrder[], depth: number): [number, number][] {
    const levels = new Map<number, number>()
    for (const order of orders) {
      const price = Number(order.price ?? 0)
      if (!price) continue
      const remaining = Number(order.quantity) - Number(order.filledQuantity)
      if (remaining <= 0) continue
      if (levels.has(price)) {
        levels.set(price, levels.get(price)! + remaining)
      } else if (levels.size < depth * 3) {
        levels.set(price, remaining)
      }
    }
    return [...levels.entries()].slice(0, depth)
  }

  private async findPair(symbolOrId: string): Promise<TradingPair> {
    if (!symbolOrId) {
      throw new BadRequestException({ code: 'TRADING_PAIR_REQUIRED', message: 'A trading pair (symbol or pairId) is required.' })
    }
    const bySymbol = await this.pairs.findOne({ where: { symbol: symbolOrId } })
    if (bySymbol) return bySymbol
    if (/^[0-9a-f-]{36}$/i.test(symbolOrId)) {
      const byId = await this.pairs.findOne({ where: { id: symbolOrId } })
      if (byId) return byId
    }
    throw new NotFoundException({ code: 'TRADING_PAIR_NOT_FOUND', message: 'Trading pair not found.' })
  }

  private toPairView(pair: TradingPair) {
    return {
      id: pair.id,
      symbol: pair.symbol,
      baseAssetId: pair.baseAssetId,
      quoteAssetCode: pair.quoteAssetCode,
      tickSize: pair.tickSize,
      minQuantity: pair.minQuantity,
      state: pair.state,
      lastPrice: pair.lastPrice,
      updatedAt: pair.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    }
  }

  private orderView(order: TradingOrder, pair: TradingPair) {
    return {
      id: order.id,
      symbol: pair.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      state: order.state,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }
  }
}
