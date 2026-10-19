/** Calendar helpers for the product's own timezone (trade dates are local calendar days, `YYYY-MM-DD`). */

export function localDateAndMinutes(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function addDays(date: string, days: number): string {
  const moved = new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
  return moved.toISOString().slice(0, 10)
}

/** `15:00` or `15:00:00` → minutes after midnight. */
export function cutoffMinutes(cutoff: string): number {
  const [hours, minutes] = cutoff.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

/**
 * The trade date an order placed `now` belongs to: today before the cutoff, tomorrow after it.
 * A redemption settles at the end of that trade date; a subscription starts earning on the day after it.
 */
export function orderTradeDate(now: Date, timeZone: string, cutoff: string): string {
  const local = localDateAndMinutes(now, timeZone)
  return local.minutes < cutoffMinutes(cutoff) ? local.date : addDays(local.date, 1)
}
