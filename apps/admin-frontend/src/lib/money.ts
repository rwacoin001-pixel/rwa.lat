// Exact decimal helpers for money. Values stay as strings / BigInt; never parse to float.

const DECIMAL_RE = /^\d+(\.\d+)?$/

export function isDecimalString(value: string): boolean {
  return DECIMAL_RE.test(value.trim())
}

export function decimalPlaces(value: string): number {
  const fraction = value.trim().split('.')[1]
  return fraction ? fraction.length : 0
}

/** Validates a user-entered amount; returns an error message or null. */
export function validateAmount(value: string, maxDecimals: number, options: { allowZero?: boolean } = {}): string | null {
  const v = value.trim()
  if (!v) return '请输入金额'
  if (!isDecimalString(v)) return '请输入正数，不支持逗号、负号或科学计数法'
  if (decimalPlaces(v) > maxDecimals) return `小数位不能超过 ${maxDecimals} 位`
  if (!options.allowZero && toAtomic(v, maxDecimals) === BigInt(0)) return '金额必须大于零'
  return null
}

/** Converts a decimal string to its integer atomic representation. Throws on invalid input. */
export function toAtomic(value: string, decimals: number): bigint {
  const v = value.trim()
  if (!isDecimalString(v)) throw new Error('请输入正数，不支持逗号或科学计数法')
  const [whole, fraction = ''] = v.split('.')
  if (fraction.length > decimals) throw new Error(`小数位不能超过 ${decimals} 位`)
  return BigInt(whole + fraction.padEnd(decimals, '0'))
}

function parseAtomic(atomic: string | bigint | null | undefined): bigint | null {
  if (typeof atomic === 'bigint') return atomic
  const s = String(atomic ?? '').trim()
  if (!/^-?\d+$/.test(s)) return null
  return BigInt(s)
}

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Formats an atomic integer amount as a decimal string, trimming trailing zeros. */
export function formatAtomic(atomic: string | bigint | null | undefined, decimals: number, options: { group?: boolean } = {}): string {
  const value = parseAtomic(atomic)
  if (value === null) return String(atomic ?? '—')
  const negative = value < BigInt(0)
  const abs = negative ? -value : value
  const base = BigInt(10) ** BigInt(decimals)
  const whole = (abs / base).toString()
  const frac = decimals > 0 ? (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '') : ''
  const wholeText = options.group ? groupThousands(whole) : whole
  return `${negative ? '-' : ''}${wholeText}${frac ? `.${frac}` : ''}`
}

/** Exact sum of atomic integer strings. Invalid entries are skipped. */
export function sumAtomic(values: Array<string | bigint | null | undefined>): bigint {
  let total = BigInt(0)
  for (const v of values) {
    const parsed = parseAtomic(v)
    if (parsed !== null) total += parsed
  }
  return total
}

/** Exact sum of decimal strings, returned as a decimal string. */
export function sumDecimals(values: string[]): string {
  const valid = values.map((v) => v.trim()).filter(isDecimalString)
  const scale = valid.reduce((max, v) => Math.max(max, decimalPlaces(v)), 0)
  return formatAtomic(sumAtomic(valid.map((v) => toAtomic(v, scale))), scale)
}
