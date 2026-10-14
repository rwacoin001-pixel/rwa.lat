/** Shared display formatting for user-facing money values. */
export const PRICE_DECIMALS = 6
export const USDT_DECIMALS = 6
// Verify APY against a non-null source before rendering it; null is not evidence of scale.
export const APY_SCALE = 'unverified-from-data' as const
export const APY_IS_RATIO: boolean | null = null
export const DECIMAL_6 = /^\d+(\.\d{1,6})?$/
export const DECIMAL_8 = /^\d+(\.\d{1,8})?$/
function validDecimals(decimals: number) { return Number.isInteger(decimals) && decimals >= 0 && decimals <= 78 }
export function fromAtomic(atomic: string | null | undefined, decimals: number): string {
  if (!validDecimals(decimals)) throw new RangeError('Invalid asset decimals')
  if (atomic == null || atomic === '') return '0'
  if (!/^-?\d+$/.test(atomic)) throw new TypeError('Invalid atomic amount')
  const canonical = BigInt(atomic).toString()
  const negative = canonical.startsWith('-')
  const digits = (negative ? canonical.slice(1) : canonical).padStart(decimals + 1, '0')
  const integer = decimals ? digits.slice(0, -decimals) : digits
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, '') : ''
  return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`
}
export function toAtomic(input: string, decimals: number): string | null {
  if (!validDecimals(decimals) || !/^\d+(\.\d+)?$/.test(input)) return null
  const [integer, fraction = ''] = input.split('.')
  if (fraction.length > decimals) return null
  return BigInt(integer + fraction.padEnd(decimals, '0')).toString()
}
export function addAtomic(...values: Array<string | null | undefined>): string {
  try { return values.reduce<bigint>((sum, value) => sum + BigInt(value ?? '0'), BigInt(0)).toString() }
  catch { return '0' }
}
type FormatOptions = { compact?: boolean; digits?: number; locale?: string }
function fixedDecimal(input: string, digits: number, locale = 'en-US') {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(input)
  if (!match || !Number.isInteger(digits) || digits < 0 || digits > 20) return '—'
  const [, sign, integer, fraction = ''] = match
  const padded = fraction.padEnd(digits + 1, '0')
  const rounded = BigInt(integer + padded.slice(0, digits)) + (padded[digits] >= '5' ? BigInt(1) : BigInt(0))
  const raw = rounded.toString().padStart(digits + 1, '0')
  const whole = digits ? raw.slice(0, -digits) : raw
  const sep = new Intl.NumberFormat(locale).formatToParts(1.1).find(p => p.type === 'decimal')?.value ?? '.'
  return `${sign && rounded !== BigInt(0) ? '-' : ''}${new Intl.NumberFormat(locale).format(BigInt(whole))}${digits ? sep + raw.slice(-digits) : ''}`
}
// Compact magnitudes carry a fixed "US" marker instead of a currency symbol. Intl's
// currency style is locale-shaped — "US$42.87亿" (zh-CN), "4,29 Mrd. $" (de-DE),
// "4,29 Md $US" (fr-FR), "4287,00 M US$" (es) — so the same data reads inconsistently
// across the shipped locales. Formatting the number alone and prefixing "US" is uniform.
export function fmtUsdCompact(input: string | number | null | undefined, options: FormatOptions = {}): string {
  if (input == null || input === '') return '—'
  const value = typeof input === 'number' ? input : Number(input)
  if (!Number.isFinite(value)) return '—'
  const magnitude = new Intl.NumberFormat(options.locale ?? 'en-US', { notation: 'compact', maximumFractionDigits: options.digits ?? 2 }).format(Math.abs(value))
  return `${value < 0 ? '-' : ''}US${magnitude}`
}
export function fmtUsd(input: string | null | undefined, options: FormatOptions = {}): string {
  if (input == null || !/^-?\d+(\.\d+)?$/.test(input)) return '—'
  if (options.compact) return fmtUsdCompact(input, options)
  const value = fixedDecimal(input, options.digits ?? 2, options.locale)
  return value === '—' ? value : value.startsWith('-') ? '-$' + value.slice(1) : '$' + value
}
export function fmtUsdt(input: string | null | undefined, options: FormatOptions = {}): string {
  if (input == null || input === '') return '—'
  try { const value = fixedDecimal(fromAtomic(input, USDT_DECIMALS), options.digits ?? 2, options.locale); return value === '—' ? value : `${value} USDT` } catch { return '—' }
}
export function fmtPct(input: string | null | undefined, options: { signed?: boolean } = {}): string {
  if (input == null || input === '') return '—'
  const value = fixedDecimal(input, 2)
  return value === '—' ? value : `${options.signed && !value.startsWith('-') && value !== '0.00' ? '+' : ''}${value}%`
}
/** Display digits for an atomic unit price: 2 at or above one unit, up to PRICE_DECIMALS (trailing zeros dropped) below it. */
export function priceDigits(atomic: string | null | undefined, decimals: number): number {
  let value: string
  try { value = fromAtomic(atomic, decimals) } catch { return 2 }
  const [integer, fraction = ''] = value.replace('-', '').split('.')
  if (BigInt(integer) >= BigInt(1)) return 2
  return Math.max(2, fraction.slice(0, PRICE_DECIMALS).replace(/0+$/, '').length)
}
export function fmtQty(input: string, decimals: number, digits = 4): string {
  try { return fixedDecimal(fromAtomic(input, decimals), digits) } catch { return '—' }
}
// Per 8.4, portfolio valuation, sums and percentages must come from the API.
// Legacy numeric exports remain until their consuming screens migrate.
export function formatMoneyNumber(value: number | null | undefined, locale = 'en-US', fractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value)
}

export function formatUsdt(value: number | null | undefined, locale = 'en-US', fractionDigits = 2): string {
  const number = formatMoneyNumber(value, locale, fractionDigits)
  return number === '—' ? number : `${number} USDT`
}
