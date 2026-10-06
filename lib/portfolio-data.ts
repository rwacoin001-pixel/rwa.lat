/**
 * Portfolio data layer — real positions/history via Core API.
 */
import { apiClient } from './api-client'
import { shortId } from './display/labels'
import { basketMarketValue, BASKET_UNIT_DECIMALS, listBasketPositions, type BasketPosition } from './api/basket-positions'

export type ApiPosition = {
  productId: string
  outcomeKey: string
  assetCode: string
  assetDecimals: number
  quantityAtomicAmount: string
  costAtomicAmount?: string
  cumulativeYieldAtomicAmount?: string
  unitPriceAtomicAmount: string
  unitPriceDecimals: number
  currency: string
  valuedAt: string
  source?: string
}

export type PositionView = ApiPosition & {
  productName: string
  productClass: string
  quantity: number
  cost: number
  costKnown: boolean
  yield: number
  yieldKnown: boolean
  unitPrice: number
  marketValue: number
  /** Exact six-decimal USDT settlement amount; use this for sums and percentages. */
  marketValueAtomicAmount: string | null
}

const parseAtomic = (value: string | number | null | undefined): bigint | null => {
  if (value === null || value === undefined) return null
  const raw = String(value)
  if (!/^-?\d+$/.test(raw)) return null
  try { return BigInt(raw) } catch { return null }
}

const powerOfTen = (decimals: number): bigint => {
  let value = BigInt(1)
  for (let index = 0; index < decimals; index += 1) value *= BigInt(10)
  return value
}

/** Exact market value normalized to six-decimal USDT atomics; null means unknown/unusable. */
export function positionMarketValueAtomic(pos: Pick<ApiPosition, 'quantityAtomicAmount' | 'assetDecimals' | 'unitPriceAtomicAmount' | 'unitPriceDecimals' | 'currency'>): bigint | null {
  const quantity = parseAtomic(pos.quantityAtomicAmount)
  const price = parseAtomic(pos.unitPriceAtomicAmount)
  if (quantity === null || price === null || quantity < BigInt(0) || price <= BigInt(0)) return null
  if (!Number.isInteger(pos.assetDecimals) || pos.assetDecimals < 0 || pos.assetDecimals > 30) return null
  if (!Number.isInteger(pos.unitPriceDecimals) || pos.unitPriceDecimals < 0 || pos.unitPriceDecimals > 30) return null
  if (pos.currency !== 'USD' && pos.currency !== 'USDT') return null
  const quoteScale = 6 - pos.unitPriceDecimals
  const numerator = quantity * price * (quoteScale > 0 ? powerOfTen(quoteScale) : BigInt(1))
  const denominator = powerOfTen(pos.assetDecimals) * (quoteScale < 0 ? powerOfTen(-quoteScale) : BigInt(1))
  return numerator / denominator
}

/** Exact six-decimal USDT total; returns null if any included position is not valuated. */
export function sumPositionMarketValueAtomic(positions: readonly Pick<PositionView, 'marketValueAtomicAmount'>[]): string | null {
  let total = BigInt(0)
  for (const position of positions) {
    const value = position.marketValueAtomicAmount
    if (value === null || !/^\d+$/.test(value)) return null
    try { total += BigInt(value) } catch { return null }
  }
  return total.toString()
}

export const toUnits = (atomic: string | number | null | undefined, decimals = 6): number => {
  if (atomic === null || atomic === undefined) return 0
  const n = typeof atomic === 'string' ? Number(atomic) : atomic
  if (!Number.isFinite(n)) return 0
  return n / 10 ** decimals
}

/** One legacy row per basket portfolio; atomics stay exact strings, floats are display-only, cost/yield are unknown. */
export function basketPositionToView(basket: BasketPosition): PositionView {
  const marketValueAtomicAmount = basketMarketValue(basket)?.toString() ?? null
  return {
    productId: basket.portfolioId,
    outcomeKey: 'basket',
    assetCode: 'BASKET',
    assetDecimals: BASKET_UNIT_DECIMALS,
    quantityAtomicAmount: basket.unitsAtomicAmount,
    unitPriceAtomicAmount: basket.navAtomicAmount ?? '0',
    unitPriceDecimals: BASKET_UNIT_DECIMALS,
    currency: basket.currency,
    valuedAt: basket.valuedAt ?? '',
    source: 'basket',
    productName: basket.portfolioName,
    productClass: 'basket',
    quantity: toUnits(basket.unitsAtomicAmount, BASKET_UNIT_DECIMALS),
    cost: 0,
    costKnown: false,
    yield: 0,
    yieldKnown: false,
    unitPrice: toUnits(basket.navAtomicAmount, BASKET_UNIT_DECIMALS),
    marketValue: marketValueAtomicAmount === null ? 0 : Number(marketValueAtomicAmount) / 1_000_000,
    marketValueAtomicAmount,
  }
}

/** 拉持仓（产品 + 篮子）并 join 产品目录（产品名/类别）。篮子读取失败时整体失败，避免返回不完整的合计。 */
export async function getPositions(): Promise<PositionView[]> {
  const [r, basketResult] = await Promise.all([apiClient.axios.get('/v1/portfolio/positions'), listBasketPositions()])
  if (!basketResult.ok) throw Object.assign(new Error(basketResult.error.message), { status: basketResult.error.status, code: basketResult.error.code })
  const raw: ApiPosition[] = Array.isArray(r.data) ? (r.data as ApiPosition[]) : ((r.data as { items?: ApiPosition[] })?.items ?? [])
  let items: Array<{ id: string; displayName?: string; assetClassId?: string }> = []
  try {
    const pr = await apiClient.axios.get('/v1/catalog/products')
    items = Array.isArray(pr.data) ? pr.data : (pr.data?.items ?? [])
  } catch {
    items = []
  }
  const productMap = new Map<string, { name: string; cls: string }>()
  for (const p of items) {
    productMap.set(p.id, { name: p.displayName ?? p.id, cls: p.assetClassId ?? 'rwa' })
  }
  const products = raw.map((pos) => {
    const meta = productMap.get(pos.productId)
    const units = toUnits(pos.quantityAtomicAmount, pos.assetDecimals)
    const cost = toUnits(pos.costAtomicAmount, 6)
    const unitPrice = toUnits(pos.unitPriceAtomicAmount, pos.unitPriceDecimals)
    const marketValueAtomicAmount = positionMarketValueAtomic(pos)?.toString() ?? null
    return {
      ...pos,
      productName: meta?.name ?? shortId(pos.productId),
      productClass: meta?.cls ?? 'rwa',
      quantity: units,
      cost,
      costKnown: parseAtomic(pos.costAtomicAmount) !== null,
      yield: toUnits(pos.cumulativeYieldAtomicAmount, 6),
      yieldKnown: parseAtomic(pos.cumulativeYieldAtomicAmount) !== null,
      unitPrice,
      marketValue: marketValueAtomicAmount === null ? 0 : Number(marketValueAtomicAmount) / 1_000_000,
      marketValueAtomicAmount,
    }
  })
  return [...products, ...basketResult.data.map(basketPositionToView)]
}

export type PortfolioHistoryPoint = { date: string; value: number }
type ApiPortfolioHistoryPoint = {
  capturedAt: string
  totalValueAtomicAmount: string
  currency: string
  currencyDecimals: number
}

export async function getPortfolioHistory(): Promise<PortfolioHistoryPoint[]> {
  try {
    const r = await apiClient.axios.get('/v1/portfolio/history')
    const d = r.data
    if (!Array.isArray(d)) return []
    return (d as ApiPortfolioHistoryPoint[])
      .map((point) => {
        const atomic = /^-?\d+$/.test(point.totalValueAtomicAmount) ? Number(point.totalValueAtomicAmount) : Number.NaN
        const decimals = Number(point.currencyDecimals)
        const date = new Date(point.capturedAt)
        return { date: Number.isFinite(date.getTime()) ? date.toISOString() : '', value: Number.isFinite(atomic) && Number.isInteger(decimals) && decimals >= 0 && decimals <= 30 ? atomic / 10 ** decimals : Number.NaN }
      })
      .filter((point) => point.date.length > 0 && Number.isFinite(point.value))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  } catch {
    return []
  }
}
