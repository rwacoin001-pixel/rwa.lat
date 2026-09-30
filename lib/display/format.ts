import { ledgerDisplay, type DisplayDirection } from './labels'

export type MoneySign = 'none' | 'always' | 'in' | 'out' | 'hold' | 'context'

function numberFormatter(locale: string, maximumFractionDigits: number, minimumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

export function formatNumber(value: number | string | null | undefined, locale = 'en', maximumFractionDigits = 2, minimumFractionDigits = 0) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  return numberFormatter(locale, maximumFractionDigits, minimumFractionDigits).format(amount)
}

export function formatMoney(value: number | string | null | undefined, locale = 'en', options: { maximumFractionDigits?: number; minimumFractionDigits?: number; sign?: MoneySign } = {}) {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—'
  const maximumFractionDigits = options.maximumFractionDigits ?? 2
  const minimumFractionDigits = options.minimumFractionDigits ?? Math.min(2, maximumFractionDigits)
  const sign = options.sign ?? 'none'
  const prefix = sign === 'always'
    ? amount > 0 ? '+' : amount < 0 ? '−' : ''
    : sign === 'in'
      ? '+'
      : sign === 'out' && amount !== 0
        ? '−'
        : ''
  return `${prefix}${numberFormatter(locale, maximumFractionDigits, minimumFractionDigits).format(Math.abs(amount))}`
}

export function formatLedgerAmount(amount: number | string | null | undefined, transactionType: string | null | undefined, locale = 'en', options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}) {
  const display = ledgerDisplay(transactionType, locale)
  return formatMoney(amount, locale, { ...options, sign: display.direction as MoneySign })
}

export function directionClass(direction: DisplayDirection) {
  return `direction-${direction}`
}

export function formatTime(value: string | Date | null | undefined, locale = 'en', options: { relative?: boolean } = {}) {
  if (!value) return locale.startsWith('zh') ? '时间未知' : 'Time unavailable'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return locale.startsWith('zh') ? '时间未知' : 'Time unavailable'
  const relative = options.relative ?? true
  const distanceSeconds = (date.getTime() - Date.now()) / 1000
  if (relative && Math.abs(distanceSeconds) < 24 * 60 * 60) {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (Math.abs(distanceSeconds) < 60) return formatter.format(Math.round(distanceSeconds), 'second')
    const minutes = distanceSeconds / 60
    if (Math.abs(minutes) < 60) return formatter.format(Math.round(minutes), 'minute')
    return formatter.format(Math.round(minutes / 60), 'hour')
  }
  const year = date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year, hour: '2-digit', minute: '2-digit' }).format(date)
}
