import { fmtQty } from '@/lib/money'

/** Atomic → fixed display with a unit; '—' for anything that is not a valid amount. */
export function fmtAtomic(atomic: string | null | undefined, decimals: number, unit: string, digits = 2) {
  if (atomic == null || atomic === '' || !/^-?\d+$/.test(atomic)) return '—'
  const value = fmtQty(atomic, decimals, digits)
  return value === '—' ? value : `${value} ${unit}`
}

export function fmtDateTime(iso: string | null | undefined, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, options).format(date)
}

export function fmtDate(iso: string | null | undefined, locale: string) {
  return fmtDateTime(iso, locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Compact countdown: 2d 3h · 14m 05s · 42s. Digits only, so it reads the same in every locale. */
export function fmtDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60), sec = seconds % 60
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}
