/**
 * Basket 金融精度工具（规格 §103：NUMERIC(36,18) 体系；落 Ledger 前显式换算为原子单位）。
 * 全部使用 BigInt 定点运算（scale 18），禁止浮点进入金融路径。
 */
const SCALE = 18
const ONE = 10n ** BigInt(SCALE)

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

/** 十进制字符串 → 18 位定点 BigInt（超过 18 位小数拒绝） */
export function parse18(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) throw new Error('parse18: value is required')
  const text = typeof value === 'number' ? value.toString() : value.trim()
  if (!DECIMAL_PATTERN.test(text)) throw new Error(`parse18: invalid decimal "${text}"`)
  const negative = text.startsWith('-')
  const [intPart, fracPart = ''] = (negative ? text.slice(1) : text).split('.')
  if (fracPart.length > SCALE) throw new Error(`parse18: more than ${SCALE} decimal places`)
  const padded = (fracPart + '0'.repeat(SCALE)).slice(0, SCALE)
  const raw = BigInt(`${intPart}${padded}`)
  return negative ? -raw : raw
}

/** 18 位定点 → 十进制字符串（保持 18 位小数） */
export function format18(value: bigint): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const intPart = abs / ONE
  const fracPart = abs % ONE
  return `${negative ? '-' : ''}${intPart}.${fracPart.toString().padStart(SCALE, '0')}`
}

export function add18(a: bigint, b: bigint): bigint {
  return a + b
}

export function sub18(a: bigint, b: bigint): bigint {
  return a - b
}

/** 乘法（向下取整到 18 位小数；正值金融场景确定性舍入） */
export function mul18(a: bigint, b: bigint): bigint {
  return (a * b) / ONE
}

/** 除法（向下取整到 18 位小数） */
export function div18(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('div18: division by zero')
  return (a * ONE) / b
}

export function cmp18(a: bigint, b: bigint): number {
  return a === b ? 0 : a < b ? -1 : 1
}

export function isPositive18(value: bigint): boolean {
  return value > 0n
}

/**
 * 18 位定点 → 目标精度原子单位（默认 USDT 6 位）。
 * 精度不足原子单位时拒绝（例如 0.0000005 USDT）。
 */
export function toAtomic(value18: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(SCALE - decimals)
  if (value18 < 0n) throw new Error('toAtomic: negative amount')
  if (value18 % divisor !== 0n) {
    throw new Error(`toAtomic: amount has more precision than the asset supports (${decimals} decimals)`)
  }
  return (value18 / divisor).toString()
}

/** 18 位定点 → 原子单位（四舍五入，允许负值；用于内部结算与对账展示） */
export function toAtomicRounded(value18: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(SCALE - decimals)
  const negative = value18 < 0n
  const abs = negative ? -value18 : value18
  const rounded = (abs + divisor / 2n) / divisor
  return `${negative ? '-' : ''}${rounded}`
}

/** 18 位定点 → 原子单位（带符号，四舍五入；对账观察值用） */
export function toAtomicSigned(value18: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(SCALE - decimals)
  const negative = value18 < 0n
  const abs = negative ? -value18 : value18
  const rounded = (abs + divisor / 2n) / divisor
  return `${negative ? '-' : ''}${rounded}`
}

/** 原子单位 → 18 位定点 */
export function atomicTo18(atomic: string, decimals = 6): bigint {
  if (!/^\d+$/.test(atomic)) throw new Error(`atomicTo18: invalid atomic "${atomic}"`)
  return BigInt(atomic) * 10n ** BigInt(SCALE - decimals)
}

/** 占比（0-100，4 位小数）字符串：part / whole * 100 */
export function weightPct18(part: bigint, whole: bigint): string {
  if (whole === 0n) return '0.0000'
  const scaled = (part * 1_000_000n) / whole // 100 * 10^4
  return (Number(scaled) / 10_000).toFixed(4)
}

/** 计算 qty * price 等金额（18dp × 18dp → 18dp，向下取整） */
export function notional18(quantity: bigint, price: bigint): bigint {
  return mul18(quantity, price)
}
