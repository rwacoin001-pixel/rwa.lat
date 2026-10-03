/**
 * Assets domain reads. All amounts stay atomic strings; aggregation is BigInt only.
 * Position market values and ledger cost/yield are normalized to six-decimal USDT atomics;
 * USD and USDT use the locally confirmed 1:1 equivalence.
 */
import { request } from './_http'
import type { OrdersDto, PortfolioHistoryDto, PortfolioPositionsDto, PortfolioSnapshotBatchDto, YieldDto } from './contracts'

export type Position = PortfolioPositionsDto[number]
export type PortfolioPoint = PortfolioHistoryDto[number]
export type YieldCredit = YieldDto[number]
export type ExpectedDistribution = {
  id: string
  productId: string
  productName: string
  paymentDate: string
  recordDate: string
  periodStart: string
  periodEnd: string
  expectedAtomicAmount: string | null
  assetCode: 'USDT'
  assetDecimals: 6
  estimated: true
  scheduleMode: 'product_calendar' | 'position_anniversary'
  timezone: string
}

export const SETTLEMENT_DECIMALS = 6

export const listPositions = () => request<PortfolioPositionsDto>('/v1/portfolio/positions')
export const getPortfolioHistory = (productId?: string) => request<PortfolioHistoryDto>(`/v1/portfolio/history${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`)
export const listYield = () => request<YieldDto>('/v1/yield')
export const listExpectedDistributions = () => request<ExpectedDistribution[]>('/v1/yield/schedule')
export const listOrders = () => request<OrdersDto>('/v1/orders')

export type RebalanceLeg = {
  id: string
  productId: string
  productName: string
  kind: 'sell' | 'buy'
  targetBps: number
  requestedAmountAtomic: string | null
  requestedQuantityAtomic: string | null
  actualAmountAtomic: string | null
  state: 'planned' | 'submitted' | 'completed' | 'failed'
  redemptionId: string | null
  redemptionState: string | null
  orderId: string | null
  orderState: string | null
  failureCode: string | null
}
export type RebalancePlan = {
  id: string
  state: 'submitting_redemptions' | 'redemptions_submitted' | 'awaiting_buy_confirmation' | 'submitting_buys' | 'buy_orders_submitted' | 'completed' | 'canceled' | 'attention'
  targets: Array<{ productId: string; targetBps: number }>
  initialValueAtomic: string
  sellProceedsAtomic: string
  sellConfirmedAt: string
  buyConfirmedAt: string | null
  createdAt: string
  updatedAt: string
  legs: RebalanceLeg[]
}
export const listRebalances = () => request<RebalancePlan[]>('/v1/portfolio/rebalances')
export const createRebalance = (targets: Array<{ productId: string; targetBps: number }>, idempotencyKey: string) =>
  request<RebalancePlan>('/v1/portfolio/rebalances', { method: 'POST', body: JSON.stringify({ targets, sellConfirmed: true }), idempotencyKey })
export const confirmRebalanceBuys = (id: string, idempotencyKey: string) =>
  request<RebalancePlan>(`/v1/portfolio/rebalances/${encodeURIComponent(id)}/confirm-buys`, { method: 'POST', body: JSON.stringify({ buyConfirmed: true }), idempotencyKey })
export const cancelRebalance = (id: string) => request<RebalancePlan>(`/v1/portfolio/rebalances/${encodeURIComponent(id)}/cancel`, { method: 'PUT' })

/** portfolio.service toRedemptionView. The request only records intent: quantity is checked against the position at completion. */
export type Redemption = {
  id: string; productId: string; assetCode: string; quantityAtomicAmount: string; estimatedUnitPriceAtomicAmount: string
  estimatedUnitPriceDecimals: number; currency: string; destinationAddress: string | null
  state: 'requested' | 'queued' | 'executing' | 'completed' | 'failed' | 'canceled'; requestedAt: string
}
export const REDEMPTION_OPEN = new Set(['requested', 'queued', 'executing'])
export const REDEMPTION_CANCELLABLE = new Set(['requested', 'queued'])
export const listRedemptions = () => request<Redemption[]>('/v1/portfolio/redemptions')
/** `requestId` is UNIQUE server side; reuse it for a retry of the same intent. */
export const requestRedemption = (body: { productId: string; quantityAtomicAmount: string; requestId: string }) => request<Redemption>('/v1/portfolio/redemptions', { method: 'POST', body: JSON.stringify(body) })
export const cancelRedemption = (id: string) => request<Redemption>(`/v1/portfolio/redemptions/${encodeURIComponent(id)}/cancel`, { method: 'PUT' })

export const capturePortfolioSnapshot = () => request<PortfolioSnapshotBatchDto>('/v1/portfolio/snapshots/batch', { method: 'POST' })

const big = (value: string | null | undefined) => {
  try { return value != null && /^-?\d+$/.test(value) ? BigInt(value) : null } catch { return null }
}
const pow10 = (decimals: number) => BigInt(`1${'0'.repeat(Math.max(0, Math.min(decimals, 78)))}`)

/** Market value in quote atomic units; null when quantity or price is unusable (never silently 0). */
export function marketValueAtomic(position: Position): bigint | null {
  const quantity = big(position.quantityAtomicAmount)
  const price = big(position.unitPriceAtomicAmount)
  if (quantity === null || price === null || price <= BigInt(0)) return null
  if (!Number.isInteger(position.assetDecimals) || position.assetDecimals < 0 || position.assetDecimals > 30) return null
  if (!Number.isInteger(position.unitPriceDecimals) || position.unitPriceDecimals < 0 || position.unitPriceDecimals > 30) return null
  if (position.currency !== 'USD' && position.currency !== 'USDT') return null
  const quoteToSettlementScale = SETTLEMENT_DECIMALS - position.unitPriceDecimals
  const numerator = quantity * price * (quoteToSettlementScale > 0 ? pow10(quoteToSettlementScale) : BigInt(1))
  const denominator = pow10(position.assetDecimals) * (quoteToSettlementScale < 0 ? pow10(-quoteToSettlementScale) : BigInt(1))
  return numerator / denominator
}

export type PositionRow = { position: Position; value: bigint | null; cost: bigint; yield: bigint; pnl: bigint | null }
export type PortfolioTotals = { rows: PositionRow[]; value: bigint; cost: bigint; yield: bigint; pnl: bigint; unpriced: number }

export function totalsFor(positions: Position[]): PortfolioTotals {
  const zero = BigInt(0)
  const rows = positions.map((position) => {
    const value = marketValueAtomic(position)
    const cost = big(position.costAtomicAmount) ?? zero
    return { position, value, cost, yield: big(position.cumulativeYieldAtomicAmount) ?? zero, pnl: value === null ? null : value - cost }
  })
  const priced = rows.filter((row) => row.value !== null)
  return {
    rows,
    value: priced.reduce((sum, row) => sum + (row.value as bigint), zero),
    cost: rows.reduce((sum, row) => sum + row.cost, zero),
    yield: rows.reduce((sum, row) => sum + row.yield, zero),
    pnl: priced.reduce((sum, row) => sum + (row.pnl as bigint), zero),
    unpriced: rows.length - priced.length,
  }
}

/** Share of `part` in `whole` as a 0..1 ratio for bars; display rounding only. */
export function share(part: bigint | null, whole: bigint): number {
  if (part === null || whole <= BigInt(0) || part <= BigInt(0)) return 0
  return Number(part * BigInt(10_000) / whole) / 10_000
}
