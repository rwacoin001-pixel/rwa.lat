/**
 * Basket holdings read: `/v1/basket/me/positions`, one net row per portfolio (closed portfolios included).
 * Units and NAV are 18-decimal atomic strings, market value is six-decimal USDT atomics and comes from the
 * server only. Aggregation is BigInt only; a missing/non-ok valuation is unknown, never zero.
 */
import { request } from './_http'
import type { ApiResult } from './_http'

export type BasketValuationQuality = 'ok' | 'partial' | 'stale' | 'unavailable'
export type BasketPosition = {
  portfolioId: string
  portfolioName: string
  portfolioStatus: string
  units: string
  unitsAtomicAmount: string
  unitsDecimals: 18
  navPerUnit: string | null
  navAtomicAmount: string | null
  navDecimals: 18
  marketValueAtomicAmount: string | null
  currency: 'USDT'
  valuedAt: string | null
  valuationQuality: BasketValuationQuality
}

export const BASKET_UNIT_DECIMALS = 18

const QUALITIES: readonly BasketValuationQuality[] = ['ok', 'partial', 'stale', 'unavailable']
const ATOMIC = /^\d+$/
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const atomicOrNull = (value: unknown) => typeof value === 'string' && ATOMIC.test(value) ? value : null

/** Returns null when the payload breaks the contract; callers must treat that as a failed read, not as "no baskets". */
export function normalizeBasketPositions(raw: unknown): BasketPosition[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const rows: BasketPosition[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const portfolioId = row.portfolioId, portfolioName = row.portfolioName
    const unitsAtomic = atomicOrNull(row.unitsAtomicAmount)
    if (!text(portfolioId) || !text(portfolioName) || unitsAtomic === null || row.unitsDecimals !== BASKET_UNIT_DECIMALS) return null
    if (seen.has(portfolioId)) return null
    seen.add(portfolioId)
    const nav = atomicOrNull(row.navAtomicAmount)
    if (nav !== null && row.navDecimals !== BASKET_UNIT_DECIMALS) return null
    // Zero net units is no holding; it must not make the portfolio total unavailable.
    if (BigInt(unitsAtomic) === BigInt(0)) continue
    const quality = QUALITIES.find((value) => value === row.valuationQuality) ?? 'unavailable'
    rows.push({
      portfolioId,
      portfolioName,
      portfolioStatus: typeof row.portfolioStatus === 'string' ? row.portfolioStatus : '',
      units: typeof row.units === 'string' ? row.units : '',
      unitsAtomicAmount: unitsAtomic,
      unitsDecimals: BASKET_UNIT_DECIMALS,
      navPerUnit: typeof row.navPerUnit === 'string' ? row.navPerUnit : null,
      navAtomicAmount: nav,
      navDecimals: BASKET_UNIT_DECIMALS,
      marketValueAtomicAmount: row.currency === 'USDT' ? atomicOrNull(row.marketValueAtomicAmount) : null,
      currency: 'USDT',
      valuedAt: typeof row.valuedAt === 'string' ? row.valuedAt : null,
      valuationQuality: quality,
    })
  }
  return rows
}

export async function listBasketPositions(): Promise<ApiResult<BasketPosition[]>> {
  const result = await request<unknown>('/v1/basket/me/positions')
  if (!result.ok) return result
  const rows = normalizeBasketPositions(result.data)
  return rows ? { ok: true, data: rows } : { ok: false, error: { status: 0, code: 'INVALID_BASKET_POSITIONS', message: '服务返回了无法解析的数据' } }
}

/** Server market value; known only for an `ok` valuation. */
export function basketMarketValue(position: BasketPosition): bigint | null {
  const value = position.marketValueAtomicAmount
  return position.valuationQuality === 'ok' && value !== null && ATOMIC.test(value) ? BigInt(value) : null
}

/** Products + baskets in six-decimal USDT atomics; null unless every part is loaded and priced. */
export function holdingsTotal(productValue: bigint, productUnpriced: number, baskets: readonly BasketPosition[] | undefined): bigint | null {
  if (baskets === undefined || productUnpriced > 0) return null
  let total = productValue
  for (const basket of baskets) {
    const value = basketMarketValue(basket)
    if (value === null) return null
    total += value
  }
  return total
}

export function sortBasketPositions(positions: readonly BasketPosition[]): BasketPosition[] {
  return [...positions].sort((a, b) => {
    const left = basketMarketValue(a), right = basketMarketValue(b)
    if (left !== null && right !== null && left !== right) return left > right ? -1 : 1
    if ((left === null) !== (right === null)) return left === null ? 1 : -1
    return a.portfolioName.localeCompare(b.portfolioName) || (a.portfolioId < b.portfolioId ? -1 : a.portfolioId > b.portfolioId ? 1 : 0)
  })
}

const pow10 = (exponent: number) => BigInt(`1${'0'.repeat(exponent)}`)

/** Atomic string → localized decimal without ever passing through a float. Rounds half up past `maxFraction`. */
export function formatAtomicDecimal(atomic: string | null | undefined, decimals: number, locale: string, minFraction = 0, maxFraction = decimals): string {
  if (atomic == null || !ATOMIC.test(atomic) || !Number.isInteger(decimals) || decimals < 0 || decimals > 21) return '—'
  const keep = Math.max(0, Math.min(maxFraction, decimals))
  let value = BigInt(atomic)
  if (keep < decimals) {
    const unit = pow10(decimals - keep)
    value = (value + unit / BigInt(2)) / unit
  }
  const digits = value.toString().padStart(keep + 1, '0')
  const whole = digits.slice(0, digits.length - keep)
  let fraction = keep ? digits.slice(digits.length - keep).replace(/0+$/, '') : ''
  if (fraction.length < minFraction) fraction = fraction.padEnd(Math.min(minFraction, keep), '0')
  const grouped = new Intl.NumberFormat(locale)
  const integer = grouped.format(BigInt(whole))
  if (!fraction) return integer
  const separator = grouped.formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.'
  const digitFormat = new Intl.NumberFormat(locale, { useGrouping: false })
  return `${integer}${separator}${Array.from(fraction, (digit) => digitFormat.format(Number(digit))).join('')}`
}
